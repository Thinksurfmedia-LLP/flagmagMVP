"use client";

import { useState } from "react";
import ContactOrgModal from "@/components/ContactOrgModal";

export default function ContactOrgButton({ org }) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            <ContactOrgModal isOpen={isOpen} onClose={() => setIsOpen(false)} org={org} />
            <button type="button" onClick={() => setIsOpen(true)} className="btn btn-info-primary">
                Contact Now
            </button>
        </>
    );
}
