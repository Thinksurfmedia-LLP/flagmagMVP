"use client";

// Reusable stand-in for window.confirm() styled to match the rest of the
// admin UI. Renders nothing when closed so callers can mount it
// unconditionally and just flip `open`.
export default function ConfirmModal({
    open,
    title = "Are you sure?",
    message,
    confirmLabel = "Delete",
    cancelLabel = "Cancel",
    danger = true,
    confirming = false,
    onConfirm,
    onCancel,
}) {
    if (!open) return null;

    return (
        <div className="admin-modal-backdrop" onClick={onCancel}>
            <div className="admin-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
                <button className="admin-modal-close" onClick={onCancel} aria-label="Close">
                    <i className="fa-solid fa-xmark"></i>
                </button>
                <h3 className="admin-modal-title">
                    {danger && <i className="fa-solid fa-triangle-exclamation" style={{ color: "#dc2626", marginRight: 8 }}></i>}
                    {title}
                </h3>
                {message && <p style={{ fontSize: 14, color: "#5a5f72", margin: "0 0 20px" }}>{message}</p>}
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                    <button type="button" className="admin-btn admin-btn-ghost" onClick={onCancel} disabled={confirming}>
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        className={`admin-btn ${danger ? "admin-btn-danger" : "admin-btn-primary"}`}
                        onClick={onConfirm}
                        disabled={confirming}
                    >
                        {confirming ? "Deleting..." : confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
