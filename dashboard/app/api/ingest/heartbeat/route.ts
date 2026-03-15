export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { validateApiKey, unauthorizedResponse } from "@/lib/auth-api";
import { db, ensureDb } from "@/lib/db";
import { heartbeats } from "@/lib/schema";
import { nanoid } from "nanoid";

const VALID_STATUSES = ["alive", "degraded", "offline"] as const;

export async function POST(request: Request) {
  if (!validateApiKey(request)) return unauthorizedResponse();

  try {
    await ensureDb();
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const status = (body.status as string) || "alive";
    if (!VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
      return NextResponse.json(
        { error: `Invalid status: ${status}. Must be one of: ${VALID_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    const id = nanoid();

    await db.insert(heartbeats).values({
      id,
      timestamp: new Date(),
      status: status as "alive" | "degraded" | "offline",
      currentTask: typeof body.currentTask === "string" ? body.currentTask : null,
      uptimeSeconds: typeof body.uptimeSeconds === "number" ? body.uptimeSeconds : 0,
      metadata: body.metadata || null,
    });

    return NextResponse.json({ ok: true, id });
  } catch (error) {
    console.error("[heartbeat] Ingest error:", error);
    return NextResponse.json(
      { error: "Failed to process heartbeat", details: String(error) },
      { status: 500 }
    );
  }
}
