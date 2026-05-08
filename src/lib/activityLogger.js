import dbConnect from "@/lib/dbConnect";
import Activity from "@/models/Activity";

/**
 * Logs a system activity.
 * @param {Object} params 
 * @param {string} params.userId - The ID of the user performing the action
 * @param {string} params.role - The role the user is acting as (e.g., admin, organizer, statistician)
 * @param {string} params.action - A short string describing the action type (e.g., 'CREATED_USER', 'UPDATED_GAME')
 * @param {string} params.details - A human-readable description of the action
 * @param {string} [params.organization] - Optional organization ID if the action is scoped
 */
export async function logActivity({ userId, role, action, details, organization = null }) {
    try {
        await dbConnect();
        await Activity.create({
            user: userId,
            role: role || "unknown",
            action,
            details,
            organization
        });
    } catch (error) {
        console.error("Failed to log activity:", error);
    }
}
