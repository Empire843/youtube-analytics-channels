import { NextResponse } from "next/server";
import { readHistoryRecords } from "../../../lib/fs";
import fs from "fs";
import path from "path";

const ANALYSIS_HISTORY_DIR = path.join(process.cwd(), "analysis-history");

// Helper: extract channel metadata from a history record
// Data can be in flat fields (record.channelTitle) OR nested (record.channel.title)
function extractMeta(record: any) {
  const ch = record.channel || {};
  return {
    channelTitle: record.channelTitle || ch.title || record.channelId,
    channelThumbnail: record.channelThumbnail || ch.thumbnail || "",
    customUrl: record.customUrl || ch.customUrl || "",
    country: record.country || ch.country || "",
    subscriberCount: record.subscriberCount || ch.subscriberCount || 0,
    totalViews: record.totalViews || ch.totalViews || 0,
    videoCount: record.videoCount || ch.videoCount || 0,
  };
}

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
        const meta = extractMeta(record);

        if (!map.has(record.channelId)) {
          map.set(record.channelId, {
            channelId: record.channelId,
            ...meta,
            latestAnalysis: record.analyzedAt,
            historyCount: 0,
          });
        }
        
        const ch = map.get(record.channelId);
        ch.historyCount++;
        
        if (new Date(record.analyzedAt) > new Date(ch.latestAnalysis)) {
          ch.latestAnalysis = record.analyzedAt;
          // Update metadata from the latest record
          const latestMeta = extractMeta(record);
          ch.channelTitle = latestMeta.channelTitle;
          ch.channelThumbnail = latestMeta.channelThumbnail || ch.channelThumbnail;
          ch.customUrl = latestMeta.customUrl || ch.customUrl;
          ch.country = latestMeta.country || ch.country;
          ch.subscriberCount = latestMeta.subscriberCount || ch.subscriberCount;
          ch.totalViews = latestMeta.totalViews || ch.totalViews;
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
    const safeId = (channelId || "").replace(/[^a-zA-Z0-9_-]/gu, "");
    
    if (action === "delete") {
      // Delete all history for a channel
      const channelDir = path.join(ANALYSIS_HISTORY_DIR, safeId);
      if (fs.existsSync(channelDir)) {
        fs.rmSync(channelDir, { recursive: true, force: true });
      }
      // Also handle legacy single-file format
      const legacyPath = path.join(ANALYSIS_HISTORY_DIR, `${safeId}.json`);
      if (fs.existsSync(legacyPath)) {
        fs.unlinkSync(legacyPath);
      }
      return NextResponse.json({ success: true });
    }
    
    if (action === "deleteEntry") {
      // Delete a single analysis entry by matching its analyzedAt timestamp
      const channelDir = path.join(ANALYSIS_HISTORY_DIR, safeId);
      if (fs.existsSync(channelDir)) {
        const files = fs.readdirSync(channelDir).filter(f => f.endsWith(".json"));
        for (const file of files) {
          const filePath = path.join(channelDir, file);
          try {
            const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
            if (data.analyzedAt === timestamp) {
              fs.unlinkSync(filePath);
              return NextResponse.json({ success: true, deleted: 1 });
            }
          } catch {
            // skip invalid files
          }
        }
      }
      return NextResponse.json({ success: true, deleted: 0 });
    }
    
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: any) {
    console.error("API Error (/api/history POST):", error);
    return NextResponse.json({ error: error.message || "Unexpected error" }, { status: 500 });
  }
}
