"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import AdminLayout, { hasAccess } from "@/components/AdminLayout";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/AdminToast";

export default function AdminPlayersPage() {
    const { user } = useAuth();
    const [players, setPlayers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const { showSuccess, showError } = useToast();

    const fetchPlayers = useCallback(async () => {
        try {
            const res = await fetch("/api/players?status=player");
            const data = await res.json();
            if (data.success) setPlayers(data.data);
        } catch { showError("Failed to load players"); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchPlayers(); }, [fetchPlayers]);

    const deletePlayer = async (id) => {
        if (!confirm("Delete this player?")) return;
        try {
            const res = await fetch(`/api/players/${id}`, { method: "DELETE" });
            const data = await res.json();
            if (!data.success) { showError(data.error); return; }
            fetchPlayers();
            showSuccess("Player deleted!");
        } catch { showError("Failed to delete player"); }
    };

    const filtered = players.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.presentTeam?.name || "").toLowerCase().includes(search.toLowerCase())
    );

    const canManage = user && hasAccess(user, "manage_players");

    return (
        <AdminLayout title="Players">
            {!canManage ? (
                <div className="admin-empty">
                    <i className="fa-solid fa-lock"></i>
                    <p>You don&apos;t have permission to manage players.</p>
                </div>
            ) : (
                <>
                    <div className="admin-card">
                        <div className="admin-card-header">
                            <h3>Players ({filtered.length})</h3>
                            <input
                                type="text"
                                className="admin-form-input"
                                placeholder="Search players..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                style={{ maxWidth: 260 }}
                            />
                        </div>

                        {loading ? (
                            <div className="admin-loading">
                                <div className="admin-spinner"></div>
                                Loading players...
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="admin-empty">
                                <i className="fa-solid fa-users"></i>
                                <p>No players found.</p>
                            </div>
                        ) : (
                            <div style={{ overflowX: "auto" }}>
                                <table className="admin-table">
                                    <thead>
                                        <tr>
                                            <th>Name</th>
                                            <th>Team</th>
                                            <th>Rating</th>
                                            <th>Location</th>
                                            <th>Joined</th>
                                            <th style={{ width: 120 }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filtered.map(p => (
                                            <tr key={p._id}>
                                                <td style={{ fontWeight: 600 }}>{p.name}</td>
                                                <td>{p.presentTeam?.name || "—"}</td>
                                                <td>⭐ {p.overallRating || p.rating || 0}</td>
                                                <td style={{ color: "rgba(255,255,255,0.5)" }}>{p.location || "—"}</td>
                                                <td style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>
                                                    {p.joinYear || "—"}
                                                </td>
                                                <td>
                                                    <div style={{ display: "flex", gap: 6 }}>
                                                        <Link href={`/players/${p._id}`} className="admin-btn admin-btn-ghost admin-btn-sm">
                                                            <i className="fa-solid fa-eye"></i>
                                                        </Link>
                                                        <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => deletePlayer(p._id)}>
                                                            <i className="fa-solid fa-trash"></i>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}
        </AdminLayout>
    );
}
