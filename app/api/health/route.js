import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const configuredUrl = process.env.NEXT_PUBLIC_GAME_SERVER_URL || "";
  const databaseConfigured = Boolean(process.env.MONGODB_URI);
  if (!configuredUrl) {
    return NextResponse.json({ status: "degraded", realtime: "not_configured", databaseConfigured }, { status: 503 });
  }

  const httpUrl = configuredUrl.replace(/^wss:/i, "https:").replace(/^ws:/i, "http:").replace(/\/$/, "");
  let realtime = "offline";
  let workerStatus = null;
  try {
    const response = await fetch(httpUrl + "/health", {
      cache: "no-store",
      signal: AbortSignal.timeout(2500)
    });
    if (response.ok) {
      const body = await response.json();
      realtime = body?.status === "ok" ? "online" : "degraded";
      workerStatus = body?.status || "unknown";
    }
  } catch {
    realtime = "offline";
  }

  return NextResponse.json({
    status: realtime === "online" && databaseConfigured ? "ok" : "degraded",
    realtime,
    workerStatus,
    databaseConfigured
  }, {
    status: realtime === "online" ? 200 : 503,
    headers: { "Cache-Control": "no-store" }
  });
}
