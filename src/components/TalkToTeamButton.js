"use client";

import { useState } from "react";
import BookDemoModal from "@/components/BookDemoModal";

export default function TalkToTeamButton() {
    const [demoOpen, setDemoOpen] = useState(false);
    return (
        <>
            <BookDemoModal isOpen={demoOpen} onClose={() => setDemoOpen(false)} />
            <button
                onClick={() => setDemoOpen(true)}
                className="btn btn-primary btn-with-arrow"
            >
                Talk to Our Team <span><img src="/assets/images/btn-arrow.png" alt="" /></span>
            </button>
        </>
    );
}
