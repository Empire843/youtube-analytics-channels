import { NextResponse } from "next/server";
import { buildAiInsights } from "../../../lib/ai";
import { readHistoryRecords, saveHistoryEntry } from "../../../lib/fs";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const insights = await buildAiInsights(payload);

    if (payload.historyTimestamp && payload.channel?.id) {
      try {
        const records = readHistoryRecords();
        const existing = records.find(r => r.channelId === payload.channel.id && r.analyzedAt === payload.historyTimestamp);
        
        if (existing) {
          existing.insights = insights;
          saveHistoryEntry(payload.channel.id, existing);
        }
      } catch (err: any) {
        console.error("history failed to update AI insights", err);
      }
    }

    return NextResponse.json(insights);
  } catch (error: any) {
    console.error("API Error (/api/insights):", error);
    return NextResponse.json({ error: error.message || "Unexpected error" }, { status: 500 });
  }
}
