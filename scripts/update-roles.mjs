/**
 * Update roles script to add schedule permissions to Admin and Organizer roles
 * 
 * Usage: node scripts/update-roles.mjs
 */

import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/flagmag";

const RoleSchema = new mongoose.Schema(
    {
        name: String,
        slug: String,
        permissions: [String],
        isSystem: Boolean,
    },
    { timestamps: true }
);

async function updateRoles() {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(MONGODB_URI);
        console.log("Connected successfully\n");

        const Role = mongoose.model("Role", RoleSchema);

        // Schedule permissions to add
        const schedulePermissions = [
            "manage_schedules",
            "schedule_view",
            "schedule_create",
            "schedule_update",
            "schedule_delete",
        ];

        // Update Admin role
        const adminRole = await Role.findOne({ slug: "admin" });
        if (adminRole) {
            const hasSchedulePerms = adminRole.permissions.includes("manage_schedules");
            if (!hasSchedulePerms) {
                // Add schedule permissions after season permissions
                const seasonIndex = adminRole.permissions.indexOf("season_delete");
                if (seasonIndex !== -1) {
                    adminRole.permissions.splice(seasonIndex + 1, 0, ...schedulePermissions);
                } else {
                    adminRole.permissions.push(...schedulePermissions);
                }
                await adminRole.save();
                console.log("✓ Updated Admin role with schedule permissions");
            } else {
                console.log("✓ Admin role already has schedule permissions");
            }
        } else {
            console.log("✗ Admin role not found");
        }

        // Update Organizer role
        const organizerRole = await Role.findOne({ slug: "organizer" });
        if (organizerRole) {
            const hasSchedulePerms = organizerRole.permissions.includes("manage_schedules");
            if (!hasSchedulePerms) {
                // Add schedule permissions after season permissions
                const seasonIndex = organizerRole.permissions.indexOf("season_delete");
                if (seasonIndex !== -1) {
                    organizerRole.permissions.splice(seasonIndex + 1, 0, ...schedulePermissions);
                } else {
                    organizerRole.permissions.push(...schedulePermissions);
                }
                await organizerRole.save();
                console.log("✓ Updated Organizer role with schedule permissions");
            } else {
                console.log("✓ Organizer role already has schedule permissions");
            }
        } else {
            console.log("✗ Organizer role not found");
        }

        console.log("\n✓ Role update completed successfully!");
        
    } catch (error) {
        console.error("Error updating roles:", error);
    } finally {
        await mongoose.connection.close();
        console.log("Database connection closed");
    }
}

updateRoles();
