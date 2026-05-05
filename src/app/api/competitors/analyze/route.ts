import { NextResponse } from "next/server";
import { runCompetitorAiAnalysis } from "../../../../lib/ai";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    if (!payload.source || !payload.competitors?.length) {
      return NextResponse.json({ error: "source and competitors are required." }, { status: 400 });
    }
    const analysis = await runCompetitorAiAnalysis(
      payload.source,
      payload.competitors
    );
    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      analysis,
    });
  } catch (error: any) {
    console.error("API Error (/api/competitors/analyze):", error);
    return NextResponse.json({ error: error.message || "Unexpected error" }, { status: 500 });
  }
}
