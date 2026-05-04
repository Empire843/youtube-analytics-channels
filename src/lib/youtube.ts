import { fetchJson, decodeUrlSegmentSafe } from "./utils";
import { Competitor } from "../types";

export function getIdFromInput(input: string) {
  const value = (input || "").trim();
  if (!value) {
    return { type: "unknown", value: "" };
  }

  if (value.startsWith("UC") && value.length >= 24) {
    return { type: "channelId", value };
  }

  if (value.startsWith("@")) {
    return { type: "handle", value: decodeUrlSegmentSafe(value.slice(1)) };
  }

  try {
    const parsed = new URL(value);
    const parts = parsed.pathname
      .split("/")
      .filter(Boolean)
      .map((part) => decodeUrlSegmentSafe(part));

    if (parts[0] === "channel" && parts[1]) {
      return { type: "channelId", value: parts[1] };
    }

    if (parts[0] === "@" && parts[1]) {
      return { type: "handle", value: parts[1] };
    }

    if (parts[0] && parts[0].startsWith("@")) {
      return { type: "handle", value: parts[0].slice(1) };
    }

    if (parts[0] === "user" && parts[1]) {
      return { type: "user", value: parts[1] };
    }

    if (parts[0] === "c" && parts[1]) {
      return { type: "customUrl", value: parts[1] };
    }
  } catch (error) {
    // ignore
  }

  return { type: "keyword", value };
}

export async function resolveChannelIdFromPublicPage(input: string, parsed: any) {
  let targetUrl = "";

  try {
    const parsedUrl = new URL(input);
    targetUrl = parsedUrl.toString();
  } catch (error) {
    if (parsed.type === "handle" && parsed.value) {
      targetUrl = `https://www.youtube.com/@${encodeURIComponent(parsed.value)}`;
    } else if (parsed.value) {
      targetUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(parsed.value)}`;
    }
  }

  if (!targetUrl) {
    return "";
  }

  const response = await fetch(targetUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9,vi;q=0.8",
    },
  });

  if (!response.ok) {
    return "";
  }

  const html = await response.text();
  const matchers = [
    /"externalId":"(UC[a-zA-Z0-9_-]{20,})"/u,
    /"channelId":"(UC[a-zA-Z0-9_-]{20,})"/u,
    /youtube\.com\/channel\/(UC[a-zA-Z0-9_-]{20,})/u,
    /"browseId":"(UC[a-zA-Z0-9_-]{20,})"/u,
  ];

  for (const matcher of matchers) {
    const match = html.match(matcher);
    if (match?.[1]) {
      return match[1];
    }
  }

  return "";
}

export async function getChannelDetailsById(apiKey: string, channelId: string) {
  const details = await fetchJson(
    `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails,brandingSettings&id=${encodeURIComponent(
      channelId
    )}&key=${encodeURIComponent(apiKey)}`
  );

  if (!details.items?.length) {
    throw new Error("Resolved channel but could not fetch channel details.");
  }

  return details.items[0];
}

export async function resolveChannel(apiKey: string, input: string) {
  const parsed = getIdFromInput(input);

  if (parsed.type === "channelId") {
    return getChannelDetailsById(apiKey, parsed.value);
  }

  if (parsed.type === "handle") {
    try {
      const byHandle = await fetchJson(
        `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails,brandingSettings&forHandle=${encodeURIComponent(
          parsed.value
        )}&key=${encodeURIComponent(apiKey)}`
      );

      if (byHandle.items?.length) {
        return byHandle.items[0];
      }
    } catch (error) {
      // Fall through to public-page resolution and search fallback.
    }

    const publicPageChannelId = await resolveChannelIdFromPublicPage(input, parsed);
    if (publicPageChannelId) {
      return getChannelDetailsById(apiKey, publicPageChannelId);
    }
  }

  const query = parsed.value;
  let search: any = { items: [] };
  try {
    search = await fetchJson(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&maxResults=5&q=${encodeURIComponent(query)}&key=${encodeURIComponent(apiKey)}`
    );
  } catch (error) {
    search = { items: [] };
  }

  if (!search.items?.length) {
    const publicPageChannelId = await resolveChannelIdFromPublicPage(input, parsed);
    if (publicPageChannelId) {
      return getChannelDetailsById(apiKey, publicPageChannelId);
    }
    throw new Error("No channel matched the provided handle, URL, or keyword.");
  }

  const channelId = search.items[0].snippet.channelId;
  return getChannelDetailsById(apiKey, channelId);
}

export async function getUploads(apiKey: string, playlistId: string, maxResults = 30) {
  const items = [];
  let pageToken = "";

  while (items.length < maxResults) {
    const page = await fetchJson(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=50&playlistId=${encodeURIComponent(
        playlistId
      )}&key=${encodeURIComponent(apiKey)}${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`
    );

    if (!page.items?.length) {
      break;
    }

    items.push(...page.items);
    pageToken = page.nextPageToken;
    if (!pageToken) {
      break;
    }
  }

  return items.slice(0, maxResults);
}

export async function getVideoDetails(apiKey: string, videoIds: string[]) {
  if (!videoIds.length) {
    return [];
  }

  const videos = [];
  const chunkSize = 50;
  for (let i = 0; i < videoIds.length; i += chunkSize) {
    const chunk = videoIds.slice(i, i + chunkSize);
    const data = await fetchJson(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${encodeURIComponent(
        chunk.join(",")
      )}&key=${encodeURIComponent(apiKey)}`
    );
    if (data.items) {
      videos.push(...data.items);
    }
  }
  return videos;
}

export async function searchCompetitorChannels(
  apiKey: string,
  keywords: string[],
  sourceChannelId: string
): Promise<Competitor[]> {
  const channelIdSet = new Set<string>();
  const channelIdOrder: string[] = [];

  for (const keyword of keywords.slice(0, 3)) {
    try {
      const data = await fetchJson(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&maxResults=15&q=${encodeURIComponent(
          keyword
        )}&key=${encodeURIComponent(apiKey)}`
      );
      for (const item of data.items || []) {
        const cid = item.snippet?.channelId || item.id?.channelId;
        if (cid && cid !== sourceChannelId && !channelIdSet.has(cid)) {
          channelIdSet.add(cid);
          channelIdOrder.push(cid);
        }
      }
    } catch (error) {
      console.error(`channel search failed for "${keyword}"`, error);
    }
  }

  for (const keyword of keywords.slice(0, 2)) {
    try {
      const data = await fetchJson(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=20&order=viewCount&q=${encodeURIComponent(
          keyword
        )}&key=${encodeURIComponent(apiKey)}`
      );
      for (const item of data.items || []) {
        const cid = item.snippet?.channelId;
        if (cid && cid !== sourceChannelId && !channelIdSet.has(cid)) {
          channelIdSet.add(cid);
          channelIdOrder.push(cid);
        }
      }
    } catch (error) {
      console.error(`video search failed for "${keyword}"`, error);
    }
  }

  if (!channelIdOrder.length) {
    return [];
  }

  const allChannels: Competitor[] = [];
  const batchIds = channelIdOrder.slice(0, Math.min(channelIdOrder.length, 50));
  try {
    const data = await fetchJson(
      `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${encodeURIComponent(
        batchIds.join(",")
      )}&key=${encodeURIComponent(apiKey)}`
    );
    for (const ch of data.items || []) {
      allChannels.push({
        channelId: ch.id,
        title: ch.snippet?.title || "",
        thumbnail:
          ch.snippet?.thumbnails?.medium?.url ||
          ch.snippet?.thumbnails?.default?.url ||
          "",
        customUrl: ch.snippet?.customUrl || "",
        country: ch.snippet?.country || "",
        description: (ch.snippet?.description || "").slice(0, 300),
        publishedAt: ch.snippet?.publishedAt || "",
        subscribers: Number(ch.statistics?.subscriberCount || 0),
        totalViews: Number(ch.statistics?.viewCount || 0),
        videoCount: Number(ch.statistics?.videoCount || 0),
        hiddenSubscriberCount: Boolean(ch.statistics?.hiddenSubscriberCount),
      });
    }
  } catch (error) {
    console.error("batch channel details failed", error);
  }

  allChannels.sort((a, b) => b.subscribers - a.subscribers);
  return allChannels;
}
