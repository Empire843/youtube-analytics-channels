import fs from "fs";
import path from "path";
import { HistoryEntry, PromptLibraryEntry } from "../types";

const ANALYSIS_HISTORY_DIR = path.join(process.cwd(), "analysis-history");
const PROMPT_LIBRARY_DIR = path.join(process.cwd(), "prompt-library");

export function initDirectories() {
  if (!fs.existsSync(ANALYSIS_HISTORY_DIR)) {
    fs.mkdirSync(ANALYSIS_HISTORY_DIR, { recursive: true });
  }
  if (!fs.existsSync(PROMPT_LIBRARY_DIR)) {
    fs.mkdirSync(PROMPT_LIBRARY_DIR, { recursive: true });
  }
}

export function saveHistoryEntry(channelId: string, data: HistoryEntry) {
  initDirectories();
  const safeId = channelId.replace(/[^a-zA-Z0-9_-]/gu, "");
  const channelDir = path.join(ANALYSIS_HISTORY_DIR, safeId);
  if (!fs.existsSync(channelDir)) {
    fs.mkdirSync(channelDir, { recursive: true });
  }
  const timestamp = Date.now();
  const targetPath = path.join(channelDir, `${timestamp}.json`);
  fs.writeFileSync(targetPath, JSON.stringify(data, null, 2), "utf8");
}

export function readHistoryRecords(): HistoryEntry[] {
  initDirectories();
  const records: HistoryEntry[] = [];
  
  try {
    for (const entry of fs.readdirSync(ANALYSIS_HISTORY_DIR, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        const channelDir = path.join(ANALYSIS_HISTORY_DIR, entry.name);
        const files = fs.readdirSync(channelDir).filter(f => f.endsWith(".json")).sort().reverse();
        for (const file of files) {
          const filePath = path.join(channelDir, file);
          try {
            const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
            data.id = entry.name;
            records.push(data);
          } catch (error) {
            console.error(`Failed to parse history entry ${file}`, error);
          }
        }
      }
    }
  } catch (error) {
    console.error("Failed to read history records", error);
  }

  return records.sort((a, b) => new Date(b.analyzedAt || 0).getTime() - new Date(a.analyzedAt || 0).getTime());
}

export function readPromptLibraryRecords(): PromptLibraryEntry[] {
  initDirectories();
  const records: PromptLibraryEntry[] = [];

  function visit(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(fullPath);
        continue;
      }
      if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== ".json") {
        continue;
      }
      try {
        const json = JSON.parse(fs.readFileSync(fullPath, "utf8"));
        records.push({
          ...json,
          filePath: fullPath,
          relativePath: path.relative(process.cwd(), fullPath),
        });
      } catch (error) {
        // Ignore invalid
      }
    }
  }

  visit(PROMPT_LIBRARY_DIR);
  return records.sort(
    (a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime()
  );
}
