import { NextResponse } from "next/server";
import { readHistoryRecords } from "../../../lib/fs";
import fs from "fs";
import path from "path";

const ANALYSIS_HISTORY_DIR = path.join(process.cwd(), "analysis-history");

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const channelId = searchParams.get("channelId") || "";

    const allRecords = readHistoryRecords();
    
    if (channelId) {
      const channelRecords = allRecords.filter(r => r.channelId === channelId);
      return NextResponse.json({ channelId, analyses: channelRecords });
    } else {
      // Group by channel
      const map = new Map();
      for (const record of allRecords) {
        if (!map.has(record.channelId)) {
          map.set(record.channelId, {
            channelId: record.channelId,
            channel: record.channel,
            latestAnalysis: record.analyzedAt,
            historyCount: 0,
          });
        }
        map.get(record.channelId).historyCount++;
        if (new Date(record.analyzedAt) > new Date(map.get(record.channelId).latestAnalysis)) {
          map.get(record.channelId).latestAnalysis = record.analyzedAt;
          map.get(record.channelId).channel = record.channel;
        }
      }
      
      const channels = Array.from(map.values()).sort(
        (a, b) => new Date(b.latestAnalysis).getTime() - new Date(a.latestAnalysis).getTime()
      );
      
      return NextResponse.json({ channels });
    }
  } catch (error: any) {
    console.error("API Error (/api/history):", error);
    return NextResponse.json({ error: error.message || "Unexpected error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { action, channelId, timestamp } = await request.json();
    
    if (action === "delete") {
      const safeId = channelId.replace(/[^a-zA-Z0-9_-]/gu, "");
      const targetPath = path.join(ANALYSIS_HISTORY_DIR, `${safeId}.json`);
      if (fs.existsSync(targetPath)) {
        // Since we only have one file per channel in this setup, deleting it removes all history for it
        fs.unlinkSync(targetPath);
      }
      return NextResponse.json({ success: true, deleted: 1 });
    }
    
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: any) {
    console.error("API Error (/api/history POST):", error);
    return NextResponse.json({ error: error.message || "Unexpected error" }, { status: 500 });
  }
}
