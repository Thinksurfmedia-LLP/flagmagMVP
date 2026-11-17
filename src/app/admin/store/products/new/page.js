"use client";

import { useRouter } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import { useAuth } from "@/components/AuthProvider";
import ProductForm from "@/components/store/admin/ProductForm";

export default function NewStoreProductPage() {
    const { user } = useAuth();
    const router = useRouter();

    if (user?.role !== "admin") {
        return (
            <AdminLayout title="New Product">
                <div className="admin-empty">
                    <i className="fa-solid fa-lock"></i>
                    <p>You don&apos;t have permission to manage store products.</p>
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout title="New Product">
            <ProductForm initial={null} onSaved={(product) => router.push(`/admin/store/products/${product._id}`)} />
        </AdminLayout>
    );
}
