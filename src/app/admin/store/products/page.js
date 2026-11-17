"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import AdminPagination from "@/components/AdminPagination";
import ConfirmModal from "@/components/ConfirmModal";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/AdminToast";
import { formatPrice, stockState } from "@/lib/store/pricing";

const PAGE_SIZE = 12;
const STATUS_COLORS = { active: "#16a34a", draft: "#d97706", archived: "#6b7280" };
const STOCK_LABELS = { in_stock: ["In stock", "#16a34a"], low: ["Low stock", "#d97706"], out: ["Out of stock", "#dc2626"] };

const pill = (label, color) => (
    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600, color, border: `1px solid ${color}` }}>
        {label}
    </span>
);

export default function StoreProductsPage() {
    const { user } = useAuth();
    const router = useRouter();
    const { showSuccess, showError } = useToast();
    const isAdmin = user?.role === "admin";

    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [meta, setMeta] = useState({ total: 0, page: 1, pageCount: 1 });
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState("");
    const [category, setCategory] = useState("");
    const [searchInput, setSearchInput] = useState("");
    const [q, setQ] = useState("");
    const [page, setPage] = useState(1);
    const [archiveTarget, setArchiveTarget] = useState(null);
    const [archiving, setArchiving] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => { setQ(searchInput.trim()); setPage(1); }, 300);
        return () => clearTimeout(timer);
    }, [searchInput]);

    useEffect(() => {
        if (!isAdmin) return;
        fetch("/api/store/categories")
            .then((r) => r.json())
            .then((d) => d.success && setCategories(d.data || []))
            .catch(() => {});
    }, [isAdmin]);

    const fetchProducts = useCallback(async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({ scope: "admin", page: String(page) });
            if (status) params.set("status", status);
            if (category) params.set("category", category);
            if (q) params.set("q", q);
            const res = await fetch(`/api/store/products?${params}`);
            const data = await res.json();
            if (data.success) {
                setProducts(data.data || []);
                setMeta(data.meta || { total: 0, page: 1, pageCount: 1 });
            } else {
                showError(data.error || "Failed to load products");
            }
        } catch {
            showError("Failed to load products");
        } finally {
            setLoading(false);
        }
    }, [status, category, q, page, showError]);

    useEffect(() => { if (isAdmin) fetchProducts(); }, [isAdmin, fetchProducts]);

    const handleArchive = async () => {
        if (!archiveTarget) return;
        setArchiving(true);
        try {
            const res = await fetch(`/api/store/products/${archiveTarget._id}`, { method: "DELETE" });
            const data = await res.json();
            if (data.success) {
                showSuccess("Product archived");
                fetchProducts();
            } else {
                showError(data.error || "Archive failed");
            }
        } catch {
            showError("Archive failed");
        } finally {
            setArchiving(false);
            setArchiveTarget(null);
        }
    };

    const changeFilter = (setter) => (e) => { setter(e.target.value); setPage(1); };

    if (!isAdmin) {
        return (
            <AdminLayout title="Store Products">
                <div className="admin-empty">
                    <i className="fa-solid fa-lock"></i>
                    <p>You don&apos;t have permission to manage store products.</p>
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout title="Store Products">
            <div className="admin-card">
                <div className="admin-card-header">
                    <h3>Products ({meta.total})</h3>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <input aria-label="Search products" className="admin-form-input" placeholder="Search..." value={searchInput} onChange={(e) => setSearchInput(e.target.value)} style={{ width: 180, height: 36, fontSize: 13 }} />
                        <select aria-label="Filter by status" className="admin-form-select" value={status} onChange={changeFilter(setStatus)} style={{ width: 130, height: 36, fontSize: 13 }}>
                            <option value="">All statuses</option>
                            <option value="draft">Draft</option>
                            <option value="active">Active</option>
                            <option value="archived">Archived</option>
                        </select>
                        <select aria-label="Filter by category" className="admin-form-select" value={category} onChange={changeFilter(setCategory)} style={{ width: 160, height: 36, fontSize: 13 }}>
                            <option value="">All categories</option>
                            {categories.map((c) => <option key={c._id} value={c.slug}>{c.name}</option>)}
                        </select>
                        <Link className="admin-btn admin-btn-primary" href="/admin/store/products/new">
                            <i className="fa-solid fa-plus"></i> Add Product
                        </Link>
                    </div>
                </div>

                {loading ? (
                    <div className="admin-loading"><div className="admin-spinner"></div>Loading products...</div>
                ) : products.length === 0 ? (
                    <div className="admin-empty">
                        <i className="fa-solid fa-shirt"></i>
                        <p>No products found.</p>
                    </div>
                ) : (
                    <div style={{ overflowX: "auto" }}>
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th style={{ width: 70 }}>Image</th>
                                    <th>Name</th>
                                    <th>Category</th>
                                    <th>Price</th>
                                    <th>Stock</th>
                                    <th>Status</th>
                                    <th>Updated</th>
                                    <th style={{ width: 100 }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {products.map((p) => {
                                    const stock = stockState(p.variants || []);
                                    const [stockLabel, stockColor] = STOCK_LABELS[stock.state];
                                    return (
                                        <tr key={p._id} style={{ cursor: "pointer" }} onClick={() => router.push(`/admin/store/products/${p._id}`)}>
                                            <td>
                                                {p.images?.[0]
                                                    ? <img src={p.images[0]} alt="" style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 4 }} />
                                                    : <span style={{ color: "#bbb" }}>—</span>}
                                            </td>
                                            <td style={{ fontWeight: 600 }}>{p.name}</td>
                                            <td>{p.category?.name || "—"}</td>
                                            <td>
                                                {formatPrice(p.price)}
                                                {p.compareAtPrice != null && (
                                                    <span style={{ marginLeft: 6, color: "#8b90a0", textDecoration: "line-through", fontSize: 12 }}>{formatPrice(p.compareAtPrice)}</span>
                                                )}
                                            </td>
                                            <td>{stock.total} {pill(stockLabel, stockColor)}</td>
                                            <td>{pill(p.status, STATUS_COLORS[p.status] || "#6b7280")}</td>
                                            <td>{p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : "—"}</td>
                                            <td onClick={(e) => e.stopPropagation()}>
                                                <div style={{ display: "flex", gap: 6 }}>
                                                    <Link className="admin-btn admin-btn-ghost admin-btn-sm" title="Edit" aria-label={`Edit ${p.name}`} href={`/admin/store/products/${p._id}`}>
                                                        <i className="fa-solid fa-pen"></i>
                                                    </Link>
                                                    {p.status !== "archived" && (
                                                        <button className="admin-btn admin-btn-danger admin-btn-sm" title="Archive" aria-label={`Archive ${p.name}`} onClick={() => setArchiveTarget(p)}>
                                                            <i className="fa-solid fa-box-archive"></i>
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <AdminPagination currentPage={meta.page} totalPages={meta.pageCount} totalItems={meta.total} itemsPerPage={PAGE_SIZE} onPageChange={setPage} />

            <ConfirmModal
                open={!!archiveTarget}
                title="Archive product?"
                message={archiveTarget ? `"${archiveTarget.name}" will be hidden from the store. You can re-activate it from its edit page.` : ""}
                confirmLabel="Archive"
                confirming={archiving}
                onConfirm={handleArchive}
                onCancel={() => !archiving && setArchiveTarget(null)}
            />
        </AdminLayout>
    );
}
