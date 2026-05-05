import { NextResponse } from "next/server";
import { getVideoMetadata } from "../../../lib/video";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const videoInput = searchParams.get("video");

    if (!videoInput) {
      return NextResponse.json({ error: "Video URL or video ID is required." }, { status: 400 });
    }

    const metadata = await getVideoMetadata(videoInput);
    return NextResponse.json(metadata);
  } catch (error: any) {
    console.error("API Error (/api/video):", error);
    return NextResponse.json({ error: error.message || "Unexpected error" }, { status: 500 });
  }
}
