"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import { useAuth } from "@/components/AuthProvider";
import ProductForm from "@/components/store/admin/ProductForm";

export default function EditStoreProductPage() {
    const { user } = useAuth();
    const { id } = useParams();
    const isAdmin = user?.role === "admin";

    const [product, setProduct] = useState(null);
    const [state, setState] = useState("loading"); // loading | ready | notFound | error
    const [formKey, setFormKey] = useState(0);

    useEffect(() => {
        if (!isAdmin || !id) return;
        let cancelled = false;
        fetch(`/api/store/products/${id}`)
            .then(async (res) => {
                const data = await res.json().catch(() => null);
                if (cancelled) return;
                if (res.ok && data?.success) {
                    setProduct(data.data);
                    setState("ready");
                } else {
                    setState(res.status === 404 ? "notFound" : "error");
                }
            })
            .catch(() => !cancelled && setState("error"));
        return () => { cancelled = true; };
    }, [isAdmin, id]);

    // Re-seed the form from the saved product so the page shows what the server stored
    // (e.g. a compare-at price at or below price comes back empty).
    const handleSaved = (saved) => {
        setProduct(saved);
        setFormKey((k) => k + 1);
    };

    if (!isAdmin) {
        return (
            <AdminLayout title="Edit Product">
                <div className="admin-empty">
                    <i className="fa-solid fa-lock"></i>
                    <p>You don&apos;t have permission to manage store products.</p>
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout title="Edit Product">
            {state === "loading" && <div className="admin-loading"><div className="admin-spinner"></div>Loading product...</div>}
            {state === "notFound" && (
                <div className="admin-empty">
                    <i className="fa-solid fa-box-open"></i>
                    <p>Product not found.</p>
                    <Link className="admin-btn admin-btn-ghost" href="/admin/store/products">Back to products</Link>
                </div>
            )}
            {state === "error" && (
                <div className="admin-empty">
                    <i className="fa-solid fa-triangle-exclamation"></i>
                    <p>Failed to load the product.</p>
                    <Link className="admin-btn admin-btn-ghost" href="/admin/store/products">Back to products</Link>
                </div>
            )}
            {state === "ready" && <ProductForm key={formKey} initial={product} onSaved={handleSaved} />}
        </AdminLayout>
    );
}
