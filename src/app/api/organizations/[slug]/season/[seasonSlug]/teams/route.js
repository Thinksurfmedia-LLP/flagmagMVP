import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Organization from "@/models/Organization";
import League from "@/models/League";
import Team from "@/models/Team";

/**
 * GET /api/organizations/[slug]/season/[seasonSlug]/teams
 * Public — returns teams assigned to this league/season.
 */
export async function GET(request, { params }) {
    try {
        await dbConnect();
        const { slug, seasonSlug } = await params;

        const org = await Organization.findOne({ slug }).select("_id").lean();
        if (!org) return NextResponse.json({ teams: [] });

        const league = await League.findOne({ organization: org._id, slug: seasonSlug }).select("_id").lean();
        if (!league) return NextResponse.json({ teams: [] });

        const teams = await Team.find({ organization: org._id, league: league._id })
            .select("name logo")
            .lean();

        return NextResponse.json({
            teams: teams.map((t) => ({ name: t.name, logo: t.logo || "" })),
        });
    } catch (err) {
        console.error("Failed to fetch season teams:", err);
        return NextResponse.json({ teams: [] });
    }
}
