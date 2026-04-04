"use client";

export default function BottomFooter({ onCancel, onComplete, onReset, isPaused }) {
    return (
        <footer className="bottom-footer">
            <ul>
                <li>
                    <button onClick={onCancel} title="Cancel Game" className="footer-btn-cancel">
                        <i className="fa-solid fa-ban"></i>
                    </button>
                </li>
                <li>
                    <button onClick={onComplete} title={isPaused ? "Resume Game" : "Complete Game"} className={`footer-btn-complete${isPaused ? " paused" : ""}`}>
                        <i className={`fa-solid ${isPaused ? "fa-play" : "fa-stop"}`}></i>
                    </button>
                </li>
                <li>
                    <button onClick={onReset} title="Reset Game" className="footer-btn-reset">
                        <i className="fa-solid fa-rotate-right"></i>
                    </button>
                </li>
            </ul>
        </footer>
    );
}
