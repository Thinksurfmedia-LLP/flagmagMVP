import { NextResponse } from "next/server";
import { US_CITIES } from "@/lib/usCityData";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const state = searchParams.get("state");
  const county = searchParams.get("county");

  if (!state || !county) {
    return NextResponse.json(
      { success: false, error: "state and county query params are required" },
      { status: 400 }
    );
  }

  const cities = ((US_CITIES[state] || {})[county] || []).slice().sort((a, b) => a.localeCompare(b));

  return NextResponse.json({ success: true, data: cities });
}
