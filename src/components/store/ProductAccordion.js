// The template's `.accordion#accordionExample`; Bootstrap's global bundle drives the collapse.

const EMPTY_TEXT = "Details coming soon.";
const PARENT_ID = "accordionExample";

/** @param {{ details?: string, specsCare?: string, refundPolicy?: string }} props */
export default function ProductAccordion({ details, specsCare, refundPolicy }) {
    const items = [
        { id: "collapseOne", title: "Product Details", text: details, isOpen: true },
        { id: "collapseTwo", title: "Specs & Care", text: specsCare, isOpen: false },
        { id: "collapseThree", title: "Refund Policy", text: refundPolicy, isOpen: false },
    ];

    return (
        <div className="accordion" id={PARENT_ID}>
            {items.map(({ id, title, text, isOpen }) => (
                <div className="accordion-item" key={id}>
                    <h2 className="accordion-header">
                        <button
                            className={`accordion-button${isOpen ? "" : " collapsed"}`}
                            type="button"
                            data-bs-toggle="collapse"
                            data-bs-target={`#${id}`}
                            aria-expanded={isOpen}
                            aria-controls={id}
                        >
                            {title}
                        </button>
                    </h2>
                    <div id={id} className={`accordion-collapse collapse${isOpen ? " show" : ""}`} data-bs-parent={`#${PARENT_ID}`}>
                        <div className="accordion-body">
                            <p style={{ whiteSpace: "pre-line" }}>{text || EMPTY_TEXT}</p>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
