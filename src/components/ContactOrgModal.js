"use client";

export default function ContactOrgModal({ isOpen, onClose, org }) {
    if (!isOpen) return null;

    const { phone, email, website } = org?.contactInfo || {};
    const { facebook, twitter, instagram, youtube, tiktok, linkedin, threads } = org?.socialLinks || {};
    const customLinks = (org?.customSocialLinks || []).filter((l) => l.url);

    const hasContact = phone || email || website;
    const hasSocial = facebook || twitter || instagram || youtube || tiktok || linkedin || threads || customLinks.length > 0;

    return (
        <div className="book-demo-overlay" onClick={onClose}>
            <div className="book-demo-modal org-contact-modal" onClick={(e) => e.stopPropagation()}>
                <button className="book-demo-close" onClick={onClose} aria-label="Close">
                    <i className="fa-solid fa-xmark"></i>
                </button>

                <div className="book-demo-header">
                    <h3>Contact {org?.name}</h3>
                </div>

                {hasContact ? (
                    <ul className="org-contact-list">
                        {phone && (
                            <li>
                                <a href={`tel:${phone}`}>
                                    <i className="fa-solid fa-phone"></i> {phone}
                                </a>
                            </li>
                        )}
                        {email && (
                            <li>
                                <a href={`mailto:${email}`}>
                                    <i className="fa-regular fa-envelope"></i> {email}
                                </a>
                            </li>
                        )}
                        {website && (
                            <li>
                                <a href={website} target="_blank" rel="noopener noreferrer">
                                    <i className="fa-solid fa-globe"></i> {website}
                                </a>
                            </li>
                        )}
                    </ul>
                ) : (
                    <p className="org-contact-empty">No contact details available yet.</p>
                )}

                {hasSocial && (
                    <ul className="org-contact-social">
                        {facebook && (
                            <li>
                                <a href={facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook">
                                    <i className="fa-brands fa-facebook-f"></i>
                                </a>
                            </li>
                        )}
                        {twitter && (
                            <li>
                                <a href={twitter} target="_blank" rel="noopener noreferrer" aria-label="Twitter">
                                    <i className="fa-brands fa-x-twitter"></i>
                                </a>
                            </li>
                        )}
                        {instagram && (
                            <li>
                                <a href={instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram">
                                    <i className="fa-brands fa-instagram"></i>
                                </a>
                            </li>
                        )}
                        {youtube && (
                            <li>
                                <a href={youtube} target="_blank" rel="noopener noreferrer" aria-label="YouTube">
                                    <i className="fa-brands fa-youtube"></i>
                                </a>
                            </li>
                        )}
                        {tiktok && (
                            <li>
                                <a href={tiktok} target="_blank" rel="noopener noreferrer" aria-label="TikTok">
                                    <i className="fa-brands fa-tiktok"></i>
                                </a>
                            </li>
                        )}
                        {linkedin && (
                            <li>
                                <a href={linkedin} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
                                    <i className="fa-brands fa-linkedin"></i>
                                </a>
                            </li>
                        )}
                        {threads && (
                            <li>
                                <a href={threads} target="_blank" rel="noopener noreferrer" aria-label="Threads">
                                    <i className="fa-brands fa-threads"></i>
                                </a>
                            </li>
                        )}
                        {customLinks.map((link, i) => (
                            <li key={i}>
                                <a href={link.url} target="_blank" rel="noopener noreferrer" aria-label={link.label || "Social link"} title={link.label}>
                                    {link.icon ? (
                                        link.icon.trim().startsWith("fa-")
                                            ? <i className={link.icon}></i>
                                            : <img src={link.icon} alt="" />
                                    ) : (
                                        <i className="fa-solid fa-link"></i>
                                    )}
                                </a>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
