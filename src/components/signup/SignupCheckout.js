"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import SearchableSelect from "@/components/SearchableSelect";
import PayPalCheckout from "@/components/payments/PayPalCheckout";
import SignupThankYou from "@/components/signup/SignupThankYou";

const ROW_2COL = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "15px" };
const FIELD_LABEL_STYLE = { display: "block", fontSize: "12px", color: "rgba(255,255,255,0.5)", marginBottom: "6px" };

const REGISTRATION_TYPES = [
    { value: "free-agent", label: "Free Agent" },
    { value: "team", label: "Team" },
    { value: "payment", label: "Custom Payment" },
];

function currency(amount) {
    return `$${Number(amount || 0).toFixed(2)}`;
}

// Red outline + glow for a field that failed validation on the last Pay Now
// attempt — matches SearchableSelect's own `error` look so a plain <input>
// next to a dropdown reads as the same kind of invalid.
function invalidStyle(isInvalid) {
    return isInvalid ? { borderColor: "#FF1E00", boxShadow: "0 0 0 3px rgba(255,30,0,0.12)" } : {};
}

// Shared look for every radio-as-pill group on this form (registration
// type, team payment method) so they read as one design language.
function radioPillStyle(active) {
    return {
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "12px 16px",
        borderRadius: "12px",
        cursor: "pointer",
        background: active ? "rgba(255,30,0,0.12)" : "rgba(255,255,255,0.05)",
        border: `1px solid ${active ? "#FF1E00" : "rgba(255,255,255,0.14)"}`,
        transition: "background 0.2s, border-color 0.2s",
    };
}

/**
 * Single-page, split checkout replacing the old 3-card chooser + 3 separate
 * /signup/* forms. Left pane is one form covering all three registration
 * types (Free Agent / Team / Custom Payment); right pane is a sticky order
 * summary with the live price breakdown and the Pay Now action, mirroring
 * a standard e-commerce checkout split.
 */
export default function SignupCheckout({ orgSlug: initialOrgSlug = "" }) {
    const [registrationType, setRegistrationType] = useState("free-agent");
    // Organization is fixed by whichever org page the visitor registered
    // from (?org=) — no picker, nothing to re-select here.
    const organizationSlug = initialOrgSlug;
    const [org, setOrg] = useState(null);
    const [orgStatus, setOrgStatus] = useState("loading"); // "loading" | "ready" | "error"
    const [leagues, setLeagues] = useState([]);
    const [leagueId, setLeagueId] = useState("");
    const [state, setState] = useState("");
    const [form, setForm] = useState({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        address: "",
        notes: "",
        teamName: "",
        playerCount: "",
        amount: "",
    });
    // How a team pays: the flat team deposit set on the league, or the sum
    // of per-player fees (which must cover at least the deposit).
    const [teamPaymentMethod, setTeamPaymentMethod] = useState("deposit");
    const [error, setError] = useState("");
    // Field-level red outlines only turn on after a failed Pay Now attempt —
    // no point flagging blank required fields before the visitor has tried.
    const [showErrors, setShowErrors] = useState(false);
    const [confirmed, setConfirmed] = useState(false);

    // Every page renders inside <div className="wrapper"> with
    // `overflow: hidden` (site-wide, to clip .fullwidth bleed elements on
    // other pages) — that alone disables position:sticky for anything
    // inside it, regardless of height. body.overflow-none is this app's
    // existing escape hatch for exactly that; scope it to this page only.
    useEffect(() => {
        document.body.classList.add("overflow-none");
        return () => document.body.classList.remove("overflow-none");
    }, []);

    useEffect(() => {
        if (!organizationSlug) { setOrg(null); setOrgStatus("error"); return; }
        let cancelled = false;
        setOrgStatus("loading");
        fetch(`/api/organizations/${organizationSlug}`)
            .then((r) => r.json())
            .then((data) => {
                if (cancelled) return;
                if (data.success) { setOrg(data.data); setOrgStatus("ready"); }
                else setOrgStatus("error");
            })
            .catch(() => { if (!cancelled) setOrgStatus("error"); });
        return () => { cancelled = true; };
    }, [organizationSlug]);

    // League list for this org — filtered by state below, and read for
    // pricing (fee fields) once one is selected.
    useEffect(() => {
        if (!organizationSlug) { setLeagues([]); setLeagueId(""); return; }
        let cancelled = false;
        fetch(`/api/organizations/${organizationSlug}/leagues?type=active&showOnSignup=true`)
            .then((r) => r.json())
            .then((data) => { if (!cancelled && data.success) setLeagues(data.data); })
            .catch(() => {});
        return () => { cancelled = true; };
    }, [organizationSlug]);

    // Only the states the org actually operates in — pulled off its
    // configured locations instead of the full 50-state list.
    const stateOptions = useMemo(() => {
        const seen = new Map();
        for (const loc of org?.locations || []) {
            if (loc.stateAbbr && !seen.has(loc.stateAbbr)) {
                seen.set(loc.stateAbbr, loc.stateName || loc.stateAbbr);
            }
        }
        return [...seen.entries()].map(([abbr, name]) => ({ value: abbr, label: name }));
    }, [org]);

    // Leagues are scoped to whichever state is picked — a league only
    // shows up once a state is selected, and only if it runs there.
    const stateLeagues = useMemo(
        () => (state ? leagues.filter((l) => (l.states || []).includes(state)) : []),
        [leagues, state]
    );
    const leagueOptions = stateLeagues.map((l) => ({ value: l._id, label: l.name }));
    const leaguePlaceholder = !state
        ? "Select a state first"
        : stateLeagues.length === 0
            ? "No leagues in this state"
            : "Select a league";

    // Clear a league selection that's no longer valid for the current state.
    useEffect(() => {
        if (leagueId && !stateLeagues.some((l) => l._id === leagueId)) setLeagueId("");
    }, [stateLeagues, leagueId]);

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
        setError("");
    };

    const selectedLeague = useMemo(
        () => leagues.find((l) => l._id === leagueId) || null,
        [leagues, leagueId]
    );

    const teamDepositAmount = selectedLeague?.teamDeposit || 0;
    const playerCountNum = Number(form.playerCount) || 0;
    const playerFeesTotal = playerCountNum * (selectedLeague?.playerFee || 0);
    // Paying by per-player fees has to at least cover the deposit — that's
    // the whole point of the deposit floor.
    const playerFeesShortfall = teamPaymentMethod === "playerFees" && playerFeesTotal < teamDepositAmount;

    const lineItems = useMemo(() => {
        if (registrationType === "free-agent") {
            return [{ label: "Free Agent / Player Fee", amount: selectedLeague?.playerFee || 0 }];
        }
        if (registrationType === "team") {
            const primary = teamPaymentMethod === "playerFees"
                ? { label: `Player Fees (${playerCountNum || 0} players)`, amount: playerFeesTotal }
                : { label: "Team Deposit", amount: teamDepositAmount };
            return [primary, { label: "Team Fee", amount: selectedLeague?.teamFee || 0 }];
        }
        return [{ label: "Custom Payment", amount: Number(form.amount) || 0 }];
    }, [registrationType, selectedLeague, form.amount, teamPaymentMethod, playerCountNum, playerFeesTotal, teamDepositAmount]);

    const total = lineItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

    const requiredFilled =
        form.firstName.trim() &&
        form.lastName.trim() &&
        form.email.trim() &&
        form.phone.trim() &&
        form.address.trim() &&
        state &&
        (registrationType !== "payment" || (form.notes.trim() && Number(form.amount) > 0)) &&
        (registrationType !== "team" || (
            form.teamName.trim() &&
            (teamPaymentMethod !== "playerFees" || (playerCountNum > 0 && !playerFeesShortfall))
        ));

    // Which individual fields to outline red — only meaningful once
    // showErrors is on (see handlePayNow).
    const fieldInvalid = {
        firstName: showErrors && !form.firstName.trim(),
        lastName: showErrors && !form.lastName.trim(),
        email: showErrors && !form.email.trim(),
        phone: showErrors && !form.phone.trim(),
        address: showErrors && !form.address.trim(),
        state: showErrors && !state,
        teamName: showErrors && registrationType === "team" && !form.teamName.trim(),
        playerCount: showErrors && registrationType === "team" && teamPaymentMethod === "playerFees" && (playerCountNum <= 0 || playerFeesShortfall),
        amount: showErrors && registrationType === "payment" && !(Number(form.amount) > 0),
        notes: showErrors && registrationType === "payment" && !form.notes.trim(),
    };

    // The reason PayPal shows the buyer / support sees on the transaction.
    // The Comments field is only mandatory for Custom Payment — free agent
    // and team registrations still need *some* reason on the PayPal order,
    // so fall back to one built from context when the buyer left it blank.
    const paypalNote = form.notes.trim() || (
        registrationType === "team"
            ? `Team registration — ${form.teamName || "unnamed team"}${selectedLeague ? ` (${selectedLeague.name})` : ""}`
            : `Free agent registration${selectedLeague ? ` — ${selectedLeague.name}` : ""}`
    );

    // Clicking through with something missing just reveals the field-level
    // red outlines (see fieldInvalid) — once requiredFilled is true, this
    // button is swapped out for the real PayPal Buttons below.
    const handlePayNow = () => {
        if (!org) { setError("Couldn't find this organization — please go back and try again."); return; }
        setShowErrors(true);
    };

    if (confirmed) {
        return <SignupThankYou name={form.firstName} orgName={org?.name} logo={org?.logo} />;
    }

    return (
        <div
            style={{
                minHeight: "100vh",
                background: "#0b0d14",
                display: "flex",
                flexDirection: "column",
            }}
        >
            {/* Minimal checkout top bar — brand mark only, centered, no full
                site nav, so nothing pulls attention away mid-checkout. Shows
                the org's own logo once it's loaded (this is their signup
                page, after all) — falls back to the FlagMag mark while
                loading/erroring or if the org has none set. */}
            <div
                style={{
                    padding: "24px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderBottom: "1px solid rgba(255,255,255,0.08)",
                }}
            >
                <Link href="/" style={{ display: "inline-flex" }}>
                    <img
                        src={orgStatus === "ready" && org?.logo ? org.logo : "/assets/images/logo.png"}
                        alt={orgStatus === "ready" && org?.logo ? org.name : "FlagMag"}
                        style={{ height: "56px" }}
                    />
                </Link>
            </div>
            {/* Thin brand stripe nodding to the logo's red/yellow flag mark,
                instead of reusing the blurred hero photo — keeps a checkout
                page this streamlined from reading as a bare gray form. */}
            <div style={{ height: "4px", background: "linear-gradient(90deg, #FF1E00 0%, #FF1E00 70%, #FFC400 100%)" }} />

            <div style={{ flex: 1, padding: "40px 24px 80px", display: "flex", justifyContent: "center" }}>
                <div className="signup-checkout-grid" style={{ width: "100%", maxWidth: "1180px" }}>
                    {/* ── Left: the one form ── */}
                    <div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "28px" }}>
                            <h1
                                style={{
                                    fontFamily: "var(--font-anton), sans-serif",
                                    fontWeight: 700,
                                    fontSize: "44px",
                                    letterSpacing: "0.5px",
                                    textTransform: "uppercase",
                                    color: "#fff",
                                    margin: 0,
                                }}
                            >
                                Register
                            </h1>
                            <Link
                                href={initialOrgSlug ? `/organizations/${initialOrgSlug}` : "/organizations"}
                                style={{ color: "rgba(255,255,255,0.6)", fontSize: "14px", textDecoration: "none" }}
                            >
                                <i className="fa-solid fa-arrow-left" style={{ marginRight: "6px" }}></i>
                                Back
                            </Link>
                        </div>

                        <div
                            style={{
                                background: "rgba(255,255,255,0.05)",
                                border: "1px solid rgba(255,255,255,0.12)",
                                borderRadius: "16px",
                                padding: "28px",
                            }}
                        >
                            <div className="form-area" style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                                {error && (
                                    <div className="alert alert-danger py-2" role="alert">
                                        {error}
                                    </div>
                                )}
                                <div style={ROW_2COL}>
                                    <input
                                        type="text"
                                        name="firstName"
                                        className="form-control"
                                        placeholder="First Name *"
                                        value={form.firstName}
                                        onChange={handleChange}
                                        required
                                        style={invalidStyle(fieldInvalid.firstName)}
                                    />
                                    <input
                                        type="text"
                                        name="lastName"
                                        className="form-control"
                                        placeholder="Last Name *"
                                        value={form.lastName}
                                        onChange={handleChange}
                                        required
                                        style={invalidStyle(fieldInvalid.lastName)}
                                    />
                                </div>
                                <div style={ROW_2COL}>
                                    <input
                                        type="email"
                                        name="email"
                                        className="form-control"
                                        placeholder="Email *"
                                        value={form.email}
                                        onChange={handleChange}
                                        required
                                        suppressHydrationWarning
                                        style={invalidStyle(fieldInvalid.email)}
                                    />
                                    <input
                                        type="tel"
                                        name="phone"
                                        className="form-control"
                                        placeholder="Phone Number *"
                                        value={form.phone}
                                        onChange={handleChange}
                                        required
                                        style={invalidStyle(fieldInvalid.phone)}
                                    />
                                </div>

                                <textarea
                                    name="address"
                                    className="form-control"
                                    placeholder="Address *"
                                    value={form.address}
                                    onChange={handleChange}
                                    rows={2}
                                    required
                                    style={invalidStyle(fieldInvalid.address)}
                                />

                                <div style={ROW_2COL}>
                                    <div>
                                        <label style={FIELD_LABEL_STYLE}>Organization</label>
                                        <div
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "space-between",
                                                gap: "10px",
                                                minHeight: "40px",
                                                padding: "10px 16px",
                                                borderRadius: "50px",
                                                background: "#16181C",
                                                border: "1px solid #312D23",
                                                color: "rgba(255,255,255,0.85)",
                                                fontSize: "14px",
                                            }}
                                        >
                                            <span>
                                                {orgStatus === "loading" ? "Loading..." :
                                                    orgStatus === "error" ? "Organization not found" :
                                                    org?.name || ""}
                                            </span>
                                            <i className="fa-solid fa-lock" style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)" }}></i>
                                        </div>
                                    </div>
                                    <div>
                                        <label style={FIELD_LABEL_STYLE}>State *</label>
                                        <SearchableSelect
                                            value={state}
                                            onChange={setState}
                                            options={stateOptions}
                                            placeholder={stateOptions.length ? "Select state" : "No locations configured"}
                                            disabled={!stateOptions.length}
                                            error={fieldInvalid.state}
                                            dark
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label style={FIELD_LABEL_STYLE}>League</label>
                                    <SearchableSelect
                                        value={leagueId}
                                        onChange={setLeagueId}
                                        options={leagueOptions}
                                        placeholder={leaguePlaceholder}
                                        disabled={!state || stateLeagues.length === 0}
                                        dark
                                    />
                                </div>

                                <div>
                                    <label style={FIELD_LABEL_STYLE}>Registering as</label>
                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
                                        {REGISTRATION_TYPES.map((t) => {
                                            const active = registrationType === t.value;
                                            return (
                                                <label key={t.value} style={radioPillStyle(active)}>
                                                    <input
                                                        type="radio"
                                                        name="registrationType"
                                                        value={t.value}
                                                        checked={active}
                                                        onChange={() => setRegistrationType(t.value)}
                                                        style={{ accentColor: "#FF1E00", width: "16px", height: "16px", cursor: "pointer" }}
                                                    />
                                                    <span style={{ color: "#fff", fontSize: "14px", fontWeight: 600 }}>{t.label}</span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>

                                {registrationType === "team" && (
                                    <>
                                        <div>
                                            <label style={FIELD_LABEL_STYLE}>Team Name *</label>
                                            <input
                                                type="text"
                                                name="teamName"
                                                className="form-control"
                                                placeholder="Team Name *"
                                                value={form.teamName}
                                                onChange={handleChange}
                                                required
                                                style={invalidStyle(fieldInvalid.teamName)}
                                            />
                                        </div>

                                        <div>
                                            <label style={FIELD_LABEL_STYLE}>How will the team pay?</label>
                                            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px" }}>
                                                {[
                                                    { value: "deposit", label: `Team Deposit (${currency(teamDepositAmount)})` },
                                                    { value: "playerFees", label: "Player Fees" },
                                                ].map((opt) => {
                                                    const active = teamPaymentMethod === opt.value;
                                                    return (
                                                        <label key={opt.value} style={radioPillStyle(active)}>
                                                            <input
                                                                type="radio"
                                                                name="teamPaymentMethod"
                                                                value={opt.value}
                                                                checked={active}
                                                                onChange={() => setTeamPaymentMethod(opt.value)}
                                                                style={{ accentColor: "#FF1E00", width: "16px", height: "16px", cursor: "pointer" }}
                                                            />
                                                            <span style={{ color: "#fff", fontSize: "14px", fontWeight: 600 }}>{opt.label}</span>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {teamPaymentMethod === "playerFees" && (
                                            <div>
                                                <label style={FIELD_LABEL_STYLE}>Number of Players *</label>
                                                <input
                                                    type="number"
                                                    name="playerCount"
                                                    className="form-control"
                                                    placeholder="e.g. 12"
                                                    value={form.playerCount}
                                                    onChange={handleChange}
                                                    min="1"
                                                    step="1"
                                                    required
                                                    style={invalidStyle(fieldInvalid.playerCount)}
                                                />
                                                <div style={{ marginTop: "8px", fontSize: "13px", color: playerFeesShortfall ? "#f87171" : "rgba(255,255,255,0.5)" }}>
                                                    {playerFeesShortfall
                                                        ? `Must total at least ${currency(teamDepositAmount)} (the team deposit) — currently ${currency(playerFeesTotal)}.`
                                                        : `${currency(playerFeesTotal)} total at ${currency(selectedLeague?.playerFee || 0)}/player.`}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}

                                {registrationType === "payment" && (
                                    <>
                                        <div>
                                            <label style={FIELD_LABEL_STYLE}>Team Name</label>
                                            <input
                                                type="text"
                                                name="teamName"
                                                className="form-control"
                                                placeholder="Team Name (if applicable)"
                                                value={form.teamName}
                                                onChange={handleChange}
                                            />
                                        </div>

                                        <div>
                                            <label style={FIELD_LABEL_STYLE}>Amount *</label>
                                            <input
                                                type="number"
                                                name="amount"
                                                className="form-control"
                                                placeholder="Enter amount to pay *"
                                                value={form.amount}
                                                onChange={handleChange}
                                                min="1"
                                                step="0.01"
                                                required
                                                style={invalidStyle(fieldInvalid.amount)}
                                            />
                                        </div>
                                    </>
                                )}

                                <div
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "baseline",
                                        borderTop: "1px solid rgba(255,255,255,0.12)",
                                        paddingTop: "16px",
                                        marginTop: "4px",
                                    }}
                                >
                                    <span style={{ color: "#fff", fontSize: "15px", fontWeight: 600 }}>Your Total Amount Due Is</span>
                                    <span style={{ color: "#FF1E00", fontSize: "22px", fontWeight: 700 }}>{currency(total)}</span>
                                </div>

                                <textarea
                                    name="notes"
                                    className="form-control"
                                    placeholder={
                                        registrationType === "payment"
                                            ? "Comments / Reason for payment *"
                                            : "Any Special Details, Questions, Comments?"
                                    }
                                    value={form.notes}
                                    onChange={handleChange}
                                    rows={3}
                                    required={registrationType === "payment"}
                                    style={invalidStyle(fieldInvalid.notes)}
                                />
                            </div>
                        </div>

                        {/* <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "13px", marginTop: "18px" }}>
                            Already have an account?{" "}
                            <Link href="/login" style={{ color: "#FF1E00", textDecoration: "none", fontWeight: 600 }}>
                                Log in here
                            </Link>
                        </p> */}
                    </div>

                    {/* ── Right: order summary + Pay Now ── */}
                    <div className="signup-checkout-summary">
                        <div
                            style={{
                                background: "rgba(255,255,255,0.06)",
                                border: "1px solid rgba(255,255,255,0.14)",
                                borderRadius: "16px",
                                padding: "24px",
                            }}
                        >
                            <div style={{ fontSize: "12px", letterSpacing: "0.5px", textTransform: "uppercase", color: "rgba(255,255,255,0.5)", marginBottom: "6px" }}>
                                Registering with
                            </div>
                            <div style={{ color: "#fff", fontWeight: 700, fontSize: "18px", marginBottom: "20px" }}>
                                {org?.name || "..."}
                            </div>

                            <div style={{ borderTop: "1px solid rgba(255,255,255,0.12)", paddingTop: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                                {lineItems.map((item) => (
                                    <div key={item.label} style={{ display: "flex", justifyContent: "space-between", color: "rgba(255,255,255,0.8)", fontSize: "14px" }}>
                                        <span>{item.label}</span>
                                        <span>{currency(item.amount)}</span>
                                    </div>
                                ))}
                            </div>

                            <div
                                style={{
                                    borderTop: "1px solid rgba(255,255,255,0.12)",
                                    marginTop: "16px",
                                    paddingTop: "16px",
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "baseline",
                                }}
                            >
                                <span style={{ color: "#fff", fontWeight: 700, fontSize: "15px" }}>Total</span>
                                <span style={{ color: "#fff", fontWeight: 700, fontSize: "24px" }}>{currency(total)}</span>
                            </div>

                            {requiredFilled ? (
                                <div style={{ marginTop: "20px" }}>
                                    <PayPalCheckout
                                        name={`${form.firstName} ${form.lastName}`.trim()}
                                        email={form.email}
                                        phone={form.phone}
                                        amount={total}
                                        note={paypalNote}
                                        address={form.address}
                                        state={state}
                                        teamName={registrationType === "team" ? form.teamName : ""}
                                        organizationSlug={organizationSlug}
                                        organizationName={org?.name || ""}
                                        organizationId={org?._id || ""}
                                        leagueId={leagueId}
                                        leagueName={selectedLeague?.name || ""}
                                        registrationType={registrationType}
                                        onSuccess={() => setConfirmed(true)}
                                        onError={(msg) => setError(msg)}
                                    />
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={handlePayNow}
                                    style={{
                                        width: "100%",
                                        marginTop: "20px",
                                        borderRadius: "30px",
                                        padding: "14px",
                                        fontWeight: 700,
                                        letterSpacing: "0.5px",
                                    }}
                                >
                                    <i className="fa-solid fa-lock" style={{ marginRight: "8px" }}></i>
                                    Pay Now
                                </button>
                            )}

                            {/* <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "12px", marginTop: "14px", textAlign: "center" }}>
                                Secure checkout
                            </p> */}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
