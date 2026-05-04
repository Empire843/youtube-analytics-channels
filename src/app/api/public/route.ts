import { NextResponse } from "next/server";
import { resolveChannel, getUploads, getVideoDetails } from "../../../lib/youtube";
import { buildPublicMetrics } from "../../../lib/metrics";
import { saveHistoryEntry } from "../../../lib/fs";

const DEFAULT_YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || "";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const apiKey = searchParams.get("apiKey") || DEFAULT_YOUTUBE_API_KEY;
    const channelInput = searchParams.get("channel");

    if (!apiKey || !channelInput) {
      return NextResponse.json(
        { error: "Channel is required, and apiKey must be provided either in query params or as YOUTUBE_API_KEY env." },
        { status: 400 }
      );
    }

    const channel = await resolveChannel(apiKey, channelInput);
    const uploadsPlaylistId = channel.contentDetails?.relatedPlaylists?.uploads;

    if (!uploadsPlaylistId) {
      throw new Error("Channel uploads playlist could not be resolved.");
    }

    const uploads = await getUploads(apiKey, uploadsPlaylistId, 30);
    const videoIds = uploads
      .map((item: any) => item.contentDetails?.videoId)
      .filter(Boolean);
    const videos = await getVideoDetails(apiKey, videoIds);
    const metrics: any = buildPublicMetrics(channel, videos);

    // Save to analysis history
    try {
      const historyEntry = {
        id: new Date().getTime().toString(),
        channelId: channel.id,
        analyzedAt: new Date().toISOString(),
        channel: metrics.channel,
        publicMetrics: metrics.publicMetrics,
        estimates: metrics.estimates,
        insights: null,
      };
      saveHistoryEntry(channel.id, historyEntry);
      metrics._historyTimestamp = historyEntry.analyzedAt;
    } catch (historyError) {
      console.error("failed to save history", historyError);
    }

    return NextResponse.json(metrics);
  } catch (error: any) {
    console.error("API Error (/api/public):", error);
    return NextResponse.json({ error: error.message || "Unexpected error" }, { status: 500 });
  }
}
