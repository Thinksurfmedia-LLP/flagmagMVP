import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Organization from "@/models/Organization";
import League from "@/models/League";
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

        const leagues = await League.find({ organization: org._id }).lean();

        // Aggregate teams across all leagues/divisions
        const teams = [];
        for (const league of leagues) {
            for (const div of league.divisions || []) {
                for (const team of div.teams || []) {
                    teams.push({
                        ...team,
                        leagueId: league._id,
                        leagueName: league.name,
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

        const { leagueId, divisionName, name, logo } = await request.json();
        if (!leagueId || !name) {
            return NextResponse.json({ success: false, error: "leagueId and name are required" }, { status: 400 });
        }

        const league = await League.findOne({ _id: leagueId, organization: org._id });
        if (!league) {
            return NextResponse.json({ success: false, error: "League not found in this organization" }, { status: 404 });
        }

        // Find or create the division
        let division = league.divisions.find(d => d.name === (divisionName || "Default"));
        if (!division) {
            league.divisions.push({ name: divisionName || "Default", teams: [] });
            division = league.divisions[league.divisions.length - 1];
        }

        division.teams.push({ name, logo: logo || "", wins: 0, losses: 0, pct: 0, pf: 0, pa: 0, diff: 0 });
        await league.save();

        return NextResponse.json({ success: true, data: division.teams[division.teams.length - 1] }, { status: 201 });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
