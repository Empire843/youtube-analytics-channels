import fs from "fs";
import path from "path";
import { formatDurationHuman } from "./utils";

export function getVideoIdFromInput(input: string) {
  try {
    const parsedUrl = new URL(input);
    if (parsedUrl.hostname.includes("youtube.com")) {
      return parsedUrl.searchParams.get("v");
    }
    if (parsedUrl.hostname.includes("youtu.be")) {
      return parsedUrl.pathname.slice(1);
    }
  } catch (e) {
    //
  }
  return input;
}

export async function getVideoPageData(videoInput: string) {
  const videoId = getVideoIdFromInput(videoInput);
  if (!videoId) {
    throw new Error("A valid YouTube video URL or ID is required.");
  }

  const watchUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&hl=en`;
  const response = await fetch(
    "https://www.youtube.com/youtubei/v1/player?prettyPrint=false&key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
      body: JSON.stringify({
        videoId,
        context: {
          client: {
            clientName: "IOS",
            clientVersion: "20.10.4",
            deviceModel: "iPhone14,3",
            hl: "en",
            gl: "US",
          },
        },
      }),
    }
  );

  if (!response.ok) {
    throw new Error("Failed to load the YouTube player data.");
  }

  const player = await response.json();
  if (!player.videoDetails) {
    throw new Error("Could not parse YouTube video metadata.");
  }

  return { videoId, watchUrl, player };
}

export async function getVideoMetadata(videoInput: string) {
  const { videoId, watchUrl, player } = await getVideoPageData(videoInput);
  const videoDetails = player.videoDetails || {};
  const microformat = player.microformat?.playerMicroformatRenderer || {};
  const captionTracks = player.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
  const autoTracks = player.captions?.playerCaptionsTracklistRenderer?.audioTracks || [];
  const allFormats = [
    ...(player.streamingData?.formats || []),
    ...(player.streamingData?.adaptiveFormats || []),
  ];
  const directFormat = allFormats.find(
    (format: any) =>
      format.url &&
      typeof format.mimeType === "string" &&
      format.mimeType.includes("video/mp4")
  );

  return {
    id: videoId,
    title: videoDetails.title || microformat.title?.simpleText || "",
    uploader: videoDetails.author || "",
    channel: videoDetails.author || "",
    duration: Number(videoDetails.lengthSeconds || 0),
    durationString: formatDurationHuman(videoDetails.lengthSeconds || 0),
    uploadDate: microformat.publishDate || microformat.uploadDate || "",
    thumbnail:
      videoDetails.thumbnail?.thumbnails?.slice(-1)[0]?.url ||
      `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
    description: videoDetails.shortDescription || "",
    webpageUrl: watchUrl,
    viewCount: Number(videoDetails.viewCount || 0),
    likeCount: 0,
    commentCount: 0,
    availability: videoDetails.isLiveContent ? "live" : "public",
    subtitles: captionTracks.map((track: any) => track.languageCode),
    automaticCaptions: autoTracks
      .flatMap((track: any) => (track.captionTrackIndices || []).map((index: number) => captionTracks[index]?.languageCode))
      .filter(Boolean),
    captionTracks,
    streamingData: player.streamingData || {},
    transcriptAvailable: captionTracks.length > 0,
    videoDownloadAvailable: Boolean(directFormat?.url),
    thumbnailDownloadAvailable: Boolean(
      videoDetails.thumbnail?.thumbnails?.length || videoId
    ),
  };
}

export function vttToPlainText(content: string) {
  const lines = content
    .replace(/^WEBVTT.*$/gmu, "")
    .replace(/^\d+\s*$/gmu, "")
    .replace(/^\d{2}:\d{2}(?::\d{2})?\.\d{3}\s+-->\s+\d{2}:\d{2}(?::\d{2})?\.\d{3}.*$/gmu, "")
    .replace(/<[^>]+>/gu, "")
    .replace(/&nbsp;/gu, " ")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  // Deduplicate consecutive identical lines (YouTube VTT has overlapping cues)
  const deduped: string[] = [];
  for (const line of lines) {
    if (deduped.length === 0 || deduped[deduped.length - 1] !== line) {
      deduped.push(line);
    }
  }

  return deduped.join("\n");
}

export function pickCaptionTrack(tracks: any[], preferredLang = "en") {
  if (!tracks || !tracks.length) return null;
  const preferred = tracks.find(
    (t: any) => t.languageCode.startsWith(preferredLang) && t.kind !== "asr"
  );
  if (preferred) return preferred;
  const anyNonAsr = tracks.find((t: any) => t.kind !== "asr");
  if (anyNonAsr) return anyNonAsr;
  const autoPreferred = tracks.find(
    (t: any) => t.languageCode.startsWith(preferredLang) && t.kind === "asr"
  );
  if (autoPreferred) return autoPreferred;
  return tracks[0];
}

export function makeWorkDir(subfolder: string) {
  const workDir = path.join(process.cwd(), "downloads", subfolder);
  fs.mkdirSync(workDir, { recursive: true });
  return workDir;
}

export function sanitizeFilenamePart(name: string) {
  return name.replace(/[/\\?%*:|"<>]/gu, "-");
}

export async function downloadTranscript(videoInput: string, preferredLang = "en") {
  const metadata = await getVideoMetadata(videoInput);
  const track = pickCaptionTrack(metadata.captionTracks || [], preferredLang);
  if (!track?.baseUrl) {
    throw new Error("No subtitles or auto-captions were found for this video.");
  }

  const transcriptUrl = `${track.baseUrl}&fmt=vtt`;
  const response = await fetch(transcriptUrl);
  if (!response.ok) {
    throw new Error("Failed to fetch the transcript.");
  }

  const content = await response.text();
  const text = vttToPlainText(content);
  const workDir = makeWorkDir("transcript");
  const safeTitle = sanitizeFilenamePart(metadata.title || metadata.id || "transcript");
  const targetPath = path.join(workDir, `${safeTitle}.txt`);
  fs.writeFileSync(targetPath, text || "Transcript was empty.", "utf8");

  return {
    path: targetPath,
    filename: path.basename(targetPath),
  };
}

export async function downloadThumbnail(videoInput: string) {
  const metadata = await getVideoMetadata(videoInput);
  if (!metadata.thumbnail) {
    throw new Error("Thumbnail was not available for this video.");
  }

  const response = await fetch(metadata.thumbnail);
  if (!response.ok) {
    throw new Error("Failed to fetch thumbnail.");
  }

  const arrayBuffer = await response.arrayBuffer();
  const safeTitle = sanitizeFilenamePart(metadata.title || metadata.id || "thumbnail");
  const extension = path.extname(new URL(metadata.thumbnail).pathname) || ".jpg";
  const workDir = makeWorkDir("thumbnail");
  const targetPath = path.join(workDir, `${safeTitle}${extension}`);
  fs.writeFileSync(targetPath, Buffer.from(arrayBuffer));

  return {
    path: targetPath,
    filename: path.basename(targetPath),
  };
}

export async function getDirectVideoStream(videoInput: string) {
  const metadata = await getVideoMetadata(videoInput);
  const directFormat = [
    ...(metadata.streamingData?.formats || []),
    ...(metadata.streamingData?.adaptiveFormats || []),
  ].find(
    (format: any) =>
      format.url &&
      typeof format.mimeType === "string" &&
      format.mimeType.includes("video/mp4")
  );

  if (!directFormat?.url) {
    throw new Error("Direct video download is not available for this video in the current environment.");
  }

  const safeTitle = sanitizeFilenamePart(metadata.title || metadata.id || "video");
  return {
    url: directFormat.url,
    filename: `${safeTitle}.mp4`,
  };
}
