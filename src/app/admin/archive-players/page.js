"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AdminLayout, { hasAnyAccess } from "@/components/AdminLayout";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/AdminToast";
import AdminPagination from "@/components/AdminPagination";
import MergePlayersModal from "@/components/MergePlayersModal";
import { isStandInName, MAX_MERGE_SOURCES } from "@/lib/playerMergePlan";
import { MAX_NAME_LENGTH } from "@/lib/freeAgentValidation";

// Admin → Archive Players: everyone imported from the old XFlag site who
// isn't on a current roster. They never signed up as free agents, so they're
// kept out of Free Agents. Most old-site seasons recorded only a jersey
// number, so many records are named "Team #56 (Season)" — merge those into
// the real player, or rename them. Search "Darkside #56", "Select all
// matching", then "Merge selected" moves every season of one jersey at once.

const PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 300;
const KINDS = [
    { value: "all", label: "All" },
    { value: "jersey", label: "Jersey number only" },
    { value: "named", label: "Named players" },
];

function historyLine(p) {
    const parts = [];
    if (p.lastTeam) parts.push(`Last played ${p.lastTeam}${p.lastSeason ? ` (${p.lastSeason})` : ""}`);
    parts.push(p.games ? `${p.games} game${p.games === 1 ? "" : "s"}` : "No recorded games");
    return parts.join(" · ");
}

function RenameModal({ player, onClose, onSaved }) {
    const { showSuccess, showError } = useToast();
    const [name, setName] = useState(player.name);
    const [saving, setSaving] = useState(false);

    const save = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await fetch(`/api/free-agents/${player._id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email: player.email || "", phone: player.phone || "" }),
            });
            const data = await res.json().catch(() => null);
            if (!data?.success) throw new Error(data?.error || "Couldn't rename this player");
            showSuccess("Player renamed");
            onSaved();
        } catch (error) {
            showError(error.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="admin-modal-backdrop">
            <div className="admin-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
                <button className="admin-modal-close" onClick={onClose} aria-label="Close" disabled={saving}>
                    <i className="fa-solid fa-xmark"></i>
                </button>
                <h3 className="admin-modal-title">Rename Player</h3>
                {isStandInName(player.name) && (
                    <p style={{ fontSize: 13, color: "#5a5f72", marginTop: 0 }}>
                        If this person already has a player record (other seasons, or a current team), use
                        <strong> Merge</strong> instead so all their games end up on one profile.
                    </p>
                )}
                <form onSubmit={save}>
                    <div className="admin-form-group">
                        <label className="admin-form-label" htmlFor="archive-rename">Name</label>
                        <input
                            id="archive-rename"
                            className="admin-form-input"
                            value={name}
                            maxLength={MAX_NAME_LENGTH}
                            onChange={(e) => setName(e.target.value)}
                            autoComplete="off"
                        />
                    </div>
                    <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end" }}>
                        <button type="button" className="admin-btn admin-btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
                        <button type="submit" className="admin-btn admin-btn-primary" disabled={saving || !name.trim() || name.trim() === player.name}>
                            {saving ? "Saving..." : "Save"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function ArchivePlayersPage() {
    const { user, activeRole } = useAuth();
    const isAdmin = (activeRole || user?.role) === "admin";
    const { showError } = useToast();

    const [players, setPlayers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [kind, setKind] = useState("all");
    const [currentPage, setCurrentPage] = useState(1);
    const [pageMeta, setPageMeta] = useState({ total: 0, totalPages: 1 });
    const [merging, setMerging] = useState(null);
    const [renaming, setRenaming] = useState(null);
    // Chosen records, kept across pages: id -> { _id, name, organization }.
    const [selected, setSelected] = useState(() => new Map());
    const [selectingAll, setSelectingAll] = useState(false);
    // Snapshot of the selection the merge dialog was opened with — the live
    // selection is cleared after merging while the dialog still shows Undo.
    const [mergingSelected, setMergingSelected] = useState(null);
    const latestRequest = useRef(0);

    const canView = user && hasAnyAccess(user, ["manage_players", "player_view", "player_update"]);
    const canEdit = user && hasAnyAccess(user, ["manage_players", "player_update"]);

    useEffect(() => {
        const t = setTimeout(() => {
            setDebouncedSearch(search.trim());
            setCurrentPage(1);
        }, SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(t);
    }, [search]);

    const fetchPlayers = useCallback(async () => {
        if (!canView) { setLoading(false); return; }
        const requestId = ++latestRequest.current;
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(currentPage), limit: String(PAGE_SIZE), kind });
            if (debouncedSearch) params.set("search", debouncedSearch);
            const res = await fetch(`/api/players/archive?${params}`);
            const data = await res.json();
            if (requestId !== latestRequest.current) return;
            if (!data.success) {
                showError(data.error || "Failed to load archive players");
                return;
            }
            const meta = data.meta || { total: 0, totalPages: 1 };
            // Merging the last record on the last page leaves it empty — step back.
            if ((data.data || []).length === 0 && currentPage > 1 && currentPage > meta.totalPages) {
                setCurrentPage(meta.totalPages);
                return;
            }
            setPlayers(data.data || []);
            setPageMeta({ total: meta.total, totalPages: meta.totalPages });
        } catch {
            if (requestId === latestRequest.current) showError("Failed to load archive players");
        } finally {
            if (requestId === latestRequest.current) setLoading(false);
        }
    }, [canView, currentPage, debouncedSearch, kind, showError]);

    useEffect(() => { fetchPlayers(); }, [fetchPlayers]);

    const changeKind = (value) => {
        setKind(value);
        setCurrentPage(1);
    };

    const toRecord = (p) => ({ _id: String(p._id), name: p.name, organization: p.organization });
    const toggleOne = (p) => {
        setSelected((prev) => {
            const next = new Map(prev);
            if (next.has(String(p._id))) next.delete(String(p._id));
            else if (next.size < MAX_MERGE_SOURCES) next.set(String(p._id), toRecord(p));
            return next;
        });
    };
    const pageAllSelected = players.length > 0 && players.every((p) => selected.has(String(p._id)));
    const togglePage = () => {
        setSelected((prev) => {
            const next = new Map(prev);
            if (pageAllSelected) players.forEach((p) => next.delete(String(p._id)));
            else players.forEach((p) => { if (next.size < MAX_MERGE_SOURCES) next.set(String(p._id), toRecord(p)); });
            return next;
        });
    };
    const clearSelection = () => setSelected(new Map());

    // Every record matching the current search/tab, not just this page.
    const selectAllMatching = async () => {
        setSelectingAll(true);
        try {
            const params = new URLSearchParams({ view: "selection", kind });
            if (debouncedSearch) params.set("search", debouncedSearch);
            const res = await fetch(`/api/players/archive?${params}`);
            const data = await res.json();
            if (!data.success) throw new Error(data.error || "Couldn't select these records");
            // Adds to what's already selected, so "Darkside #56" and
            // "Ragnarok #56" can be merged into the same player together.
            const rows = data.data || [];
            const next = new Map(selected);
            let capped = data.meta?.total > rows.length;
            for (const p of rows) {
                if (next.size >= MAX_MERGE_SOURCES && !next.has(String(p._id))) { capped = true; break; }
                next.set(String(p._id), toRecord(p));
            }
            setSelected(next);
            if (capped) showError(`Up to ${MAX_MERGE_SOURCES} records can be merged at once — some matches weren't selected.`);
        } catch (error) {
            showError(error.message);
        } finally {
            setSelectingAll(false);
        }
    };

    const selectedList = [...selected.values()];
    const afterMerge = () => { clearSelection(); fetchPlayers(); };

    const actions = (p) => canEdit && (
        <>
            <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => setMerging(p)} aria-label={`Merge ${p.name}`}>
                <i className="fa-solid fa-code-merge"></i> Merge
            </button>
            <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => setRenaming(p)} aria-label={`Rename ${p.name}`}>
                <i className="fa-solid fa-pen"></i> Rename
            </button>
        </>
    );

    if (!canView) {
        return (
            <AdminLayout title="Archive Players">
                <div className="admin-empty">
                    <i className="fa-solid fa-lock"></i>
                    <p>You don&apos;t have permission to view players.</p>
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout title="Archive Players">
            <div className="admin-card">
                <div className="admin-card-header" style={{ flexWrap: "wrap", gap: 10 }}>
                    <h3>Archive Players ({pageMeta.total})</h3>
                    <input
                        type="text"
                        className="admin-form-input"
                        placeholder='Search, e.g. "We Da Best #56"'
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{ flex: "1 1 180px", minWidth: 140, maxWidth: 280 }}
                        aria-label="Search archive players"
                    />
                </div>

                <div style={{ padding: "0 20px 12px" }}>
                    <p style={{ fontSize: 13, color: "#5a5f72", margin: "0 0 12px" }}>
                        Players imported from the old XFlag website who aren&apos;t on a current team. Their games and stats
                        are kept. Many old seasons only recorded a jersey number, so those records are named
                        &nbsp;<em>&quot;Team #56 (Season)&quot;</em>. To move every season of one jersey onto the real player,
                        search e.g. <em>Darkside #56</em>, click <strong>Select all matching</strong>, then
                        <strong> Merge selected into a player</strong>. You can also <strong>Rename</strong> a record. Add
                        someone back to a team from that team&apos;s page.
                    </p>
                    <div role="tablist" aria-label="Record type" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {KINDS.map((k) => (
                            <button
                                key={k.value}
                                role="tab"
                                aria-selected={kind === k.value}
                                className={`admin-btn admin-btn-sm ${kind === k.value ? "admin-btn-primary" : "admin-btn-ghost"}`}
                                onClick={() => changeKind(k.value)}
                            >
                                {k.label}
                            </button>
                        ))}
                    </div>
                    {canEdit && (debouncedSearch || selected.size > 0) && (
                        <div className="archive-selection-bar" aria-live="polite">
                            {selected.size > 0 ? (
                                <span><strong>{selected.size}</strong> selected</span>
                            ) : (
                                <span>{pageMeta.total} matching &ldquo;{debouncedSearch}&rdquo;</span>
                            )}
                            {debouncedSearch && pageMeta.total > 0 && (
                                <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={selectAllMatching} disabled={selectingAll || loading}>
                                    <i className="fa-solid fa-check-double"></i>{" "}
                                    {selectingAll ? "Selecting..." : `Select all ${Math.min(pageMeta.total, MAX_MERGE_SOURCES)} matching`}
                                </button>
                            )}
                            {selected.size > 0 && (
                                <>
                                    <button className="admin-btn admin-btn-primary admin-btn-sm" onClick={() => setMergingSelected(selectedList)}>
                                        <i className="fa-solid fa-code-merge"></i> Merge {selected.size} selected into a player
                                    </button>
                                    <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={clearSelection}>Clear</button>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {loading ? (
                    <div className="admin-loading">
                        <div className="admin-spinner"></div>
                        Loading archive players...
                    </div>
                ) : players.length === 0 ? (
                    <div className="admin-empty">
                        <i className="fa-solid fa-box-archive"></i>
                        <p>No archive players found.</p>
                    </div>
                ) : (
                    <>
                        <div className="free-agents-table-wrap">
                            <div style={{ overflowX: "auto" }}>
                                <table className="admin-table">
                                    <thead>
                                        <tr>
                                            {canEdit && (
                                                <th style={{ width: 36 }}>
                                                    <input type="checkbox" checked={pageAllSelected} onChange={togglePage} aria-label="Select every record on this page" />
                                                </th>
                                            )}
                                            <th>Name</th>
                                            <th>History</th>
                                            {isAdmin && <th>Organization</th>}
                                            {canEdit && <th style={{ width: 200 }}>Actions</th>}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {players.map((p) => (
                                            <tr key={p._id}>
                                                {canEdit && (
                                                    <td>
                                                        <input type="checkbox" checked={selected.has(String(p._id))} onChange={() => toggleOne(p)} aria-label={`Select ${p.name}`} />
                                                    </td>
                                                )}
                                                <td style={{ fontWeight: 600 }}>{p.name}</td>
                                                <td style={{ color: "#6b7080", fontSize: 13 }}>{historyLine(p)}</td>
                                                {isAdmin && <td>{p.organization?.name || "—"}</td>}
                                                {canEdit && <td><div style={{ display: "flex", gap: 6 }}>{actions(p)}</div></td>}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="free-agents-card-list">
                            {players.map((p) => (
                                <div key={p._id} className="free-agents-card-item">
                                    <label className="free-agents-card-item-title" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                        {canEdit && <input type="checkbox" checked={selected.has(String(p._id))} onChange={() => toggleOne(p)} />}
                                        {p.name}
                                    </label>
                                    <div className="free-agents-card-item-meta">
                                        <span>{historyLine(p)}</span>
                                        {isAdmin && p.organization?.name && <span><strong>Org:</strong> {p.organization.name}</span>}
                                    </div>
                                    {canEdit && <div className="free-agents-card-item-actions">{actions(p)}</div>}
                                </div>
                            ))}
                        </div>

                        <AdminPagination
                            currentPage={currentPage}
                            totalPages={pageMeta.totalPages}
                            onPageChange={setCurrentPage}
                            totalItems={pageMeta.total}
                            itemsPerPage={PAGE_SIZE}
                        />
                    </>
                )}
            </div>

            {merging && (
                <MergePlayersModal player={merging} startAsSource onClose={() => setMerging(null)} onChanged={afterMerge} />
            )}
            {mergingSelected && (
                <MergePlayersModal
                    player={mergingSelected[0]}
                    initialSources={mergingSelected}
                    onClose={() => setMergingSelected(null)}
                    onChanged={afterMerge}
                />
            )}
            {renaming && (
                <RenameModal player={renaming} onClose={() => setRenaming(null)} onSaved={() => { setRenaming(null); fetchPlayers(); }} />
            )}
        </AdminLayout>
    );
}
