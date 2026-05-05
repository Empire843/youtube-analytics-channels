import { NextResponse } from "next/server";
import { buildOwnerMetrics } from "../../../lib/metrics";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const metrics = await buildOwnerMetrics(payload);
    return NextResponse.json(metrics);
  } catch (error: any) {
    console.error("API Error (/api/owner):", error);
    return NextResponse.json({ error: error.message || "Unexpected error" }, { status: 500 });
  }
}
