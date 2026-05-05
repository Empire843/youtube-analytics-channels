import { NextResponse } from "next/server";
import { deletePromptEntry } from "../../../../lib/prompt";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const result = deletePromptEntry(payload.id);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("API Error (/api/prompt-library/delete):", error);
    return NextResponse.json({ error: error.message || "Unexpected error" }, { status: 500 });
  }
}
