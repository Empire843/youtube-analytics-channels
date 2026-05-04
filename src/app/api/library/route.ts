import { NextResponse } from "next/server";
import { readPromptLibraryRecords } from "../../../lib/fs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const groupFilter = (searchParams.get("group") || "").trim().toLowerCase();

    const all = readPromptLibraryRecords().filter((record) => !record.deletedAt);

    const items = all.filter((record) => {
      const matchesGroup = !groupFilter
        ? true
        : [record.analysis?.primaryGroup, ...(record.analysis?.groups || [])]
            .map((item) => String(item || "").toLowerCase())
            .includes(groupFilter);

      if (!matchesGroup) return false;

      if (!search) return true;

      const searchText = search.toLowerCase();
      const haystack = [
        record.title,
        record.prompt,
        record.renderedPrompt,
        record.analysis?.summary,
        ...(record.analysis?.tags || []),
        ...(record.analysis?.groups || []),
        ...(record.analysis?.useCases || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(searchText);
    });

    const groups = Array.from(
      new Set(
        all.flatMap((record) => [
          record.analysis?.primaryGroup,
          ...(record.analysis?.groups || []),
        ])
      )
    )
      .map((g) => String(g || "").trim())
      .filter(Boolean)
      .sort();

    return NextResponse.json({ items, groups, total: items.length });
  } catch (error: any) {
    console.error("API Error (/api/library):", error);
    return NextResponse.json({ error: error.message || "Unexpected error" }, { status: 500 });
  }
}
