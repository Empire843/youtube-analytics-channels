import { NextResponse } from "next/server";
import { analyzePromptEntry } from "../../../../lib/prompt";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const result = await analyzePromptEntry(payload);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("API Error (/api/prompt-library/analyze):", error);
    return NextResponse.json({ error: error.message || "Unexpected error" }, { status: 500 });
  }
}
