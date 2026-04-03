import React from 'react';

export default function AdminPagination({ currentPage, totalPages, onPageChange, totalItems, itemsPerPage }) {
    if (totalPages <= 1) return null;

    // Helper to generate page numbers with ellipses
    const getPageNumbers = () => {
        const pages = [];
        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            if (currentPage <= 4) {
                for (let i = 1; i <= 5; i++) pages.push(i);
                pages.push('...');
                pages.push(totalPages);
            } else if (currentPage >= totalPages - 3) {
                pages.push(1);
                pages.push('...');
                for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
            } else {
                pages.push(1);
                pages.push('...');
                pages.push(currentPage - 1);
                pages.push(currentPage);
                pages.push(currentPage + 1);
                pages.push('...');
                pages.push(totalPages);
            }
        }
        return pages;
    };

    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalItems);

    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, padding: '0 8px', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ fontSize: 13, color: '#5a5f72' }}>
                Showing {startItem}-{endItem} of {totalItems}
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
                <button
                    className="admin-btn admin-btn-ghost admin-btn-sm"
                    style={{ padding: '4px 8px', minWidth: 32 }}
                    disabled={currentPage === 1}
                    onClick={() => onPageChange(currentPage - 1)}
                >
                    <i className="fa-solid fa-chevron-left"></i>
                </button>
                {getPageNumbers().map((page, index) => (
                    page === '...' ? (
                        <span key={`ellipsis-${index}`} style={{ display: 'inline-flex', alignItems: 'center', padding: '0 8px', color: '#8b90a0' }}>...</span>
                    ) : (
                        <button
                            key={page}
                            className={`admin-btn admin-btn-sm ${currentPage === page ? 'admin-btn-primary' : 'admin-btn-ghost'}`}
                            style={{ padding: '4px 8px', minWidth: 32 }}
                            onClick={() => onPageChange(page)}
                        >
                            {page}
                        </button>
                    )
                ))}
                <button
                    className="admin-btn admin-btn-ghost admin-btn-sm"
                    style={{ padding: '4px 8px', minWidth: 32 }}
                    disabled={currentPage === totalPages}
                    onClick={() => onPageChange(currentPage + 1)}
                >
                    <i className="fa-solid fa-chevron-right"></i>
                </button>
            </div>
        </div>
    );
}
