import { NextResponse } from "next/server";
import fs from "fs";

export async function GET() {
  const YT_DLP_PATH =
    process.env.YT_DLP_PATH ||
    "C:\\Users\\kienq\\AppData\\Local\\Programs\\Python\\Python310\\Scripts\\yt-dlp.exe";

  return NextResponse.json({
    hasYoutubeApiKey: Boolean(process.env.YOUTUBE_API_KEY),
    hasGeminiApiKey: Boolean(process.env.GEMINI_API_KEY),
    geminiModel: process.env.GEMINI_MODEL || "gemini-2.0-flash",
    hasYtDlp: fs.existsSync(YT_DLP_PATH),
    promptLibraryPath: "prompt-library", // hardcoded relative path
  });
}
