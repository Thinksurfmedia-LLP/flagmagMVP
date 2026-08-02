"use client";

export default function BottomFooter({ onCancel, onForfeit, onComplete, onResume, onReset, isPaused }) {
    return (
        <footer className="bottom-footer">
            {isPaused && (
                <button onClick={onResume} className="footer-btn footer-btn-resume-banner">
                    <i className="fa-solid fa-play"></i>
                    <span>Resume Game</span>
                </button>
            )}
            <div className="footer-actions">
                <button onClick={onCancel} className="footer-btn footer-btn-cancel">
                    <i className="fa-solid fa-ban"></i>
                    <span>Cancel Game</span>
                </button>
                <button onClick={onForfeit} className="footer-btn footer-btn-forfeit">
                    <i className="fa-solid fa-flag"></i>
                    <span>Forfeit</span>
                </button>
                <button onClick={onComplete} className="footer-btn footer-btn-complete">
                    <i className="fa-solid fa-stop"></i>
                    <span>End Game</span>
                </button>
                <button onClick={onReset} className="footer-btn footer-btn-reset">
                    <i className="fa-solid fa-rotate-right"></i>
                    <span>Reset Stats</span>
                </button>
            </div>
        </footer>
    );
}
