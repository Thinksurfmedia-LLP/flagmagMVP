import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Organization from "@/models/Organization";
import League from "@/models/League";
import Team from "@/models/Team";
import Game from "@/models/Game";

export async function GET(request, { params }) {
    try {
        await dbConnect();
        const { slug, seasonSlug } = await params;

        const org = await Organization.findOne({ slug }).select("_id").lean();
        if (!org) return NextResponse.json({ success: false, error: "Org not found" }, { status: 404 });

        const league = await League.findOne({ organization: org._id, slug: seasonSlug }).select("_id name").lean();
        if (!league) return NextResponse.json({ success: false, error: "League not found" }, { status: 404 });

        const teams = await Team.find({ organization: org._id, league: league._id })
            .select("name logo division")
            .lean();

        const games = await Game.find({ league: league._id, status: "completed", gameType: { $ne: "practice" } }).lean();

        // Seed all teams with zero stats
        const stats = {};
        for (const t of teams) {
            const key = t.name.trim().toLowerCase();
            stats[key] = {
                name: t.name.trim(),
                logo: t.logo || "",
                division: (t.division || "").trim(),
                wins: 0, losses: 0, pf: 0, pa: 0,
            };
        }

        const getOrCreate = (rawName) => {
            const key = rawName.trim().toLowerCase();
            if (!stats[key]) {
                stats[key] = { name: rawName.trim(), logo: "", division: "", wins: 0, losses: 0, pf: 0, pa: 0 };
            }
            return stats[key];
        };

        for (const g of games) {
            const aScore = Number(g.teamA?.score ?? 0);
            const bScore = Number(g.teamB?.score ?? 0);
            const a = getOrCreate(g.teamA.name);
            const b = getOrCreate(g.teamB.name);
            a.pf += aScore; a.pa += bScore;
            b.pf += bScore; b.pa += aScore;
            if (aScore > bScore) { a.wins++; b.losses++; }
            else if (bScore > aScore) { b.wins++; a.losses++; }
        }

        const rows = Object.values(stats).map((r) => ({
            ...r,
            pct: (r.wins + r.losses) > 0 ? (r.wins / (r.wins + r.losses)) * 100 : 0,
            diff: r.pf - r.pa,
        })).sort((a, b) => b.pct - a.pct || b.pf - a.pf);

        // Group by division
        const divisionNames = [...new Set(rows.map((r) => r.division).filter(Boolean))];
        let divisionGroups;
        if (divisionNames.length <= 1) {
            divisionGroups = [{ name: divisionNames[0] || "", rows }];
        } else {
            const grouped = {};
            for (const r of rows) {
                const key = r.division || "Other";
                if (!grouped[key]) grouped[key] = [];
                grouped[key].push(r);
            }
            divisionGroups = Object.entries(grouped)
                .map(([name, rows]) => ({ name, rows }))
                .sort((a, b) => {
                    if (a.name === "Other") return 1;
                    if (b.name === "Other") return -1;
                    return a.name.localeCompare(b.name);
                });
        }

        return NextResponse.json({ success: true, divisionGroups });
    } catch (err) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
