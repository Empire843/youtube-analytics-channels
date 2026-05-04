import { uniqueStrings } from "./utils";
import { ChannelDna, Competitor } from "../types";
import { getUploads, getVideoDetails } from "./youtube";

const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const DEFAULT_WOKUSHOP_MODEL = process.env.WOKUSHOP_MODEL || "gemini-2.5-pro";
const WOKUSHOP_BASE_URL = process.env.WOKUSHOP_BASE_URL || "https://llm.wokushop.com/v1";

export async function callGemini({ apiKey, model, prompt }: { apiKey: string; model: string; prompt: string }) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const payload = {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.5,
      topP: 0.9,
      maxOutputTokens: 900,
    },
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let json: any;

  try {
    json = text ? JSON.parse(text) : {};
  } catch (error) {
    throw new Error(`Invalid Gemini response: ${text.slice(0, 200)}`);
  }

  if (!response.ok) {
    const message = json?.error?.message || `Gemini error ${response.status}`;
    throw new Error(message);
  }

  const candidate = json?.candidates?.[0];
  const parts = candidate?.content?.parts || [];
  const combined = parts
    .map((part: any) => part.text || "")
    .join("\n")
    .trim();

  if (!combined) {
    throw new Error("Gemini returned no text.");
  }

  return combined;
}

export async function callWokushop({ apiKey, model, prompt }: { apiKey: string; model: string; prompt: string }) {
  const endpoint = `${WOKUSHOP_BASE_URL}/chat/completions`;
  const payload = {
    model: model || DEFAULT_WOKUSHOP_MODEL,
    messages: [{ role: "user", content: prompt }],
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let json: any;

  try {
    json = text ? JSON.parse(text) : {};
  } catch (error) {
    throw new Error(`Invalid Wokushop response: ${text.slice(0, 200)}`);
  }

  if (!response.ok) {
    const message = json?.error?.message || `Wokushop error ${response.status}`;
    throw new Error(message);
  }

  const content = json?.choices?.[0]?.message?.content || "";
  if (!content) {
    throw new Error("Wokushop returned no text.");
  }

  return content;
}

function buildGeminiPrompt({ channel, publicMetrics, estimates, ownerMetrics }: any) {
  const ownerSummary = ownerMetrics
    ? {
        verifiedRpm: ownerMetrics.monetization?.rpm || 0,
        verifiedRevenue: ownerMetrics.monetization?.estimatedRevenue || 0,
        netSubscribers: ownerMetrics.audience?.netSubscribers || 0,
        topCountries: (ownerMetrics.geography || []).slice(0, 5),
        demographics: (ownerMetrics.demographics || []).slice(0, 8),
      }
    : null;

  return [
    "You are a senior YouTube growth strategist.",
    "Analyze the channel metrics below and return valid JSON only.",
    "Focus on business insight, content strategy, monetization, risks, and next actions.",
    "Keep recommendations specific and practical.",
    "ALL content values and text inside the JSON MUST be written in Vietnamese.",
    "",
    "Return this exact JSON shape:",
    '{"summary":"string","strengths":["string"],"risks":["string"],"opportunities":["string"],"nextActions":["string"],"monetizationView":"string","contentStrategy":"string"}',
    "",
    "Channel data:",
    JSON.stringify(
      {
        channel: {
          title: channel.title,
          channelId: channel.id,
          country: channel.country,
          subscriberCount: channel.subscriberCount,
          totalViews: channel.totalViews,
          totalVideos: channel.videoCount,
        },
        publicMetrics,
        estimates,
        ownerMetrics: ownerSummary,
      },
      null,
      2
    ),
  ].join("\n");
}

export async function buildAiInsights(payload: any) {
  const provider = payload.aiProvider || process.env.AI_PROVIDER || "gemini";
  const apiKey = provider === "wokushop"
    ? payload.wokushopApiKey || process.env.WOKUSHOP_API_KEY
    : payload.geminiApiKey || process.env.GEMINI_API_KEY;
  const model = provider === "wokushop"
    ? payload.wokushopModel || DEFAULT_WOKUSHOP_MODEL
    : payload.geminiModel || DEFAULT_GEMINI_MODEL;
  
  const { channel, publicMetrics, estimates, ownerMetrics } = payload;

  if (!apiKey) {
    throw new Error(`${provider} API key is not configured.`);
  }

  const prompt = buildGeminiPrompt({ channel, publicMetrics, estimates, ownerMetrics });

  let raw;
  if (provider === "wokushop") {
    raw = await callWokushop({ apiKey, model, prompt });
  } else {
    raw = await callGemini({ apiKey, model, prompt });
  }
  
  const cleaned = raw.replace(/^```json\s*/u, "").replace(/```$/u, "").trim();
  let parsed;

  try {
    parsed = JSON.parse(cleaned);
  } catch (error) {
    parsed = {
      summary: raw,
      strengths: [],
      risks: [],
      opportunities: [],
      nextActions: [],
      monetizationView: "",
      contentStrategy: "",
    };
  }

  return {
    model,
    generatedAt: new Date().toISOString(),
    insights: parsed,
  };
}

function buildChannelDnaPrompt(channel: any, videoTitles: string[]) {
  return `You are an elite YouTube channel analyst. Analyze the following YouTube channel and determine its "Channel DNA".

Channel Name: ${channel.snippet?.title || ""}
Channel Description: ${channel.snippet?.description || "No description"}
Channel Keywords: ${channel.brandingSettings?.channel?.keywords || "None"}

Recent Video Titles:
${videoTitles.map((t, i) => `${i + 1}. ${t}`).join("\n")}

Based on this data, return EXACTLY a JSON object with:
1. "topic": The core subject matter (1-3 words).
2. "contentStyle": The format of the videos (e.g. "Faceless Whiteboard Animation", "Talking Head", "Vlog", "Gameplay", "News Voiceover").
3. "tone": The vibe or tone of the channel (e.g. "Humorous", "Educational & Serious", "Dramatic", "Relaxing").
4. "searchQueries": An array of 3-5 hyper-specific YouTube search queries that combine the topic and content style to find DIRECT competitors (e.g. ["faceless whiteboard personal finance", "finance animation education"]).
5. "language": The primary language of the content.

Return ONLY valid JSON, no markdown, no explanation.`;
}

export async function extractChannelDna(youtubeApiKey: string, provider: string, aiApiKey: string, aiModel: string, channel: any): Promise<ChannelDna> {
  const uploadsPlaylistId = channel.contentDetails?.relatedPlaylists?.uploads;
  let videoTitles: string[] = [];

  if (uploadsPlaylistId) {
    try {
      const uploads = await getUploads(youtubeApiKey, uploadsPlaylistId, 15);
      const videoIds = uploads
        .map((item: any) => item.contentDetails?.videoId)
        .filter(Boolean);
      const videos = await getVideoDetails(youtubeApiKey, videoIds);
      videoTitles = videos.map((v: any) => v.snippet?.title || "").filter(Boolean);
    } catch (error) {
      console.error("failed to fetch videos for dna", error);
    }
  }

  const prompt = buildChannelDnaPrompt(channel, videoTitles);

  let raw;
  try {
    if (provider === "wokushop" && aiApiKey) {
      raw = await callWokushop({ apiKey: aiApiKey, model: aiModel, prompt });
    } else if (aiApiKey) {
      raw = await callGemini({ apiKey: aiApiKey, model: aiModel, prompt });
    } else {
      throw new Error("No AI Key");
    }
  } catch (error) {
    console.error("AI DNA extraction failed", error);
    return {
      topic: channel.snippet?.title || "youtube channel",
      contentStyle: "Unknown",
      tone: "Unknown",
      searchQueries: [channel.snippet?.title || "youtube"],
      language: "Unknown",
    };
  }

  const cleaned = raw.replace(/^```json\s*/u, "").replace(/```$/u, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    return {
      topic: parsed.topic || channel.snippet?.title || "Unknown",
      contentStyle: parsed.contentStyle || "Unknown",
      tone: parsed.tone || "Unknown",
      searchQueries: parsed.searchQueries || [channel.snippet?.title || "youtube"],
      language: parsed.language || "Unknown",
    };
  } catch (error) {
    return {
      topic: channel.snippet?.title || "Unknown",
      contentStyle: "Unknown",
      tone: "Unknown",
      searchQueries: [channel.snippet?.title || "youtube"],
      language: "Unknown",
    };
  }
}

function buildCompetitorFilterPrompt(sourceDna: ChannelDna, candidates: Competitor[]) {
  const candidateList = candidates
    .map(
      (c) =>
        `[ID: ${c.channelId}]\nTitle: ${c.title}\nDesc: ${c.description}\n---\n`
    )
    .join("\n");

  return `You are a YouTube competitive analysis AI. Your job is to filter a list of potential competitor channels to find only the TRUE competitors.

SOURCE CHANNEL DNA:
- Topic: ${sourceDna.topic}
- Content Style: ${sourceDna.contentStyle}
- Tone: ${sourceDna.tone}
- Language: ${sourceDna.language}

POTENTIAL COMPETITORS:
${candidateList}

TASK:
Filter the potential competitors. Remove any channels that do NOT match the Source Channel's "Content Style", "Tone", or "Language". For example, if the source is "Faceless Animation", remove "Talking Head Vloggers" even if they talk about the same topic.

Return EXACTLY a JSON array containing ONLY the string "channelId" of the true competitors, sorted from most similar to least similar.
Example: ["UC1234567890", "UC0987654321"]
Return ONLY the JSON array, no markdown.`;
}

export async function filterCompetitorsByStyle(
  provider: string,
  aiApiKey: string,
  aiModel: string,
  sourceDna: ChannelDna,
  candidates: Competitor[],
  maxResults: number
): Promise<Competitor[]> {
  if (!candidates || candidates.length === 0) return [];

  const prompt = buildCompetitorFilterPrompt(sourceDna, candidates);
  let raw;

  try {
    if (provider === "wokushop" && aiApiKey) {
      raw = await callWokushop({ apiKey: aiApiKey, model: aiModel, prompt });
    } else if (aiApiKey) {
      raw = await callGemini({ apiKey: aiApiKey, model: aiModel, prompt });
    } else {
      return candidates.slice(0, maxResults);
    }

    const cleaned = raw.replace(/^```json\s*/u, "").replace(/```$/u, "").trim();
    const approvedIds = JSON.parse(cleaned);

    if (!Array.isArray(approvedIds)) {
      throw new Error("AI did not return an array");
    }

    const filtered: Competitor[] = [];
    for (const id of approvedIds) {
      const found = candidates.find((c) => c.channelId === id);
      if (found) filtered.push(found);
    }
    
    if (filtered.length < 3) {
      console.warn("AI filtered out too many, using fallback");
      return candidates.slice(0, maxResults);
    }

    return filtered.slice(0, maxResults);
  } catch (error) {
    console.error("AI filtering failed", error);
    return candidates.slice(0, maxResults);
  }
}
