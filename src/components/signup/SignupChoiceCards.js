"use client";

import { useState } from "react";
import Link from "next/link";

const CHOICES = [
    {
        href: "/signup/free-agent",
        icon: "fa-solid fa-user-plus",
        title: "Free Agent",
        description: "Join a league's free-agent pool and get drafted.",
    },
    {
        href: "/signup/team",
        icon: "fa-solid fa-people-group",
        title: "Team",
        description: "Register your squad and manage your roster.",
    },
    {
        href: "/signup/payment",
        icon: "fa-solid fa-hand-holding-dollar",
        title: "Custom Payment",
        description: "Pay dues, a fee, or a contribution — any amount.",
    },
];

export default function SignupChoiceCards({ orgSlug = "" }) {
    const [hovered, setHovered] = useState(null);
    const orgQuery = orgSlug ? `?org=${encodeURIComponent(orgSlug)}` : "";

    return (
        <div
            style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "center",
                gap: "24px",
            }}
        >
            {CHOICES.map((choice, i) => {
                const isHovered = hovered === i;
                return (
                    <Link
                        key={choice.href}
                        href={`${choice.href}${orgQuery}`}
                        onMouseEnter={() => setHovered(i)}
                        onMouseLeave={() => setHovered(null)}
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            textAlign: "center",
                            width: "200px",
                            padding: "32px 20px",
                            borderRadius: "20px",
                            textDecoration: "none",
                            background: isHovered ? "rgba(255, 30, 0, 0.14)" : "rgba(255, 255, 255, 0.07)",
                            border: `1px solid ${isHovered ? "#FF1E00" : "rgba(255, 255, 255, 0.16)"}`,
                            backdropFilter: "blur(14px)",
                            WebkitBackdropFilter: "blur(14px)",
                            boxShadow: isHovered ? "0 16px 36px rgba(255, 30, 0, 0.28)" : "0 8px 24px rgba(0, 0, 0, 0.25)",
                            transform: isHovered ? "translateY(-6px)" : "translateY(0)",
                            transition: "border-color 0.2s, box-shadow 0.2s, transform 0.2s, background 0.2s",
                        }}
                    >
                        <span
                            style={{
                                width: "64px",
                                height: "64px",
                                borderRadius: "18px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                background: isHovered ? "#FF1E00" : "rgba(255, 30, 0, 0.85)",
                                color: "#fff",
                                fontSize: "24px",
                                marginBottom: "18px",
                                boxShadow: "0 6px 16px rgba(255, 30, 0, 0.35)",
                                transition: "background 0.2s",
                            }}
                        >
                            <i className={choice.icon}></i>
                        </span>
                        <span style={{ fontWeight: 700, fontSize: "17px", color: "#fff", marginBottom: "6px" }}>
                            {choice.title}
                        </span>
                        <span style={{ fontSize: "13px", color: "rgba(255, 255, 255, 0.72)", lineHeight: 1.45 }}>
                            {choice.description}
                        </span>
                    </Link>
                );
            })}
        </div>
    );
}
