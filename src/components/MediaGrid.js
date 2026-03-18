"use client";

import { useState } from "react";

export default function MediaGrid({ images = [] }) {
    const [lightboxIdx, setLightboxIdx] = useState(null);

    if (!images.length) {
        return <div className="media-item"><p>No media available.</p></div>;
    }

    return (
        <>
            <div className="media-item">
                <div className="row g-4">
                    {images.map((url, i) => (
                        <div className="col-sm-6 col-lg-4 col-xxl-3" key={i}>
                            <a
                                href={url}
                                onClick={(e) => { e.preventDefault(); setLightboxIdx(i); }}
                                style={{ cursor: "pointer" }}
                            >
                                <img src={url} alt={`Media ${i + 1}`} />
                            </a>
                        </div>
                    ))}
                </div>
            </div>

            {lightboxIdx !== null && (
                <div
                    style={{
                        position: "fixed", inset: 0, zIndex: 99999,
                        background: "rgba(0,0,0,0.92)", display: "flex",
                        alignItems: "center", justifyContent: "center",
                    }}
                    onClick={() => setLightboxIdx(null)}
                >
                    <button
                        onClick={() => setLightboxIdx(null)}
                        style={{
                            position: "absolute", top: 20, right: 20, background: "none",
                            border: "none", color: "#fff", fontSize: 32, cursor: "pointer", zIndex: 10,
                        }}
                    >&times;</button>

                    {images.length > 1 && (
                        <>
                            <button
                                onClick={(e) => { e.stopPropagation(); setLightboxIdx((lightboxIdx - 1 + images.length) % images.length); }}
                                style={{
                                    position: "absolute", left: 20, top: "50%", transform: "translateY(-50%)",
                                    background: "rgba(255,255,255,0.15)", border: "none", color: "#fff",
                                    fontSize: 28, width: 48, height: 48, borderRadius: "50%", cursor: "pointer", zIndex: 10,
                                }}
                            >&#8249;</button>
                            <button
                                onClick={(e) => { e.stopPropagation(); setLightboxIdx((lightboxIdx + 1) % images.length); }}
                                style={{
                                    position: "absolute", right: 20, top: "50%", transform: "translateY(-50%)",
                                    background: "rgba(255,255,255,0.15)", border: "none", color: "#fff",
                                    fontSize: 28, width: 48, height: 48, borderRadius: "50%", cursor: "pointer", zIndex: 10,
                                }}
                            >&#8250;</button>
                        </>
                    )}

                    <img
                        src={images[lightboxIdx]}
                        alt=""
                        onClick={(e) => e.stopPropagation()}
                        style={{ maxWidth: "90vw", maxHeight: "85vh", objectFit: "contain", borderRadius: 8 }}
                    />
                </div>
            )}
        </>
    );
}
