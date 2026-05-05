import fs from "fs";
import path from "path";
import crypto from "crypto";
import { slugify, uniqueStrings } from "./utils";
import { callGemini, callWokushop } from "./ai";
import { readPromptLibraryRecords } from "./fs";

const PROMPT_LIBRARY_DIR = path.join(process.cwd(), "prompt-library");

export function extractPromptVariablesForLibrary(template: string) {
  const patterns = [
    /\[<([a-zA-Z0-9_ -]+)>\]/gu,
    /\{\{([a-zA-Z0-9_ -]+)\}\}/gu,
    /\[\[([a-zA-Z0-9_ -]+)\]\]/gu,
  ];
  const found = new Map();

  for (const pattern of patterns) {
    let match = pattern.exec(template);
    while (match) {
      const name = String(match[1] || "").trim();
      if (name && !found.has(name)) {
        found.set(name, { name, placeholders: [match[0]] });
      } else if (name) {
        found.get(name).placeholders.push(match[0]);
      }
      match = pattern.exec(template);
    }
  }

  return Array.from(found.values());
}

export function heuristicPromptAnalysis({ title, prompt, renderedPrompt, variables }: any) {
  const source = `${title || ""}\n${prompt}\n${renderedPrompt || ""}`.toLowerCase();
  const groups: string[] = [];
  const tags: string[] = [];
  const useCases: string[] = [];

  const keywordMap = [
    { group: "youtube", tags: ["youtube"], match: /youtube|thumbnail|script|channel|shorts/u },
    { group: "copywriting", tags: ["copywriting"], match: /copy|headline|cta|sales|offer|landing page/u },
    { group: "coding", tags: ["coding"], match: /code|javascript|python|react|api|debug/u },
    { group: "research", tags: ["research"], match: /research|analyze|insight|report|summarize/u },
    { group: "translation", tags: ["translation"], match: /translate|translation|bilingual/u },
    { group: "education", tags: ["education"], match: /lesson|teach|explain|tutorial/u },
    { group: "productivity", tags: ["workflow"], match: /template|workflow|checklist|process/u },
    { group: "creative-writing", tags: ["creative"], match: /story|poem|creative|character/u },
  ];

  for (const entry of keywordMap) {
    if (entry.match.test(source)) {
      groups.push(entry.group);
      tags.push(...entry.tags);
    }
  }

  if (/system prompt|role:/u.test(source)) {
    tags.push("system-prompt");
  }
  if (/json|schema|xml|markdown/u.test(source)) {
    tags.push("structured-output");
  }
  if (variables.length) {
    tags.push("template");
    useCases.push("Prompt tái sử dụng với các biến thay thế");
  }
  if (/step by step|chain of thought|reason/u.test(source)) {
    tags.push("reasoning");
  }
  if (/seo|keyword/u.test(source)) {
    tags.push("seo");
  }

  const primaryGroup = groups[0] || "general";
  const cleanTitle =
    String(title || "").trim() ||
    prompt
      .replace(/\s+/gu, " ")
      .trim()
      .slice(0, 72) ||
    "Prompt chưa có tên";

  return {
    suggestedTitle: cleanTitle,
    summary: `Một prompt template thuộc nhóm ${primaryGroup} dành cho việc tái sử dụng${variables.length ? ` với ${variables.length} biến` : ""}.`,
    primaryGroup,
    groups: uniqueStrings([primaryGroup, ...groups]),
    tags: uniqueStrings(tags),
    useCases: uniqueStrings(
      useCases.length
        ? useCases
        : ["Prompt tái sử dụng cho việc tạo nội dung hoặc hỗ trợ AI có cấu trúc"]
    ),
    qualityNotes: [
      variables.length
        ? "Chứa các biến có thể tái sử dụng, giúp prompt dễ dàng được sử dụng lại cho nhiều mục đích."
        : "Hoạt động như một prompt trực tiếp mà không cần thêm các biến thay thế.",
    ],
    risks: [
      "Hãy kiểm tra lại các prompt đã lưu trước khi sử dụng chính thức vì phân loại do AI (hoặc thuật toán) tạo ra có thể không hoàn hảo.",
    ],
    variables: (variables || []).map((variable: any) => ({
      name: variable.name,
      purpose: "Biến thay thế được sử dụng trong prompt template.",
      suggestedType: "text",
    })),
  };
}

export function buildPromptAnalysisPrompt({ title, prompt, renderedPrompt, variables }: any) {
  return [
    "You are an expert prompt librarian and prompt engineer.",
    "Analyze the prompt below and return valid JSON only.",
    "Classify the prompt into practical library groups for future retrieval and reuse.",
    "Be concrete, concise, and useful.",
    "ALL content values and text inside the JSON MUST be written in Vietnamese.",
    "",
    "Return this exact JSON shape:",
    '{"suggestedTitle":"string","summary":"string","primaryGroup":"string","groups":["string"],"tags":["string"],"useCases":["string"],"qualityNotes":["string"],"risks":["string"],"variables":[{"name":"string","purpose":"string","suggestedType":"string"}]}',
    "",
    "Prompt metadata:",
    JSON.stringify(
      {
        title: title || "",
        prompt,
        renderedPrompt: renderedPrompt || "",
        variables: (variables || []).map((variable: any) => ({
          name: variable.name,
        })),
      },
      null,
      2
    ),
  ].join("\n");
}

export async function analyzePromptEntry(payload: any = {}) {
  const provider = payload.aiProvider || process.env.AI_PROVIDER || "gemini";
  const apiKey = provider === "wokushop" 
    ? (payload.wokushopApiKey || process.env.WOKUSHOP_API_KEY)
    : (payload.geminiApiKey || process.env.GEMINI_API_KEY);
  const model = provider === "wokushop"
    ? (payload.wokushopModel || process.env.WOKUSHOP_MODEL || "gemini-2.5-pro")
    : (payload.geminiModel || process.env.GEMINI_MODEL || "gemini-2.0-flash");
  
  const prompt = String(payload.prompt || "").trim();
  const renderedPrompt = String(payload.renderedPrompt || "").trim();
  const title = String(payload.title || "").trim();
  const variables = payload.variables || extractPromptVariablesForLibrary(prompt);

  if (!prompt) {
    throw new Error("Prompt text is required.");
  }

  const fallback = heuristicPromptAnalysis({
    title,
    prompt,
    renderedPrompt,
    variables,
  });

  if (!apiKey) {
    return {
      model: "heuristic-local",
      analyzedAt: new Date().toISOString(),
      analysis: fallback,
    };
  }

  try {
    const aiPrompt = buildPromptAnalysisPrompt({
      title,
      prompt,
      renderedPrompt,
      variables,
    });
    
    let raw;
    if (provider === "wokushop") {
      raw = await callWokushop({ apiKey, model, prompt: aiPrompt });
    } else {
      raw = await callGemini({ apiKey, model, prompt: aiPrompt });
    }
    
    const cleaned = raw.replace(/^```json\s*/u, "").replace(/```$/u, "").trim();
    const parsed = JSON.parse(cleaned);

    return {
      model,
      analyzedAt: new Date().toISOString(),
      analysis: {
        suggestedTitle: parsed.suggestedTitle || fallback.suggestedTitle,
        summary: parsed.summary || fallback.summary,
        primaryGroup: parsed.primaryGroup || fallback.primaryGroup,
        groups: uniqueStrings(parsed.groups || fallback.groups),
        tags: uniqueStrings(parsed.tags || fallback.tags),
        useCases: uniqueStrings(parsed.useCases || fallback.useCases),
        qualityNotes: uniqueStrings(parsed.qualityNotes || fallback.qualityNotes),
        risks: uniqueStrings(parsed.risks || fallback.risks),
        variables:
          Array.isArray(parsed.variables) && parsed.variables.length
            ? parsed.variables
            : fallback.variables,
      },
    };
  } catch (error: any) {
    return {
      model: `${model} (fallback)`,
      analyzedAt: new Date().toISOString(),
      analysis: fallback,
      warning: error.message,
    };
  }
}

function getNextPromptSequence(records: any[]) {
  const maxSequence = records.reduce((maxValue, record) => {
    const value = Number(record.sequence || 0);
    return Number.isFinite(value) ? Math.max(maxValue, value) : maxValue;
  }, 0);
  return maxSequence + 1;
}

function findPromptRecordById(id: string) {
  return readPromptLibraryRecords().find((record) => record.id === id) || null;
}

export function savePromptEntry(payload: any = {}) {
  const prompt = String(payload.prompt || "").trim();
  if (!prompt) {
    throw new Error("Prompt text is required.");
  }

  const existing: any = payload.id ? findPromptRecordById(String(payload.id).trim()) : null;
  const analysis = payload.analysis || existing?.analysis || null;
  const allRecords = readPromptLibraryRecords();
  const createdAt = existing?.createdAt || new Date().toISOString();
  const updatedAt = new Date().toISOString();
  const sequence = existing?.sequence || getNextPromptSequence(allRecords);
  const title =
    String(payload.title || "").trim() ||
    existing?.title ||
    `Prompt #${sequence}`;
  const primaryGroup = String(
    payload.primaryGroup || existing?.primaryGroup || "no-group"
  ).trim();
  const groupSlug = slugify(primaryGroup) || "no-group";
  const targetDir = path.join(PROMPT_LIBRARY_DIR, groupSlug);
  
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const id = existing?.id || `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  const filename = `${id}-${slugify(title) || "prompt"}.json`;
  const fullPath = path.join(targetDir, filename);

  const record = {
    id,
    sequence,
    createdAt,
    updatedAt,
    title,
    prompt,
    renderedPrompt: String(payload.renderedPrompt || "").trim(),
    variables: payload.variables || existing?.variables || extractPromptVariablesForLibrary(prompt),
    primaryGroup,
    groups: analysis ? uniqueStrings([primaryGroup, ...(analysis.groups || [])]) : [primaryGroup],
    tags: uniqueStrings(analysis?.tags || existing?.tags || []),
    useCases: uniqueStrings(analysis?.useCases || existing?.useCases || []),
    summary: analysis?.summary || existing?.summary || "",
    qualityNotes: uniqueStrings(analysis?.qualityNotes || existing?.qualityNotes || []),
    risks: uniqueStrings(analysis?.risks || existing?.risks || []),
    analysis,
    sourceUrl: String(payload.sourceUrl || existing?.sourceUrl || "").trim(),
    notes: String(payload.notes || existing?.notes || "").trim(),
    thumbnailDataUrl: Object.prototype.hasOwnProperty.call(payload, "thumbnailDataUrl")
      ? String(payload.thumbnailDataUrl || "").trim()
      : String(existing?.thumbnailDataUrl || "").trim(),
    thumbnailWidth: Number(payload.thumbnailWidth || existing?.thumbnailWidth || 0) || 0,
    thumbnailHeight: Number(payload.thumbnailHeight || existing?.thumbnailHeight || 0) || 0,
    thumbnailOrientation: String(
      payload.thumbnailOrientation || existing?.thumbnailOrientation || ""
    ).trim(),
  };

  if (existing?.filePath && existing.filePath !== fullPath && fs.existsSync(existing.filePath)) {
    fs.unlinkSync(existing.filePath);
  }

  fs.writeFileSync(fullPath, JSON.stringify(record, null, 2), "utf8");

  return {
    saved: true,
    path: fullPath,
    relativePath: path.relative(process.cwd(), fullPath),
    record,
  };
}

export function deletePromptEntry(id: string) {
  const requestedId = String(id || "").trim();
  if (!requestedId) {
    throw new Error("ID is required to delete a prompt.");
  }

  const record: any = findPromptRecordById(requestedId);
  if (!record || !record.filePath) {
    return { deleted: false, reason: "Not found" };
  }

  if (fs.existsSync(record.filePath)) {
    fs.unlinkSync(record.filePath);
    return { deleted: true, id: requestedId };
  }

  return { deleted: false, reason: "File missing" };
}
