/**
 * Self-service account deletion (App Store guideline 5.1.1(v): an app that
 * lets people create an account must let them delete it from inside the app).
 *
 * Hard-deletes the User everywhere — stats app and website alike — and
 * clears what pointed at them:
 *   - Activity logs by the user: deleted (they're the user's own history)
 *   - Notification.triggeredBy: unset (the notification stays for its org)
 *   - Payment.user: set to null — the payment itself is kept as a financial
 *     record (Apple allows keeping data required for legal/accounting)
 *   - Player.user: unset, and the email/phone mirrored from the account are
 *     cleared — the player stays on rosters with their game history intact
 *
 * Game stats (Game/Play/GameStat) never record which statistician entered
 * them, so nothing there needs touching.
 *
 * Refuses (409) while the user manages a team: a team without a manager is
 * worse than asking them to hand it over first.
 *
 * Models are passed in rather than imported so this runs under plain
 * `node --test` (which can't resolve the `@/` alias).
 *
 * @param {{ userId: string, password: string }} input
 * @param {{
 *   User: import("mongoose").Model, Team: import("mongoose").Model,
 *   Activity: import("mongoose").Model, Notification: import("mongoose").Model,
 *   Payment: import("mongoose").Model, Player: import("mongoose").Model,
 *   comparePassword: (plain: string, hash: string) => Promise<boolean>,
 *   inTransaction: (fn: (session: unknown) => Promise<unknown>) => Promise<unknown>,
 * }} deps
 * @returns {Promise<{ ok: true } | { ok: false, status: number, error: string }>}
 */
export async function deleteAccount({ userId, password }, deps) {
    const { User, Team, Activity, Notification, Payment, Player, comparePassword, inTransaction } = deps;

    if (!password) return { ok: false, status: 400, error: "Please enter your password to confirm" };

    const user = await User.findById(userId).select("password").lean();
    if (!user) return { ok: false, status: 404, error: "Account not found" };

    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) return { ok: false, status: 401, error: "Incorrect password" };

    const managedTeams = await Team.find({ manager: userId }, "name").lean();
    const blocker = managedTeamsBlocker(managedTeams);
    if (blocker) return { ok: false, status: 409, error: blocker };

    try {
        return await inTransaction(async (session) => {
            // Re-check inside the transaction: someone may have made them a
            // manager since the check above.
            const lateBlocker = managedTeamsBlocker(
                await Team.find({ manager: userId }, "name", { session }).lean()
            );
            if (lateBlocker) return { ok: false, status: 409, error: lateBlocker };

            await Activity.deleteMany({ user: userId }, { session });
            await Notification.updateMany({ triggeredBy: userId }, { $unset: { triggeredBy: 1 } }, { session });
            await Payment.updateMany({ user: userId }, { $set: { user: null } }, { session });
            await Player.updateMany(
                { user: userId },
                { $unset: { user: 1 }, $set: { email: "", phone: "" } },
                { session }
            );
            await User.deleteOne({ _id: userId }, { session });
            return { ok: true };
        });
    } catch (error) {
        // The {user, organization, name} index on Player is sparse, so an
        // unlinked profile still collides with an existing user-less profile
        // of the same name in the same org. The transaction has rolled back.
        if (error?.code === 11000) {
            return {
                ok: false,
                status: 409,
                error: "Your account couldn't be deleted automatically because of a duplicate player profile. Please contact support.",
            };
        }
        throw error;
    }
}

/**
 * Message explaining why the account can't be deleted yet, or null if the
 * user manages no teams.
 * @param {Array<{ name?: string }>} teams
 * @returns {string | null}
 */
export function managedTeamsBlocker(teams) {
    if (!teams?.length) return null;
    const names = teams.map((t) => t.name || "Unnamed team").join(", ");
    const noun = teams.length === 1 ? "team" : "teams";
    return `You manage the ${noun} ${names}. Ask your league organizer to assign a new manager before deleting your account.`;
}
