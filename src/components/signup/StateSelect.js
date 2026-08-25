"use client";

import SearchableSelect from "@/components/SearchableSelect";
import { US_STATES } from "@/lib/usGeoData";

const STATE_OPTIONS = US_STATES.map((s) => ({ value: s.abbr, label: s.name }));

export default function StateSelect({ value, onChange, placeholder = "Select State" }) {
    return <SearchableSelect value={value} onChange={onChange} options={STATE_OPTIONS} placeholder={placeholder} dark />;
}
