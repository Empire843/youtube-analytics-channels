import { NextResponse } from "next/server";
import { downloadTranscript, downloadThumbnail, getDirectVideoStream } from "../../../lib/video";
import fs from "fs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const videoInput = searchParams.get("video");
    const mode = searchParams.get("mode");

    if (!videoInput || !mode) {
      return NextResponse.json(
        { error: "Both video and mode query parameters are required." },
        { status: 400 }
      );
    }

    if (mode === "transcript") {
      const transcript = await downloadTranscript(videoInput);
      const fileBuffer = fs.readFileSync(transcript.path);
      const encodedName = encodeURIComponent(transcript.filename);
      return new NextResponse(fileBuffer, {
        headers: {
          "Content-Disposition": `attachment; filename*=UTF-8''${encodedName}`,
          "Content-Type": "text/plain; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    if (mode === "thumbnail") {
      const thumbnail = await downloadThumbnail(videoInput);
      const fileBuffer = fs.readFileSync(thumbnail.path);
      const encodedName = encodeURIComponent(thumbnail.filename);
      return new NextResponse(fileBuffer, {
        headers: {
          "Content-Disposition": `attachment; filename*=UTF-8''${encodedName}`,
          "Content-Type": "image/jpeg",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    if (mode === "video") {
      // Proxy the video through the server to avoid 403 from YouTube
      // YouTube blocks direct browser access to googlevideo.com URLs
      const video = await getDirectVideoStream(videoInput);
      const response = await fetch(video.url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
          "Accept": "*/*",
          "Accept-Language": "en-US,en;q=0.9",
          "Referer": "https://www.youtube.com/",
          "Origin": "https://www.youtube.com",
        },
      });

      if (!response.ok || !response.body) {
        console.error("Video proxy failed:", response.status, response.statusText);
        throw new Error(`Video download failed (HTTP ${response.status}). Direct MP4 download may not be available for this video.`);
      }

      const mime = response.headers.get("content-type") || "video/mp4";
      const encodedName = encodeURIComponent(video.filename);
      const contentLength = response.headers.get("content-length");

      const headers: Record<string, string> = {
        "Content-Disposition": `attachment; filename*=UTF-8''${encodedName}`,
        "Content-Type": mime,
        "Access-Control-Allow-Origin": "*",
      };
      if (contentLength) {
        headers["Content-Length"] = contentLength;
      }

      // Stream the response body through
      return new NextResponse(response.body as ReadableStream, { headers });
    }

    return NextResponse.json({ error: "Unsupported download mode." }, { status: 400 });
  } catch (error: any) {
    console.error("API Error (/api/video-download):", error);
    return NextResponse.json({ error: error.message || "Unexpected error" }, { status: 500 });
  }
}
