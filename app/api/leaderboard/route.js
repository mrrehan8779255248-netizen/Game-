import { NextResponse } from "next/server";
import { getGameDatabase } from "../../../lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = await getGameDatabase();
    const results = await db.collection("matches")
      .find({}, { projection: { playerName: 1, kills: 1, placement: 1, completedAt: 1 } })
      .sort({ kills: -1, placement: 1, completedAt: -1 })
      .limit(10)
      .toArray();

    return NextResponse.json({
      leaderboard: results.map((row) => ({
        playerName: String(row.playerName || "Player").slice(0, 24),
        kills: Math.max(0, Number(row.kills) || 0),
        placement: Math.max(1, Number(row.placement) || 100),
        completedAt: row.completedAt || null
      }))
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Database unavailable";
    const status = message.includes("not configured") ? 503 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}

// Match writes are intentionally disabled unless a server-only ingest secret has been set.
// A production game should submit these from a trusted match service, not directly from a player.
export async function POST(request) {
  if (!process.env.MATCH_INGEST_SECRET) {
    return NextResponse.json({ error: "Match ingestion is disabled until MATCH_INGEST_SECRET is configured." }, { status: 503 });
  }
  const supplied = request.headers.get("authorization") || "";
  if (supplied !== "Bearer " + process.env.MATCH_INGEST_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const playerName = String(body.playerName || "Player").replace(/[<>\\u0000-\\u001f]/g, "").slice(0, 24);
    const kills = Number(body.kills);
    const placement = Number(body.placement);
    if (!Number.isInteger(kills) || kills < 0 || kills > 100 ||
        !Number.isInteger(placement) || placement < 1 || placement > 100) {
      return NextResponse.json({ error: "Invalid match summary" }, { status: 400 });
    }

    const db = await getGameDatabase();
    await db.collection("matches").insertOne({
      playerName,
      kills,
      placement,
      completedAt: new Date()
    });
    return NextResponse.json({ saved: true }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Database unavailable";
    const status = message.includes("not configured") ? 503 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
