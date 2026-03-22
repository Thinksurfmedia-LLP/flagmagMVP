"use client";

export default function BottomFooter({ onUndo, onInfo, onStart, onConfirm, onReload }) {
    return (
        <footer className="bottom-footer">
            <ul>
                <li>
                    <button onClick={onUndo} title="Undo">
                        <img src="/assets/images/icon-reply.png" alt="Undo" />
                    </button>
                </li>
                <li>
                    <button onClick={onInfo} title="Info">
                        <img src="/assets/images/icon-info.png" alt="Info" />
                    </button>
                </li>
                <li>
                    <button onClick={onStart} title="Start">
                        <img src="/assets/images/icon-start.png" alt="Start" />
                    </button>
                </li>
                <li>
                    <button onClick={onConfirm} title="Confirm">
                        <img src="/assets/images/icon-tick.png" alt="Confirm" />
                    </button>
                </li>
                <li>
                    <button onClick={onReload} title="Reload">
                        <img src="/assets/images/icon-reload.png" alt="Reload" />
                    </button>
                </li>
            </ul>
        </footer>
    );
}
