"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import { useAuth } from "@/components/AuthProvider";
import { useImpersonation } from "@/components/ImpersonationProvider";

export default function OrgDashboardPage() {
    const { slug } = useParams();
    const router = useRouter();
    const { user } = useAuth();
    const { org, enterImpersonation } = useImpersonation();

    /* If the user navigates here directly (e.g. page refresh), re-hydrate the impersonation context */
    useEffect(() => {
        if (!org && user) {
            (async () => {
                try {
                    const res = await fetch(`/api/organizations/${slug}`);
                    const data = await res.json();
                    if (data.success) {
                        enterImpersonation(data.data);
                    } else {
                        router.replace("/admin/organizations");
                    }
                } catch {
                    router.replace("/admin/organizations");
                }
            })();
        }
    }, [org, user, slug, enterImpersonation, router]);

    const orgName = org?.name || slug;

    return (
        <AdminLayout title={orgName}>
            <div className="admin-card">
                <div className="admin-card-header">
                    <h3>
                        <i className="fa-solid fa-building" style={{ marginRight: 8, color: "#FF1E00" }}></i>
                        {orgName} — Organization Dashboard
                    </h3>
                </div>
                <div className="admin-card-body">
                    <div className="admin-empty">
                        <i className="fa-solid fa-toolbox"></i>
                        <p>
                            Welcome to the organizer view for <strong>{orgName}</strong>.<br />
                            Season management, player management, game scheduling and more will be available here soon.
                        </p>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}
