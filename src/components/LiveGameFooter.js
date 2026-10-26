"use client";

import { ResumeGameButton } from "@/components/LiveTimeouts";

/**
 * Footer of the Live Stats modal. The four game actions are always shown;
 * during a timeout "Resume Game" takes End Game's place, so a game can only
 * be ended once it has been resumed.
 */
export default function LiveGameFooter({ status, isPaused, onClose, onCancelGame, onForfeit, onResetStats, onEndGame, onResume }) {
    const isCancelled = status === "cancelled";
    const isCompleted = status === "completed";
    return (
        <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #e8eaef", paddingTop: 16, flexWrap: "wrap" }}>
            <button className="admin-btn admin-btn-ghost" onClick={onClose}>Close</button>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                <button
                    className="admin-btn admin-btn-ghost"
                    onClick={onCancelGame}
                    disabled={isCancelled}
                    title={isCancelled ? "This game is already cancelled" : undefined}
                    style={{ color: "#dc2626" }}
                >
                    <i className="fa-solid fa-ban"></i> Cancel Game
                </button>
                <button className="admin-btn admin-btn-ghost" onClick={onForfeit} style={{ color: "#dc2626" }}>
                    <i className="fa-solid fa-flag"></i> Forfeit
                </button>
                <button className="admin-btn admin-btn-ghost" onClick={onResetStats}>
                    <i className="fa-solid fa-rotate-right"></i> Reset Stats
                </button>
                {isPaused ? (
                    <ResumeGameButton onResume={onResume} />
                ) : (
                    <button
                        className="admin-btn admin-btn-danger"
                        onClick={onEndGame}
                        disabled={isCompleted}
                        title={isCompleted ? "This game is already completed" : undefined}
                    >
                        <i className="fa-solid fa-flag-checkered"></i> End Game
                    </button>
                )}
            </div>
        </div>
    );
}
