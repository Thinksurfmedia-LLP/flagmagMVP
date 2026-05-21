"use client";

export default function BottomFooter({ onCancel, onForfeit, onComplete, onReset, isPaused }) {
    return (
        <footer className="bottom-footer">
            <div className="footer-actions">
                <button onClick={onCancel} className="footer-btn footer-btn-cancel">
                    <i className="fa-solid fa-ban"></i>
                    <span>Cancel Game</span>
                </button>
                <button onClick={onForfeit} className="footer-btn footer-btn-forfeit">
                    <i className="fa-solid fa-flag"></i>
                    <span>Forfeit</span>
                </button>
                <button onClick={onComplete} className={`footer-btn footer-btn-complete${isPaused ? " paused" : ""}`}>
                    <i className={`fa-solid ${isPaused ? "fa-play" : "fa-stop"}`}></i>
                    <span>{isPaused ? "Resume Game" : "End Game"}</span>
                </button>
                <button onClick={onReset} className="footer-btn footer-btn-reset">
                    <i className="fa-solid fa-rotate-right"></i>
                    <span>Reset Stats</span>
                </button>
            </div>
        </footer>
    );
}
