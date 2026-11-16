"use client";

import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/AdminToast";
import { isStandInName } from "@/lib/playerMergePlan";

// "Merge player records" — for the stand-in records the old-site import
// created when only a jersey number was known ("We Da Best #56 (Winter 2011)").
// The organizer picks the real player to keep, adds every record that was
// really them, reviews each record's teams/seasons, and merges: the stats move
// to the kept player and the stand-in records disappear from the lists.
// Undo is offered right after (POST /api/players/merges/:id/undo).

const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_LIMIT = 50;
// "On Inferno · last played DARKSIDE (Fall 2024) · 468 games" — tells two
// players with the same name apart. Only present on search results
// (GET /api/players?view=picker&details=1).
function identifierLine(p) {
    if (!p || p.games === undefined) return "";
    const parts = [];
    if (p.currentTeams?.length) parts.push(`On ${p.currentTeams.join(", ")}`);
    if (p.lastTeam) parts.push(`last played ${p.lastTeam}${p.lastSeason ? ` (${p.lastSeason})` : ""}`);
    parts.push(p.games ? `${p.games} game${p.games === 1 ? "" : "s"}` : "no recorded games");
    const text = parts.join(" · ");
    return text.charAt(0).toUpperCase() + text.slice(1);
}

const orgIdOf = (player) => String(player?.organization?._id || player?.organization || "");

async function postJson(url, body) {
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body || {}),
    });
    const data = await res.json().catch(() => null);
    if (!data) throw new Error(res.status >= 500 ? "The server had a problem — please try again" : "Unexpected response");
    return data;
}

// excludeStandIns: when picking the REAL player, leave out the jersey-only
// records — otherwise "mike" fills the list with "Dirty Mike And The Boys #0
// (Winter 2016)"... and pushes the actual Mike off the first page.
function usePlayerSearch(organizationId, excludeStandIns) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [hasMore, setHasMore] = useState(false);
    const [searching, setSearching] = useState(false);
    const latest = useRef(0);

    useEffect(() => {
        const term = query.trim();
        if (term.length < 2) {
            setResults([]);
            setHasMore(false);
            return undefined;
        }
        const timer = setTimeout(async () => {
            const requestId = ++latest.current;
            setSearching(true);
            try {
                const params = new URLSearchParams({ view: "picker", search: term, limit: String(SEARCH_LIMIT) });
                if (organizationId) params.set("organization", organizationId);
                if (excludeStandIns) params.set("standIns", "exclude");
                params.set("details", "1");
                const res = await fetch(`/api/players?${params}`);
                const data = await res.json();
                if (requestId !== latest.current) return;
                setResults(data.success ? data.data || [] : []);
                setHasMore(Boolean(data.hasMore));
            } catch {
                if (requestId === latest.current) setResults([]);
            } finally {
                if (requestId === latest.current) setSearching(false);
            }
        }, SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [query, organizationId, excludeStandIns]);

    return { query, setQuery, results, hasMore, searching };
}

function HistoryList({ history }) {
    if (!history) return null;
    if (!history.rows.length && !history.games) {
        return <div style={{ fontSize: 12, color: "#8b90a0" }}>No recorded games.</div>;
    }
    return (
        <ul style={{ margin: "4px 0 0", paddingLeft: 18, fontSize: 12, color: "#5a5f72" }}>
            {history.rows.map((row, i) => (
                <li key={i}>
                    {row.team || "Unknown team"} — {row.league}{row.season ? ` (${row.season})` : ""} · {row.games} game{row.games === 1 ? "" : "s"}
                </li>
            ))}
            {history.more > 0 && <li>…and {history.more} more</li>}
        </ul>
    );
}

function RecordCard({ player, label, history, onRemove, disabled }) {
    return (
        <div style={{ border: "1px solid #e8eaef", borderRadius: 8, padding: "10px 12px", marginBottom: 8, background: "#fff" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                <div style={{ minWidth: 0 }}>
                    {label && <div style={{ fontSize: 11, fontWeight: 700, color: "#FF1E00", textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</div>}
                    <div style={{ fontWeight: 600, color: "#1a1d26", wordBreak: "break-word" }}>{player.name}</div>
                    {!history && identifierLine(player) && <div style={{ fontSize: 12, color: "#6b7080" }}>{identifierLine(player)}</div>}
                    {history && <div style={{ fontSize: 12, color: "#8b90a0" }}>{history.games} game{history.games === 1 ? "" : "s"} with stats</div>}
                </div>
                {onRemove && (
                    <button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" onClick={onRemove} disabled={disabled} aria-label={`Remove ${player.name}`}>
                        <i className="fa-solid fa-xmark"></i>
                    </button>
                )}
            </div>
            <HistoryList history={history} />
        </div>
    );
}

function SearchResults({ search, excludeIds, actionLabel, onPick, disabled }) {
    const visible = search.results.filter((p) => !excludeIds.has(String(p._id)));
    return (
        <div>
            <input
                className="admin-form-input"
                placeholder='Search by name or number, e.g. "Mike Zimmerman" or "#56"'
                value={search.query}
                onChange={(e) => search.setQuery(e.target.value)}
                autoComplete="off"
                aria-label="Search players"
                disabled={disabled}
            />
            <div style={{ maxHeight: 220, overflowY: "auto", marginTop: 8 }}>
                {search.searching && <div style={{ fontSize: 12, color: "#8b90a0", padding: 6 }}>Searching…</div>}
                {!search.searching && search.query.trim().length >= 2 && visible.length === 0 && (
                    <div style={{ fontSize: 12, color: "#8b90a0", padding: 6 }}>No matching players.</div>
                )}
                {visible.map((p) => (
                    <div key={p._id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "6px 4px", borderBottom: "1px solid #f0f1f4" }}>
                        <span style={{ minWidth: 0, wordBreak: "break-word" }}>
                            <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#1a1d26" }}>{p.name}</span>
                            {identifierLine(p) && <span style={{ display: "block", fontSize: 11, color: "#6b7080" }}>{identifierLine(p)}</span>}
                        </span>
                        <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => onPick(p)} disabled={disabled} style={{ flexShrink: 0 }}>
                            {actionLabel}
                        </button>
                    </div>
                ))}
                {search.hasMore && <div style={{ fontSize: 12, color: "#8b90a0", padding: 6 }}>More matches — keep typing to narrow down.</div>}
            </div>
        </div>
    );
}

function EarlierMerges({ targetId, busy, onUndo, refreshKey }) {
    const [merges, setMerges] = useState([]);
    useEffect(() => {
        let cancelled = false;
        fetch(`/api/players/${targetId}/merge`)
            .then((r) => r.json())
            .then((data) => { if (!cancelled) setMerges(data.success ? data.data || [] : []); })
            .catch(() => { if (!cancelled) setMerges([]); });
        return () => { cancelled = true; };
    }, [targetId, refreshKey]);
    if (!merges.length) return null;
    return (
        <div className="admin-form-group">
            <label className="admin-form-label">Earlier merges into this player</label>
            {merges.map((m) => (
                <div key={m._id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid #f0f1f4", fontSize: 12 }}>
                    <span style={{ color: "#5a5f72", wordBreak: "break-word" }}>
                        {new Date(m.createdAt).toLocaleDateString()} — {m.names.join(", ")}
                    </span>
                    <button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => onUndo(m._id)} disabled={busy} style={{ flexShrink: 0 }}>
                        <i className="fa-solid fa-rotate-left"></i> Undo
                    </button>
                </div>
            ))}
        </div>
    );
}

/**
 * @param {{ player: { _id: string, name: string, organization?: unknown }, onClose: () => void, onChanged: () => void, startAsSource?: boolean }} props
 *   startAsSource: open with `player` as a record to merge away (archive
 *   records) rather than as the player to keep. Jersey-only records always are.
 */
export default function MergePlayersModal({ player, onClose, onChanged, startAsSource = false }) {
    const { showSuccess, showError } = useToast();
    const startsAsStandIn = startAsSource || isStandInName(player.name);
    const [target, setTarget] = useState(startsAsStandIn ? null : player);
    const [sources, setSources] = useState(startsAsStandIn ? [player] : []);
    const [review, setReview] = useState(null); // dry-run result
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState(null); // { mergeId, merged, targetName }
    const [mergesVersion, setMergesVersion] = useState(0);
    const search = usePlayerSearch(orgIdOf(player), !target);

    const excludeIds = new Set([target?._id, ...sources.map((s) => s._id)].filter(Boolean).map(String));

    const chooseTarget = (p) => {
        setTarget(p);
        setSources((prev) => prev.filter((s) => String(s._id) !== String(p._id)));
        setReview(null);
        search.setQuery("");
    };
    const addSource = (p) => {
        setSources((prev) => [...prev, p]);
        setReview(null);
    };
    const removeSource = (id) => {
        setSources((prev) => prev.filter((s) => String(s._id) !== String(id)));
        setReview(null);
    };

    const runReview = async () => {
        setBusy(true);
        try {
            const key = recordSetKey;
            const data = await postJson(`/api/players/${target._id}/merge`, { sourceIds: sources.map((s) => s._id), dryRun: true });
            if (!data.success) throw new Error(data.error || "Couldn't check these records");
            setReview({ ...data.data, key });
        } catch (error) {
            showError(error.message);
        } finally {
            setBusy(false);
        }
    };

    const runMerge = async () => {
        setBusy(true);
        try {
            const data = await postJson(`/api/players/${target._id}/merge`, { sourceIds: sources.map((s) => s._id) });
            if (!data.success) throw new Error(data.error || "Merge failed");
            setDone({ ...data.data, targetName: target.name });
            showSuccess(`Merged ${data.data.merged} record${data.data.merged === 1 ? "" : "s"} into ${target.name}`);
            onChanged();
        } catch (error) {
            showError(error.message);
        } finally {
            setBusy(false);
        }
    };

    const runUndo = async (mergeId) => {
        setBusy(true);
        try {
            const data = await postJson(`/api/players/merges/${mergeId}/undo`);
            if (!data.success) throw new Error(data.error || "Undo failed");
            showSuccess("Merge undone — the records are back");
            onChanged();
            if (done) onClose();
            else { setMergesVersion((v) => v + 1); setReview(null); }
        } catch (error) {
            showError(error.message);
        } finally {
            setBusy(false);
        }
    };

    // A review only counts for the exact set of records it checked.
    const recordSetKey = [target?._id, ...sources.map((s) => s._id)].join(",");
    const currentReview = review && review.key === recordSetKey ? review : null;
    const historyOf = (id) => currentReview && [currentReview.target, ...currentReview.sources].find((p) => p && String(p._id) === String(id))?.history;
    const blocked = currentReview && currentReview.blockers.length > 0;

    return (
        <div className="admin-modal-backdrop">
            <div className="admin-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640, maxHeight: "90vh", overflowY: "auto" }}>
                <button className="admin-modal-close" onClick={onClose} aria-label="Close" disabled={busy}>
                    <i className="fa-solid fa-xmark"></i>
                </button>
                <h3 className="admin-modal-title">
                    <i className="fa-solid fa-code-merge" style={{ color: "#FF1E00", marginRight: 8 }}></i>
                    Merge Player Records
                </h3>

                {done ? (
                    <div>
                        <div className="admin-alert admin-alert-success" style={{ marginBottom: 16 }}>
                            <i className="fa-solid fa-check-circle"></i> {done.merged} record{done.merged === 1 ? " was" : "s were"} merged into <strong>{done.targetName}</strong>. Their stats now show on {done.targetName}&apos;s profile (leaderboards refresh within a few minutes).
                        </div>
                        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                            <button type="button" className="admin-btn admin-btn-ghost" onClick={() => runUndo(done.mergeId)} disabled={busy}>
                                <i className="fa-solid fa-rotate-left"></i> {busy ? "Undoing..." : "Undo merge"}
                            </button>
                            <button type="button" className="admin-btn admin-btn-primary" onClick={onClose} disabled={busy}>Done</button>
                        </div>
                    </div>
                ) : (
                    <>
                        <p style={{ color: "#5a5f72", fontSize: 13, marginTop: 0 }}>
                            The old site often saved only a jersey number, so those stats were imported under records like
                            &nbsp;<em>&quot;Team #56 (Season)&quot;</em>. Merge every record that was really the same person into
                            their real player — the stats move over, nothing is deleted, and you can undo it.
                        </p>

                        <div className="admin-form-group">
                            <label className="admin-form-label">1. The real player (kept)</label>
                            {target ? (
                                <RecordCard
                                    player={target}
                                    label="Keep"
                                    history={historyOf(target._id)}
                                    onRemove={() => { setTarget(null); setReview(null); }}
                                    disabled={busy}
                                />
                            ) : (
                                <SearchResults search={search} excludeIds={excludeIds} actionLabel="This is the player" onPick={chooseTarget} disabled={busy} />
                            )}
                        </div>

                        <div className="admin-form-group">
                            <label className="admin-form-label">2. Records to merge into them ({sources.length})</label>
                            {sources.map((s) => (
                                <RecordCard key={s._id} player={s} history={historyOf(s._id)} onRemove={() => removeSource(s._id)} disabled={busy} />
                            ))}
                            {target && (
                                <SearchResults search={search} excludeIds={excludeIds} actionLabel="Add" onPick={addSource} disabled={busy} />
                            )}
                        </div>

                        {target && <EarlierMerges targetId={target._id} busy={busy} onUndo={runUndo} refreshKey={mergesVersion} />}

                        {blocked && (
                            <div className="admin-alert admin-alert-error" style={{ marginBottom: 12 }}>
                                <i className="fa-solid fa-exclamation-circle"></i> Can&apos;t merge yet:
                                <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                                    {currentReview.blockers.map((b, i) => <li key={i}>{b}</li>)}
                                </ul>
                            </div>
                        )}

                        <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end", flexWrap: "wrap" }}>
                            <button type="button" className="admin-btn admin-btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
                            {!currentReview || blocked ? (
                                <button type="button" className="admin-btn admin-btn-secondary" onClick={runReview} disabled={busy || !target || sources.length === 0}>
                                    {busy ? "Checking..." : "Review"}
                                </button>
                            ) : (
                                <button type="button" className="admin-btn admin-btn-primary" onClick={runMerge} disabled={busy}>
                                    {busy ? "Merging..." : `Merge ${sources.length} record${sources.length === 1 ? "" : "s"} into ${target.name}`}
                                </button>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
