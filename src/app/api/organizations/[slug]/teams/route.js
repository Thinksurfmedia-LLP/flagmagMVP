import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Organization from "@/models/Organization";
import Season from "@/models/Season";
import { requireAdmin } from "@/lib/apiAuth";

// GET teams aggregated from all seasons for this org
export async function GET(request, { params }) {
    try {
        const auth = await requireAdmin();
        if (!auth.authorized) return auth.response;

        await dbConnect();
        const { slug } = await params;

        const org = await Organization.findOne({ slug }).lean();
        if (!org) {
            return NextResponse.json({ success: false, error: "Organization not found" }, { status: 404 });
        }

        const seasons = await Season.find({ organization: org._id }).lean();

        // Aggregate teams across all seasons/divisions
        const teams = [];
        for (const season of seasons) {
            for (const div of season.divisions || []) {
                for (const team of div.teams || []) {
                    teams.push({
                        ...team,
                        seasonId: season._id,
                        seasonName: season.name,
                        divisionName: div.name || "Default",
                    });
                }
            }
        }

        return NextResponse.json({ success: true, count: teams.length, data: teams }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// POST — add a team to a season's division
export async function POST(request, { params }) {
    try {
        const auth = await requireAdmin();
        if (!auth.authorized) return auth.response;

        await dbConnect();
        const { slug } = await params;

        const org = await Organization.findOne({ slug }).lean();
        if (!org) {
            return NextResponse.json({ success: false, error: "Organization not found" }, { status: 404 });
        }

        const { seasonId, divisionName, name, logo } = await request.json();
        if (!seasonId || !name) {
            return NextResponse.json({ success: false, error: "seasonId and name are required" }, { status: 400 });
        }

        const season = await Season.findOne({ _id: seasonId, organization: org._id });
        if (!season) {
            return NextResponse.json({ success: false, error: "Season not found in this organization" }, { status: 404 });
        }

        // Find or create the division
        let division = season.divisions.find(d => d.name === (divisionName || "Default"));
        if (!division) {
            season.divisions.push({ name: divisionName || "Default", teams: [] });
            division = season.divisions[season.divisions.length - 1];
        }

        division.teams.push({ name, logo: logo || "", wins: 0, losses: 0, pct: 0, pf: 0, pa: 0, diff: 0 });
        await season.save();

        return NextResponse.json({ success: true, data: division.teams[division.teams.length - 1] }, { status: 201 });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
