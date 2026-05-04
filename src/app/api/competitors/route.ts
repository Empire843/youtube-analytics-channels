import { NextResponse } from "next/server";
import { searchCompetitorChannels, getChannelDetailsById } from "../../../lib/youtube";
import { extractChannelDna, filterCompetitorsByStyle } from "../../../lib/ai";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const apiKey = searchParams.get("apiKey") || process.env.YOUTUBE_API_KEY || "";
    const channelId = searchParams.get("channelId");
    const maxResults = searchParams.get("maxResults") || "10";
    const aiProvider = searchParams.get("aiProvider") || process.env.AI_PROVIDER || "gemini";
    const aiApiKey = aiProvider === "wokushop" ? 
      (searchParams.get("wokushopApiKey") || process.env.WOKUSHOP_API_KEY || "") :
      (searchParams.get("geminiApiKey") || process.env.GEMINI_API_KEY || "");
    const aiModel = aiProvider === "wokushop" ? 
      (searchParams.get("wokushopModel") || process.env.WOKUSHOP_MODEL || "gemini-2.5-pro") :
      (searchParams.get("geminiModel") || process.env.GEMINI_MODEL || "gemini-2.0-flash");

    if (!apiKey || !channelId) {
      return NextResponse.json(
        { error: "channelId is required, and apiKey must be provided." },
        { status: 400 }
      );
    }

    const channel = await getChannelDetailsById(apiKey, channelId);
    
    // Extract DNA
    const dna = await extractChannelDna(apiKey, aiProvider, aiApiKey, aiModel, channel);
    
    // Search Broad
    let keywords = dna.searchQueries;
    if (!keywords || keywords.length === 0) {
      keywords = [channel.snippet?.title || "youtube channel"];
    }
    const rawCompetitors = await searchCompetitorChannels(apiKey, keywords, channelId);

    // AI Filter
    const finalCompetitors = await filterCompetitorsByStyle(
      aiProvider,
      aiApiKey,
      aiModel,
      dna,
      rawCompetitors,
      Number(maxResults)
    );

    return NextResponse.json({
      source: {
        channelId: channel.id,
        title: channel.snippet?.title || "",
        thumbnail:
          channel.snippet?.thumbnails?.medium?.url ||
          channel.snippet?.thumbnails?.default?.url ||
          "",
        customUrl: channel.snippet?.customUrl || "",
        country: channel.snippet?.country || "",
        description: channel.snippet?.description || "",
        subscribers: Number(channel.statistics?.subscriberCount || 0),
        totalViews: Number(channel.statistics?.viewCount || 0),
        videoCount: Number(channel.statistics?.videoCount || 0),
        topic: dna.topic,
        contentStyle: dna.contentStyle,
        tone: dna.tone,
        language: dna.language,
        searchQueries: dna.searchQueries,
      },
      competitors: finalCompetitors,
    });
  } catch (error: any) {
    console.error("API Error (/api/competitors):", error);
    return NextResponse.json({ error: error.message || "Unexpected error" }, { status: 500 });
  }
}
