const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { execFile } = require("child_process");
const { Readable } = require("stream");
const { URL } = require("url");

loadEnvFiles();

const PORT = process.env.PORT || 3000;
const DEFAULT_YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || "";
const DEFAULT_GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const AI_PROVIDER = process.env.AI_PROVIDER || "gemini";
const DEFAULT_WOKUSHOP_API_KEY = process.env.WOKUSHOP_API_KEY || "";
const DEFAULT_WOKUSHOP_MODEL = process.env.WOKUSHOP_MODEL || "gemini-2.5-pro";
const WOKUSHOP_BASE_URL = process.env.WOKUSHOP_BASE_URL || "https://llm.wokushop.com/v1";
const YT_DLP_PATH =
  process.env.YT_DLP_PATH ||
  "C:\\Users\\kienq\\AppData\\Local\\Programs\\Python\\Python310\\Scripts\\yt-dlp.exe";
const PUBLIC_DIR = path.join(__dirname, "public");
const MAX_RECENT_VIDEOS = 30;
const DOWNLOADS_DIR = path.join(__dirname, "downloads");
const PROMPT_LIBRARY_DIR = path.join(__dirname, "prompt-library");
const ANALYSIS_HISTORY_DIR = path.join(__dirname, "analysis-history");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
};

function loadEnvFiles() {
  const candidates = [".env", ".env.local"];

  for (const filename of candidates) {
    const fullPath = path.join(__dirname, filename);
    if (!fs.existsSync(fullPath)) {
      continue;
    }

    const content = fs.readFileSync(fullPath, "utf8");
    const lines = content.split(/\r?\n/u);

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex === -1) {
        continue;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      let value = trimmed.slice(separatorIndex + 1).trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  }
}

function decodeUrlSegmentSafe(value) {
  try {
    return decodeURIComponent(value);
  } catch (error) {
    return value;
  }
}

if (!fs.existsSync(DOWNLOADS_DIR)) {
  fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
}

if (!fs.existsSync(PROMPT_LIBRARY_DIR)) {
  fs.mkdirSync(PROMPT_LIBRARY_DIR, { recursive: true });
}

if (!fs.existsSync(ANALYSIS_HISTORY_DIR)) {
  fs.mkdirSync(ANALYSIS_HISTORY_DIR, { recursive: true });
}

function logServerEvent(scope, message, extra = null) {
  const timestamp = new Date().toISOString();
  if (extra) {
    console.log(`[${timestamp}] [${scope}] ${message}`, extra);
    return;
  }
  console.log(`[${timestamp}] [${scope}] ${message}`);
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify(data, null, 2));
}

function sendText(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(data);
}

function sendFile(res, fullPath, downloadName) {
  const ext = path.extname(fullPath).toLowerCase();
  const mime = MIME_TYPES[ext] || "application/octet-stream";
  const encodedName = encodeURIComponent(downloadName || path.basename(fullPath));

  res.writeHead(200, {
    "Content-Type": mime,
    "Content-Disposition": `attachment; filename*=UTF-8''${encodedName}`,
    "Access-Control-Allow-Origin": "*",
  });

  fs.createReadStream(fullPath).pipe(res);
}

async function sendRemoteFile(res, remoteUrl, downloadName, fallbackMime = "application/octet-stream") {
  const response = await fetch(remoteUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    },
  });

  if (!response.ok || !response.body) {
    throw new Error("Failed to fetch the remote file.");
  }

  const mime = response.headers.get("content-type") || fallbackMime;
  const encodedName = encodeURIComponent(downloadName || "download.bin");

  res.writeHead(200, {
    "Content-Type": mime,
    "Content-Disposition": `attachment; filename*=UTF-8''${encodedName}`,
    "Access-Control-Allow-Origin": "*",
  });

  Readable.fromWeb(response.body).pipe(res);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 8 * 1024 * 1024) {
        reject(new Error("Request body too large."));
      }
    });
    req.on("end", () => resolve(raw));
    req.on("error", reject);
  });
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let json;

  try {
    json = text ? JSON.parse(text) : {};
  } catch (error) {
    throw new Error(`Invalid JSON from upstream: ${text.slice(0, 200)}`);
  }

  if (!response.ok) {
    const message = json?.error?.message || `Upstream error ${response.status}`;
    throw new Error(message);
  }

  return json;
}

async function callGemini({ apiKey, model, prompt }) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const payload = {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.5,
      topP: 0.9,
      maxOutputTokens: 900,
    },
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let json;

  try {
    json = text ? JSON.parse(text) : {};
  } catch (error) {
    throw new Error(`Invalid Gemini response: ${text.slice(0, 200)}`);
  }

  if (!response.ok) {
    const message = json?.error?.message || `Gemini error ${response.status}`;
    throw new Error(message);
  }

  const candidate = json?.candidates?.[0];
  const parts = candidate?.content?.parts || [];
  const combined = parts
    .map((part) => part.text || "")
    .join("\n")
    .trim();

  if (!combined) {
    throw new Error("Gemini returned no text.");
  }

  return combined;
}

async function callWokushop({ apiKey, model, prompt }) {
  const endpoint = `${WOKUSHOP_BASE_URL}/chat/completions`;
  const payload = {
    model: model || DEFAULT_WOKUSHOP_MODEL,
    messages: [{ role: "user", content: prompt }],
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let json;

  try {
    json = text ? JSON.parse(text) : {};
  } catch (error) {
    throw new Error(`Invalid Wokushop response: ${text.slice(0, 200)}`);
  }

  if (!response.ok) {
    const message = json?.error?.message || `Wokushop error ${response.status}`;
    throw new Error(message);
  }

  const content = json?.choices?.[0]?.message?.content || "";
  if (!content) {
    throw new Error("Wokushop returned no text.");
  }

  return content;
}

function runExecFile(file, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(file, args, { windowsHide: true, maxBuffer: 20 * 1024 * 1024, ...options }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

function parseDurationToSeconds(duration) {
  const match =
    /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/u.exec(duration || "");

  if (!match) {
    return 0;
  }

  const days = Number(match[1] || 0);
  const hours = Number(match[2] || 0);
  const minutes = Number(match[3] || 0);
  const seconds = Number(match[4] || 0);
  return days * 86400 + hours * 3600 + minutes * 60 + seconds;
}

function average(items, key) {
  if (!items.length) {
    return 0;
  }

  const sum = items.reduce((acc, item) => acc + Number(item[key] || 0), 0);
  return sum / items.length;
}

function median(numbers) {
  if (!numbers.length) {
    return 0;
  }

  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function scoreToBand(score) {
  if (score >= 75) {
    return "strong";
  }
  if (score >= 50) {
    return "healthy";
  }
  if (score >= 30) {
    return "watch";
  }
  return "early";
}

function classifyContentProfile(shortRatio, avgDurationSeconds) {
  if (shortRatio >= 0.7) {
    return "shorts-heavy";
  }
  if (shortRatio >= 0.35) {
    return "hybrid";
  }
  if (avgDurationSeconds >= 900) {
    return "long-form deep";
  }
  return "long-form";
}

function estimateMonetization({
  recentAvgViews,
  avgDaysBetweenUploads,
  shortRatio,
  engagementRate,
  totalViews,
  totalVideos,
}) {
  const cadence = avgDaysBetweenUploads || 14;
  const uploadsPer30Days = cadence > 0 ? 30 / cadence : 0;
  const monthlyViewsEstimate = Math.max(0, recentAvgViews * uploadsPer30Days);
  const shortsPenalty = 1 - shortRatio * 0.55;
  const engagementBoost = clamp(1 + (engagementRate - 4) * 0.04, 0.8, 1.2);
  const baseRpmLow = 0.45 * shortsPenalty * engagementBoost;
  const baseRpmHigh = 3.5 * shortsPenalty * engagementBoost;
  const estimatedRpmLow = clamp(baseRpmLow, 0.15, 6);
  const estimatedRpmHigh = clamp(baseRpmHigh, 0.5, 12);
  const estimatedMonthlyRevenueLow = (monthlyViewsEstimate / 1000) * estimatedRpmLow;
  const estimatedMonthlyRevenueHigh =
    (monthlyViewsEstimate / 1000) * estimatedRpmHigh;
  const channelMaturityScore = clamp(
    (totalVideos >= 100 ? 25 : totalVideos * 0.25) +
      (totalViews >= 1000000 ? 25 : totalViews / 40000) +
      (recentAvgViews >= 50000 ? 25 : recentAvgViews / 2000) +
      clamp(engagementRate * 4, 0, 25),
    0,
    100
  );

  return {
    estimatedMonthlyViews: Math.round(monthlyViewsEstimate),
    estimatedRpmLow,
    estimatedRpmHigh,
    estimatedMonthlyRevenueLow,
    estimatedMonthlyRevenueHigh,
    channelMaturityScore,
    confidence: shortRatio >= 0.65 ? "low" : shortRatio >= 0.35 ? "medium" : "medium-high",
    notes: [
      "RPM/Doanh thu ước tính được mô phỏng từ số lượt xem gần đây, tần suất đăng video, mức độ tương tác và tỷ lệ shorts.",
      "Những con số này chỉ mang tính định hướng và không phải là dữ liệu YouTube Analytics được chủ kênh xác thực.",
    ],
  };
}

function buildGeminiPrompt({ channel, publicMetrics, estimates, ownerMetrics }) {
  const ownerSummary = ownerMetrics
    ? {
        verifiedRpm: ownerMetrics.monetization?.rpm || 0,
        verifiedRevenue: ownerMetrics.monetization?.estimatedRevenue || 0,
        netSubscribers: ownerMetrics.audience?.netSubscribers || 0,
        topCountries: (ownerMetrics.geography || []).slice(0, 5),
        demographics: (ownerMetrics.demographics || []).slice(0, 8),
      }
    : null;

  return [
    "You are a senior YouTube growth strategist.",
    "Analyze the channel metrics below and return valid JSON only.",
    "Focus on business insight, content strategy, monetization, risks, and next actions.",
    "Keep recommendations specific and practical.",
    "ALL content values and text inside the JSON MUST be written in Vietnamese.",
    "",
    "Return this exact JSON shape:",
    '{"summary":"string","strengths":["string"],"risks":["string"],"opportunities":["string"],"nextActions":["string"],"monetizationView":"string","contentStrategy":"string"}',
    "",
    "Channel data:",
    JSON.stringify(
      {
        channel: {
          title: channel.title,
          channelId: channel.id,
          country: channel.country,
          subscriberCount: channel.subscriberCount,
          totalViews: channel.totalViews,
          totalVideos: channel.videoCount,
        },
        publicMetrics,
        estimates,
        ownerMetrics: ownerSummary,
      },
      null,
      2
    ),
  ].join("\n");
}

async function buildAiInsights(payload) {
  const provider = payload.aiProvider || AI_PROVIDER;
  const apiKey = provider === "wokushop" 
    ? (payload.wokushopApiKey || DEFAULT_WOKUSHOP_API_KEY)
    : (payload.geminiApiKey || DEFAULT_GEMINI_API_KEY);
  const model = provider === "wokushop"
    ? (payload.wokushopModel || DEFAULT_WOKUSHOP_MODEL)
    : (payload.geminiModel || DEFAULT_GEMINI_MODEL);
  const { channel, publicMetrics, estimates, ownerMetrics } = payload;

  if (!apiKey) {
    throw new Error(`${provider === "wokushop" ? "Wokushop" : "Gemini"} API key is not configured.`);
  }

  if (!channel || !publicMetrics || !estimates) {
    throw new Error("channel, publicMetrics, and estimates are required for AI insights.");
  }

  const prompt = buildGeminiPrompt({
    channel,
    publicMetrics,
    estimates,
    ownerMetrics,
  });

  let raw;
  if (provider === "wokushop") {
    raw = await callWokushop({ apiKey, model, prompt });
  } else {
    raw = await callGemini({ apiKey, model, prompt });
  }
  const cleaned = raw.replace(/^```json\s*/u, "").replace(/```$/u, "").trim();
  let parsed;

  try {
    parsed = JSON.parse(cleaned);
  } catch (error) {
    parsed = {
      summary: raw,
      strengths: [],
      risks: [],
      opportunities: [],
      nextActions: [],
      monetizationView: "",
      contentStrategy: "",
    };
  }

  return {
    model,
    generatedAt: new Date().toISOString(),
    insights: parsed,
  };
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/gu, "")
    .trim()
    .replace(/[\s_-]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 80);
}

function extractPromptVariablesForLibrary(template) {
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

function uniqueStrings(items) {
  return Array.from(
    new Set(
      (items || [])
        .map((item) => String(item || "").trim())
        .filter(Boolean)
    )
  );
}

function buildPromptAnalysisPrompt({ title, prompt, renderedPrompt, variables }) {
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
        variables: (variables || []).map((variable) => ({
          name: variable.name,
        })),
      },
      null,
      2
    ),
  ].join("\n");
}

function heuristicPromptAnalysis({ title, prompt, renderedPrompt, variables }) {
  const source = `${title || ""}\n${prompt}\n${renderedPrompt || ""}`.toLowerCase();
  const groups = [];
  const tags = [];
  const useCases = [];

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
    variables: (variables || []).map((variable) => ({
      name: variable.name,
      purpose: "Biến thay thế được sử dụng trong prompt template.",
      suggestedType: "text",
    })),
  };
}

async function analyzePromptEntry(payload = {}) {
  const provider = payload.aiProvider || AI_PROVIDER;
  const apiKey = provider === "wokushop" 
    ? (payload.wokushopApiKey || DEFAULT_WOKUSHOP_API_KEY)
    : (payload.geminiApiKey || DEFAULT_GEMINI_API_KEY);
  const model = provider === "wokushop"
    ? (payload.wokushopModel || DEFAULT_WOKUSHOP_MODEL)
    : (payload.geminiModel || DEFAULT_GEMINI_MODEL);
  const prompt = String(payload.prompt || "").trim();
  const renderedPrompt = String(payload.renderedPrompt || "").trim();
  const title = String(payload.title || "").trim();
  const variables = payload.variables || extractPromptVariablesForLibrary(prompt);

  if (!prompt) {
    throw new Error("Prompt text is required.");
  }

  logServerEvent("prompt-analyze", "analysis requested", {
    length: prompt.length,
    hasApiKey: Boolean(apiKey),
    provider,
    variableCount: Array.isArray(variables) ? variables.length : 0,
  });

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
  } catch (error) {
    return {
      model: `${model} (fallback)`,
      analyzedAt: new Date().toISOString(),
      analysis: fallback,
      warning: error.message,
    };
  }
}

function readPromptLibraryRecords() {
  const records = [];

  function visit(dir) {
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
          relativePath: path.relative(__dirname, fullPath),
        });
      } catch (error) {
        // Ignore invalid library records so one bad file does not break the library.
      }
    }
  }

  visit(PROMPT_LIBRARY_DIR);
  return records.sort(
    (a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0)
  );
}

function queryPromptLibrary({ search = "", group = "" } = {}) {
  const searchText = String(search || "").trim().toLowerCase();
  const groupFilter = String(group || "").trim().toLowerCase();
  const all = readPromptLibraryRecords().filter((record) => !record.deletedAt);

  const items = all.filter((record) => {
    const matchesGroup = !groupFilter
      ? true
      : [record.primaryGroup, ...(record.groups || [])]
          .map((item) => String(item || "").toLowerCase())
          .includes(groupFilter);

    if (!matchesGroup) {
      return false;
    }

    if (!searchText) {
      return true;
    }

    const haystack = [
      record.title,
      record.prompt,
      record.renderedPrompt,
      record.summary,
      ...(record.tags || []),
      ...(record.groups || []),
      ...(record.useCases || []),
    ]
      .join("\n")
      .toLowerCase();

    return haystack.includes(searchText);
  });

  const groups = Array.from(
    new Set(
      all.flatMap((record) => [record.primaryGroup, ...(record.groups || [])]).filter(Boolean)
    )
  ).sort((a, b) => String(a).localeCompare(String(b)));

  return {
    rootDir: PROMPT_LIBRARY_DIR,
    total: all.length,
    filtered: items.length,
    groups,
    items,
  };
}

function getNextPromptSequence(records = readPromptLibraryRecords()) {
  const maxSequence = records.reduce((maxValue, record) => {
    const value = Number(record.sequence || 0);
    return Number.isFinite(value) ? Math.max(maxValue, value) : maxValue;
  }, 0);
  return maxSequence + 1;
}

function findPromptRecordById(id) {
  return readPromptLibraryRecords().find((record) => record.id === id) || null;
}

function findAnyPromptRecordById(id) {
  return readPromptLibraryRecords().find((record) => record.id === id) || null;
}

function savePromptEntry(payload = {}) {
  const prompt = String(payload.prompt || "").trim();
  if (!prompt) {
    throw new Error("Prompt text is required.");
  }

  logServerEvent("prompt-save", "save requested", {
    length: prompt.length,
    title: String(payload.title || "").trim() || "(untitled)",
  });

  const existing = payload.id ? findPromptRecordById(String(payload.id).trim()) : null;
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
  fs.mkdirSync(targetDir, { recursive: true });

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

  logServerEvent("prompt-save", "save completed", {
    relativePath: path.relative(__dirname, fullPath),
    primaryGroup,
  });

  return {
    saved: true,
    path: fullPath,
    relativePath: path.relative(__dirname, fullPath),
    record,
  };
}

function deletePromptEntry(id) {
  const requestedId = String(id || "").trim();
  const existing = findAnyPromptRecordById(requestedId);
  logServerEvent("prompt-delete", "delete lookup", {
    requestedId,
    found: Boolean(existing),
    filePath: existing?.filePath || "",
    alreadyDeleted: Boolean(existing?.deletedAt),
  });
  if (!existing?.filePath || !fs.existsSync(existing.filePath)) {
    throw new Error("Prompt record not found.");
  }

  if (existing.deletedAt) {
    return {
      deleted: true,
      alreadyDeleted: true,
      id: existing.id,
      relativePath: existing.relativePath,
    };
  }

  try {
    const { filePath, relativePath, ...persistedRecord } = existing;
    const nextRecord = {
      ...persistedRecord,
      deletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(existing.filePath, `${JSON.stringify(nextRecord, null, 2)}\n`, "utf8");
  } catch (error) {
    logServerEvent("prompt-delete", "soft delete failed", {
      filePath: existing.filePath,
      error: error.message,
    });
    throw error;
  }
  logServerEvent("prompt-delete", "delete completed", {
    id: existing.id,
    relativePath: existing.relativePath,
  });

  return {
    deleted: true,
    id: existing.id,
    relativePath: existing.relativePath,
  };
}

function getIdFromInput(input) {
  const value = (input || "").trim();
  if (!value) {
    return { type: "unknown", value: "" };
  }

  if (value.startsWith("UC") && value.length >= 24) {
    return { type: "channelId", value };
  }

  if (value.startsWith("@")) {
    return { type: "handle", value: decodeUrlSegmentSafe(value.slice(1)) };
  }

  try {
    const parsed = new URL(value);
    const parts = parsed.pathname
      .split("/")
      .filter(Boolean)
      .map((part) => decodeUrlSegmentSafe(part));

    if (parts[0] === "channel" && parts[1]) {
      return { type: "channelId", value: parts[1] };
    }

    if (parts[0] === "@" && parts[1]) {
      return { type: "handle", value: parts[1] };
    }

    if (parts[0] && parts[0].startsWith("@")) {
      return { type: "handle", value: parts[0].slice(1) };
    }

    if (parts[0]) {
      return { type: "handleOrSearch", value: parts[0] };
    }
  } catch (error) {
    return { type: "handleOrSearch", value: decodeUrlSegmentSafe(value) };
  }

  return { type: "handleOrSearch", value: decodeUrlSegmentSafe(value) };
}

function getVideoIdFromInput(input) {
  const value = (input || "").trim();
  if (!value) {
    return "";
  }

  if (/^[a-zA-Z0-9_-]{11}$/u.test(value)) {
    return value;
  }

  try {
    const parsed = new URL(value);
    if (parsed.hostname.includes("youtu.be")) {
      return parsed.pathname.replace(/\//gu, "").trim();
    }

    const queryId = parsed.searchParams.get("v");
    if (queryId) {
      return queryId;
    }

    const parts = parsed.pathname.split("/").filter(Boolean);
    const shortsIndex = parts.indexOf("shorts");
    if (shortsIndex !== -1 && parts[shortsIndex + 1]) {
      return parts[shortsIndex + 1];
    }
  } catch (error) {
    return "";
  }

  return "";
}

function sanitizeFilenamePart(value) {
  return String(value || "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 80);
}

function makeWorkDir(prefix) {
  const dir = path.join(
    DOWNLOADS_DIR,
    `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`
  );
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function formatDurationHuman(seconds) {
  const value = Number(seconds || 0);
  if (!value) {
    return "0:00";
  }
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const secs = Math.floor(value % 60);
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

function extractJsonAfterMarker(source, marker) {
  const markerIndex = source.indexOf(marker);
  if (markerIndex === -1) {
    return null;
  }

  const jsonStart = source.indexOf("{", markerIndex);
  if (jsonStart === -1) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = jsonStart; i < source.length; i += 1) {
    const char = source[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(jsonStart, i + 1);
      }
    }
  }

  return null;
}

async function getVideoPageData(videoInput) {
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

async function getVideoMetadata(videoInput) {
  const { videoId, watchUrl, player } = await getVideoPageData(videoInput);
  const videoDetails = player.videoDetails || {};
  const microformat = player.microformat?.playerMicroformatRenderer || {};
  const captionTracks =
    player.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
  const autoTracks =
    player.captions?.playerCaptionsTracklistRenderer?.audioTracks || [];
  const allFormats = [
    ...(player.streamingData?.formats || []),
    ...(player.streamingData?.adaptiveFormats || []),
  ];
  const directFormat = allFormats.find(
    (format) =>
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
    subtitles: captionTracks.map((track) => track.languageCode),
    automaticCaptions: autoTracks
      .flatMap((track) => (track.captionTrackIndices || []).map((index) => captionTracks[index]?.languageCode))
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

function vttToPlainText(content) {
  return content
    .replace(/^WEBVTT.*$/gmu, "")
    .replace(/^\d+\s*$/gmu, "")
    .replace(/^\d{2}:\d{2}(?::\d{2})?\.\d{3}\s+-->\s+\d{2}:\d{2}(?::\d{2})?\.\d{3}.*$/gmu, "")
    .replace(/<[^>]+>/gu, "")
    .replace(/&nbsp;/gu, " ")
    .replace(/\n{2,}/gu, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

function pickCaptionTrack(captionTracks, preferredLang = "en") {
  const ranked = [
    `${preferredLang}-US`,
    preferredLang,
    "en-US",
    "en",
    "vi",
  ];

  for (const code of ranked) {
    const matched = captionTracks.find((track) => track.languageCode === code);
    if (matched) {
      return matched;
    }
  }

  return captionTracks[0] || null;
}

async function downloadTranscript(videoInput, preferredLang = "en") {
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

async function downloadThumbnail(videoInput) {
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

async function getDirectVideoStream(videoInput) {
  const metadata = await getVideoMetadata(videoInput);
  const directFormat = [
    ...(metadata.streamingData?.formats || []),
    ...(metadata.streamingData?.adaptiveFormats || []),
  ].find(
    (format) =>
      format.url &&
      typeof format.mimeType === "string" &&
      format.mimeType.includes("video/mp4")
  );

  if (!directFormat?.url) {
    throw new Error(
      "Direct video download is not available for this video in the current environment."
    );
  }

  const safeTitle = sanitizeFilenamePart(metadata.title || metadata.id || "video");
  return {
    url: directFormat.url,
    filename: `${safeTitle}.mp4`,
  };
}

async function getChannelDetailsById(apiKey, channelId) {
  const details = await fetchJson(
    `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails,brandingSettings&id=${encodeURIComponent(
      channelId
    )}&key=${encodeURIComponent(apiKey)}`
  );

  if (!details.items?.length) {
    throw new Error("Resolved channel but could not fetch channel details.");
  }

  return details.items[0];
}

async function resolveChannelIdFromPublicPage(input, parsed) {
  let targetUrl = "";

  try {
    const parsedUrl = new URL(input);
    targetUrl = parsedUrl.toString();
  } catch (error) {
    if (parsed.type === "handle" && parsed.value) {
      targetUrl = `https://www.youtube.com/@${encodeURIComponent(parsed.value)}`;
    } else if (parsed.value) {
      targetUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(parsed.value)}`;
    }
  }

  if (!targetUrl) {
    return "";
  }

  const response = await fetch(targetUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9,vi;q=0.8",
    },
  });

  if (!response.ok) {
    return "";
  }

  const html = await response.text();
  const matchers = [
    /"externalId":"(UC[a-zA-Z0-9_-]{20,})"/u,
    /"channelId":"(UC[a-zA-Z0-9_-]{20,})"/u,
    /youtube\.com\/channel\/(UC[a-zA-Z0-9_-]{20,})/u,
    /"browseId":"(UC[a-zA-Z0-9_-]{20,})"/u,
  ];

  for (const matcher of matchers) {
    const match = html.match(matcher);
    if (match?.[1]) {
      return match[1];
    }
  }

  return "";
}

async function resolveChannel(apiKey, input) {
  const parsed = getIdFromInput(input);

  if (parsed.type === "channelId") {
    return getChannelDetailsById(apiKey, parsed.value);
  }

  if (parsed.type === "handle") {
    try {
      const byHandle = await fetchJson(
        `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails,brandingSettings&forHandle=${encodeURIComponent(
          parsed.value
        )}&key=${encodeURIComponent(apiKey)}`
      );

      if (byHandle.items?.length) {
        return byHandle.items[0];
      }
    } catch (error) {
      // Fall through to public-page resolution and search fallback.
    }

    const publicPageChannelId = await resolveChannelIdFromPublicPage(input, parsed);
    if (publicPageChannelId) {
      return getChannelDetailsById(apiKey, publicPageChannelId);
    }
  }

  const query = parsed.value;
  let search = { items: [] };
  try {
    search = await fetchJson(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&maxResults=5&q=${encodeURIComponent(query)}&key=${encodeURIComponent(apiKey)}`
    );
  } catch (error) {
    search = { items: [] };
  }

  if (!search.items?.length) {
    const publicPageChannelId = await resolveChannelIdFromPublicPage(input, parsed);
    if (publicPageChannelId) {
      return getChannelDetailsById(apiKey, publicPageChannelId);
    }
    throw new Error("No channel matched the provided handle, URL, or keyword.");
  }

  const channelId = search.items[0].snippet.channelId;
  return getChannelDetailsById(apiKey, channelId);
}

async function getUploads(apiKey, playlistId, maxResults = MAX_RECENT_VIDEOS) {
  const items = [];
  let pageToken = "";

  while (items.length < maxResults) {
    const page = await fetchJson(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${encodeURIComponent(playlistId)}&maxResults=${Math.min(
        50,
        maxResults - items.length
      )}&pageToken=${encodeURIComponent(pageToken)}&key=${encodeURIComponent(apiKey)}`
    );

    items.push(...(page.items || []));
    if (!page.nextPageToken || !page.items?.length) {
      break;
    }
    pageToken = page.nextPageToken;
  }

  return items;
}

async function getVideoDetails(apiKey, videoIds) {
  if (!videoIds.length) {
    return [];
  }

  const chunks = [];
  for (let i = 0; i < videoIds.length; i += 50) {
    chunks.push(videoIds.slice(i, i + 50));
  }

  const results = [];
  for (const chunk of chunks) {
    const page = await fetchJson(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${encodeURIComponent(chunk.join(","))}&key=${encodeURIComponent(apiKey)}`
    );
    results.push(...(page.items || []));
  }

  return results;
}

function buildPublicMetrics(channel, videos) {
  const totalViews = Number(channel.statistics?.viewCount || 0);
  const totalVideos = Number(channel.statistics?.videoCount || 0);
  const avgViewsPerVideo = totalVideos ? totalViews / totalVideos : 0;
  const normalizedVideos = videos.map((video) => {
    const seconds = parseDurationToSeconds(video.contentDetails?.duration);
    const publishedAt = video.snippet?.publishedAt || null;
    return {
      id: video.id,
      title: video.snippet?.title || "Untitled",
      publishedAt,
      views: Number(video.statistics?.viewCount || 0),
      likes: Number(video.statistics?.likeCount || 0),
      comments: Number(video.statistics?.commentCount || 0),
      durationSeconds: seconds,
      isShort: seconds > 0 && seconds <= 60,
      thumbnail:
        video.snippet?.thumbnails?.medium?.url ||
        video.snippet?.thumbnails?.default?.url ||
        "",
      url: `https://www.youtube.com/watch?v=${video.id}`,
    };
  });

  const videosSortedByDate = [...normalizedVideos].sort((a, b) =>
    (b.publishedAt || "").localeCompare(a.publishedAt || "")
  );
  const latestVideo = videosSortedByDate[0] || null;
  const shortCount = normalizedVideos.filter((video) => video.isShort).length;
  const cadenceDays = [];

  for (let i = 1; i < videosSortedByDate.length; i += 1) {
    const newer = new Date(videosSortedByDate[i - 1].publishedAt).getTime();
    const older = new Date(videosSortedByDate[i].publishedAt).getTime();
    const diff = (newer - older) / (1000 * 60 * 60 * 24);
    if (Number.isFinite(diff) && diff >= 0) {
      cadenceDays.push(diff);
    }
  }

  const viewsArray = normalizedVideos.map((video) => video.views);
  const recentAvgViews = average(normalizedVideos, "views");
  const recentMedianViews = median(viewsArray);
  const avgLikes = average(normalizedVideos, "likes");
  const avgComments = average(normalizedVideos, "comments");
  const avgDurationSeconds = average(normalizedVideos, "durationSeconds");
  const engagementRate = recentAvgViews
    ? ((avgLikes + avgComments) / recentAvgViews) * 100
    : 0;
  const topRecentVideos = [...normalizedVideos]
    .sort((a, b) => b.views - a.views)
    .slice(0, 10);
  const avgDaysBetweenUploads = average(
    cadenceDays.map((value) => ({ value })),
    "value"
  );
  const shortRatio = normalizedVideos.length ? shortCount / normalizedVideos.length : 0;
  const contentProfile = classifyContentProfile(shortRatio, avgDurationSeconds);
  const estimated = estimateMonetization({
    recentAvgViews,
    avgDaysBetweenUploads,
    shortRatio,
    engagementRate,
    totalViews,
    totalVideos,
  });
  const uploadConsistencyScore = clamp(
    avgDaysBetweenUploads > 0 ? 100 - avgDaysBetweenUploads * 3 : 0,
    0,
    100
  );
  const growthScore = Math.round(
    clamp(
      recentAvgViews > 0 ? recentMedianViews / recentAvgViews : 0,
      0,
      1.2
    ) *
      35 +
      clamp(engagementRate * 6, 0, 30) +
      clamp(uploadConsistencyScore * 0.35, 0, 35)
  );

  return {
    channel: {
      id: channel.id,
      title: channel.snippet?.title || "",
      description: channel.snippet?.description || "",
      customUrl: channel.snippet?.customUrl || "",
      publishedAt: channel.snippet?.publishedAt || "",
      country: channel.snippet?.country || "",
      subscriberCount: Number(channel.statistics?.subscriberCount || 0),
      hiddenSubscriberCount: Boolean(channel.statistics?.hiddenSubscriberCount),
      videoCount: totalVideos,
      totalViews,
      thumbnail:
        channel.snippet?.thumbnails?.high?.url ||
        channel.snippet?.thumbnails?.default?.url ||
        "",
      banner:
        channel.brandingSettings?.image?.bannerExternalUrl ||
        channel.brandingSettings?.image?.bannerMobileExtraHdImageUrl ||
        "",
      uploadsPlaylistId:
        channel.contentDetails?.relatedPlaylists?.uploads || "",
    },
    publicMetrics: {
      avgViewsPerVideo,
      totalViews,
      totalVideos,
      lastUpdated:
        latestVideo?.publishedAt || channel.snippet?.publishedAt || null,
      hasShort: shortCount > 0,
      shortCount,
      shortRatio,
      recentAvgViews,
      recentMedianViews,
      avgLikes,
      avgComments,
      avgDurationSeconds,
      engagementRate,
      avgDaysBetweenUploads,
      contentProfile,
      uploadConsistencyScore,
      growthScore,
      growthBand: scoreToBand(growthScore),
      fetchedAt: new Date().toISOString(),
    },
    estimates: {
      ...estimated,
    },
    recentVideos: videosSortedByDate,
    topRecentVideos,
    chartFallback: videosSortedByDate
      .slice()
      .reverse()
      .map((video) => ({
        label: video.publishedAt ? video.publishedAt.slice(0, 10) : video.title,
        views: video.views,
        title: video.title,
      })),
    notes: [
      "Dữ liệu công khai có thể ước tính hiệu suất kênh nhưng không thể hiển thị doanh thu ẩn hoặc phân tích nhân khẩu học.",
      "RPM và doanh thu ước tính là những con số mô phỏng dựa trên phân tích từ đường dẫn.",
      "Xu hướng người đăng ký, RPM, địa lý, và độ tuổi/giới tính yêu cầu quyền truy cập YouTube Analytics từ chủ kênh.",
    ],
  };
}

async function fetchAnalyticsReport({
  accessToken,
  ids,
  startDate,
  endDate,
  metrics,
  dimensions,
  sort,
  maxResults,
}) {
  const params = new URLSearchParams({
    ids,
    startDate,
    endDate,
    metrics,
  });

  if (dimensions) {
    params.set("dimensions", dimensions);
  }
  if (sort) {
    params.set("sort", sort);
  }
  if (maxResults) {
    params.set("maxResults", String(maxResults));
  }

  const url = `https://youtubeanalytics.googleapis.com/v2/reports?${params.toString()}`;
  return fetchJson(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

function mapRows(columns = [], rows = []) {
  return rows.map((row) =>
    columns.reduce((acc, column, index) => {
      acc[column.name] = row[index];
      return acc;
    }, {})
  );
}

async function buildOwnerMetrics(payload) {
  const {
    accessToken,
    channelId,
    startDate: requestedStartDate,
    endDate: requestedEndDate,
  } = payload;
  const startDate =
    requestedStartDate ||
    new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
  const endDate = requestedEndDate || new Date().toISOString().slice(0, 10);

  if (!accessToken || !channelId) {
    throw new Error("Both accessToken and channelId are required.");
  }

  const ids = `channel==${channelId}`;
  const [timeseries, demographics, geography] = await Promise.all([
    fetchAnalyticsReport({
      accessToken,
      ids,
      startDate,
      endDate,
      metrics:
        "views,estimatedRevenue,subscribersGained,subscribersLost,watchTime",
      dimensions: "day",
      sort: "day",
    }),
    fetchAnalyticsReport({
      accessToken,
      ids,
      startDate,
      endDate,
      metrics: "viewerPercentage",
      dimensions: "ageGroup,gender",
      sort: "-viewerPercentage",
      maxResults: 50,
    }),
    fetchAnalyticsReport({
      accessToken,
      ids,
      startDate,
      endDate,
      metrics: "views,estimatedRevenue,watchTime",
      dimensions: "country",
      sort: "-views",
      maxResults: 20,
    }),
  ]);

  const timeRows = mapRows(timeseries.columnHeaders, timeseries.rows || []);
  const demoRows = mapRows(demographics.columnHeaders, demographics.rows || []);
  const geoRows = mapRows(geography.columnHeaders, geography.rows || []);

  const totals = timeRows.reduce(
    (acc, row) => {
      acc.views += Number(row.views || 0);
      acc.estimatedRevenue += Number(row.estimatedRevenue || 0);
      acc.subscribersGained += Number(row.subscribersGained || 0);
      acc.subscribersLost += Number(row.subscribersLost || 0);
      acc.watchTime += Number(row.watchTime || 0);
      return acc;
    },
    {
      views: 0,
      estimatedRevenue: 0,
      subscribersGained: 0,
      subscribersLost: 0,
      watchTime: 0,
    }
  );

  const rpm = totals.views ? (totals.estimatedRevenue / totals.views) * 1000 : 0;

  return {
    dateRange: { startDate, endDate },
    monetization: {
      estimatedRevenue: totals.estimatedRevenue,
      rpm,
    },
    audience: {
      netSubscribers: totals.subscribersGained - totals.subscribersLost,
      subscribersGained: totals.subscribersGained,
      subscribersLost: totals.subscribersLost,
      watchTimeMinutes: totals.watchTime,
    },
    charts: {
      viewsAndSubscribers: timeRows.map((row) => ({
        day: row.day,
        views: Number(row.views || 0),
        subscribersGained: Number(row.subscribersGained || 0),
        subscribersLost: Number(row.subscribersLost || 0),
        netSubscribers:
          Number(row.subscribersGained || 0) - Number(row.subscribersLost || 0),
        estimatedRevenue: Number(row.estimatedRevenue || 0),
      })),
    },
    demographics: demoRows.map((row) => ({
      ageGroup: row.ageGroup,
      gender: row.gender,
      viewerPercentage: Number(row.viewerPercentage || 0),
    })),
    geography: geoRows.map((row) => ({
      country: row.country,
      views: Number(row.views || 0),
      estimatedRevenue: Number(row.estimatedRevenue || 0),
      watchTime: Number(row.watchTime || 0),
    })),
    notes: [
      "RPM is derived as estimatedRevenue / views * 1000.",
      "Owner analytics only work when the OAuth token belongs to a manager/owner of the same YouTube channel.",
    ],
  };
}

// ── Competitor Finder ──────────────────────────────────────────

function buildChannelDnaPrompt(channel, videoTitles) {
  return `You are an elite YouTube channel analyst. Analyze the following YouTube channel and determine its "Channel DNA".

Channel Name: ${channel.snippet?.title || ""}
Channel Description: ${channel.snippet?.description || "No description"}
Channel Keywords: ${channel.brandingSettings?.channel?.keywords || "None"}

Recent Video Titles:
${videoTitles.map((t, i) => `${i + 1}. ${t}`).join("\n")}

Based on this data, return EXACTLY a JSON object with:
1. "topic": The core subject matter (1-3 words).
2. "contentStyle": The format of the videos (e.g. "Faceless Whiteboard Animation", "Talking Head", "Vlog", "Gameplay", "News Voiceover").
3. "tone": The vibe or tone of the channel (e.g. "Humorous", "Educational & Serious", "Dramatic", "Relaxing").
4. "searchQueries": An array of 3-5 hyper-specific YouTube search queries that combine the topic and content style to find DIRECT competitors (e.g. ["faceless whiteboard personal finance", "finance animation education"]).
5. "language": The primary language of the content.

Return ONLY valid JSON, no markdown, no explanation.`;
}

function buildCompetitorFilterPrompt(sourceDna, candidates) {
  const candidateList = candidates
    .map(
      (c, i) =>
        `[ID: ${c.channelId}]\nTitle: ${c.title}\nDesc: ${c.description}\n---\n`
    )
    .join("\n");

  return `You are a YouTube competitive analysis AI. Your job is to filter a list of potential competitor channels to find only the TRUE competitors.

SOURCE CHANNEL DNA:
- Topic: ${sourceDna.topic}
- Content Style: ${sourceDna.contentStyle}
- Tone: ${sourceDna.tone}
- Language: ${sourceDna.language}

POTENTIAL COMPETITORS:
${candidateList}

TASK:
Filter the potential competitors. Remove any channels that do NOT match the Source Channel's "Content Style", "Tone", or "Language". For example, if the source is "Faceless Animation", remove "Talking Head Vloggers" even if they talk about the same topic.

Return EXACTLY a JSON array containing ONLY the string "channelId" of the true competitors, sorted from most similar to least similar.
Example: ["UC1234567890", "UC0987654321"]
Return ONLY the JSON array, no markdown.`;
}

function buildCompetitorAnalysisPrompt(source, competitors) {
  const compList = competitors
    .slice(0, 10)
    .map(
      (c, i) =>
        `${i + 1}. ${c.title} (${c.customUrl || c.channelId}) — ${Number(c.subscribers).toLocaleString()} subs, ${Number(c.totalViews).toLocaleString()} views, ${c.videoCount} videos`
    )
    .join("\n");

  return `You are a YouTube competitive analysis expert. Analyze the competitive landscape for the following channel.
All analysis MUST be written in Vietnamese.

SOURCE CHANNEL:
- Name: ${source.title}
- Subscribers: ${Number(source.subscribers).toLocaleString()}
- Total Views: ${Number(source.totalViews).toLocaleString()}
- Videos: ${source.videoCount}
- Niche: ${source.nicheDescription || source.nicheKeywords?.join(", ") || "Unknown"}

COMPETITOR CHANNELS:
${compList}

Return a JSON object with:
{
  "nichePosition": "Vị trí của kênh gốc so với đối thủ (leader/challenger/follower/niche player)",
  "summary": "Tóm tắt 2-3 câu về bức tranh cạnh tranh",
  "strengths": ["Điểm mạnh 1", "Điểm mạnh 2"],
  "weaknesses": ["Điểm yếu 1", "Điểm yếu 2"],
  "opportunities": ["Cơ hội 1", "Cơ hội 2"],
  "threats": ["Mối đe dọa 1", "Mối đe dọa 2"],
  "topCompetitors": ["Tên kênh đối thủ đáng chú ý nhất", "..."],
  "recommendations": ["Gợi ý chiến lược 1", "Gợi ý chiến lược 2"]
}
Return ONLY valid JSON, no markdown.`;
}

async function extractChannelDna(apiKey, channel) {
  const uploadsPlaylistId = channel.contentDetails?.relatedPlaylists?.uploads;
  let videoTitles = [];

  if (uploadsPlaylistId) {
    try {
      const uploads = await getUploads(apiKey, uploadsPlaylistId, 15);
      const videoIds = uploads
        .map((item) => item.contentDetails?.videoId)
        .filter(Boolean);
      const videos = await getVideoDetails(apiKey, videoIds);
      videoTitles = videos.map((v) => v.snippet?.title || "").filter(Boolean);
    } catch (error) {
      logServerEvent("competitors", "failed to fetch videos for dna", {
        error: error.message,
      });
    }
  }

  const prompt = buildChannelDnaPrompt(channel, videoTitles);
  const provider = AI_PROVIDER;
  const geminiKey = DEFAULT_GEMINI_API_KEY;
  const wokushopKey = DEFAULT_WOKUSHOP_API_KEY;

  let raw;
  try {
    if (provider === "wokushop" && wokushopKey) {
      raw = await callWokushop({
        apiKey: wokushopKey,
        model: DEFAULT_WOKUSHOP_MODEL,
        prompt,
      });
    } else if (geminiKey) {
      raw = await callGemini({
        apiKey: geminiKey,
        model: DEFAULT_GEMINI_MODEL,
        prompt,
      });
    } else {
      const title = channel.snippet?.title || "youtube channel";
      return {
        topic: title,
        contentStyle: "Unknown",
        tone: "Unknown",
        searchQueries: [title],
        language: "Unknown",
      };
    }
  } catch (error) {
    logServerEvent("competitors", "AI DNA extraction failed", {
      error: error.message,
    });
    return {
      topic: channel.snippet?.title || "youtube channel",
      contentStyle: "Unknown",
      tone: "Unknown",
      searchQueries: [channel.snippet?.title || "youtube"],
      language: "Unknown",
    };
  }

  const cleaned = raw.replace(/^```json\s*/u, "").replace(/```$/u, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    return {
      topic: parsed.topic || channel.snippet?.title || "Unknown",
      contentStyle: parsed.contentStyle || "Unknown",
      tone: parsed.tone || "Unknown",
      searchQueries: parsed.searchQueries || [channel.snippet?.title || "youtube"],
      language: parsed.language || "Unknown",
    };
  } catch (error) {
    return {
      topic: channel.snippet?.title || "Unknown",
      contentStyle: "Unknown",
      tone: "Unknown",
      searchQueries: [channel.snippet?.title || "youtube"],
      language: "Unknown",
    };
  }
}

async function searchCompetitorChannels(
  apiKey,
  keywords,
  sourceChannelId,
  maxResults = 10
) {
  const channelIdSet = new Set();
  const channelIdOrder = [];

  // Strategy 1: Search for channels directly by each keyword
  for (const keyword of keywords.slice(0, 3)) {
    try {
      const data = await fetchJson(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&maxResults=15&q=${encodeURIComponent(
          keyword
        )}&key=${encodeURIComponent(apiKey)}`
      );
      for (const item of data.items || []) {
        const cid = item.snippet?.channelId || item.id?.channelId;
        if (cid && cid !== sourceChannelId && !channelIdSet.has(cid)) {
          channelIdSet.add(cid);
          channelIdOrder.push(cid);
        }
      }
    } catch (error) {
      logServerEvent("competitors", `channel search failed for "${keyword}"`, {
        error: error.message,
      });
    }
  }

  // Strategy 2: Search for popular videos in the niche, extract channelIds
  for (const keyword of keywords.slice(0, 2)) {
    try {
      const data = await fetchJson(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=20&order=viewCount&q=${encodeURIComponent(
          keyword
        )}&key=${encodeURIComponent(apiKey)}`
      );
      for (const item of data.items || []) {
        const cid = item.snippet?.channelId;
        if (cid && cid !== sourceChannelId && !channelIdSet.has(cid)) {
          channelIdSet.add(cid);
          channelIdOrder.push(cid);
        }
      }
    } catch (error) {
      logServerEvent("competitors", `video search failed for "${keyword}"`, {
        error: error.message,
      });
    }
  }

  if (!channelIdOrder.length) {
    return [];
  }

  // Fetch channel details in batches of 50
  const allChannels = [];
  const batchIds = channelIdOrder.slice(0, Math.min(channelIdOrder.length, 50));
  try {
    const data = await fetchJson(
      `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${encodeURIComponent(
        batchIds.join(",")
      )}&key=${encodeURIComponent(apiKey)}`
    );
    for (const ch of data.items || []) {
      allChannels.push({
        channelId: ch.id,
        title: ch.snippet?.title || "",
        thumbnail:
          ch.snippet?.thumbnails?.medium?.url ||
          ch.snippet?.thumbnails?.default?.url ||
          "",
        customUrl: ch.snippet?.customUrl || "",
        country: ch.snippet?.country || "",
        description: (ch.snippet?.description || "").slice(0, 300),
        publishedAt: ch.snippet?.publishedAt || "",
        subscribers: Number(ch.statistics?.subscriberCount || 0),
        totalViews: Number(ch.statistics?.viewCount || 0),
        videoCount: Number(ch.statistics?.videoCount || 0),
        hiddenSubscriberCount: Boolean(ch.statistics?.hiddenSubscriberCount),
      });
    }
  } catch (error) {
    logServerEvent("competitors", "batch channel details failed", {
      error: error.message,
    });
  }

  // Sort by subscribers descending, return top N
  allChannels.sort((a, b) => b.subscribers - a.subscribers);
  return allChannels;
}

async function filterCompetitorsByStyle(sourceDna, candidates, maxResults) {
  if (!candidates || candidates.length === 0) return [];

  const provider = AI_PROVIDER;
  const geminiKey = DEFAULT_GEMINI_API_KEY;
  const wokushopKey = DEFAULT_WOKUSHOP_API_KEY;

  const prompt = buildCompetitorFilterPrompt(sourceDna, candidates);
  let raw;

  try {
    if (provider === "wokushop" && wokushopKey) {
      raw = await callWokushop({
        apiKey: wokushopKey,
        model: DEFAULT_WOKUSHOP_MODEL,
        prompt,
      });
    } else if (geminiKey) {
      raw = await callGemini({
        apiKey: geminiKey,
        model: DEFAULT_GEMINI_MODEL,
        prompt,
      });
    } else {
      return candidates.slice(0, maxResults);
    }

    const cleaned = raw.replace(/^```json\s*/u, "").replace(/```$/u, "").trim();
    const approvedIds = JSON.parse(cleaned);

    if (!Array.isArray(approvedIds)) {
      throw new Error("AI did not return an array");
    }

    // Filter and sort candidates based on AI response
    const filtered = [];
    for (const id of approvedIds) {
      const found = candidates.find((c) => c.channelId === id);
      if (found) filtered.push(found);
    }
    
    // If AI filtered out too many, fallback to some of the largest from original list
    if (filtered.length < 3) {
      logServerEvent("competitors", "AI filtered out too many, using fallback");
      return candidates.slice(0, maxResults);
    }

    return filtered.slice(0, maxResults);
  } catch (error) {
    logServerEvent("competitors", "AI filtering failed", { error: error.message });
    return candidates.slice(0, maxResults);
  }
}

async function findCompetitors(apiKey, channelInput, options = {}) {
  const maxResults = Math.min(Number(options.maxResults) || 10, 20);

  // 1. Resolve source channel
  const channel = await resolveChannel(apiKey, channelInput);

  // 2. Extract Channel DNA via AI
  const dna = await extractChannelDna(apiKey, channel);
  logServerEvent("competitors", "channel dna extracted", dna);

  // 3. Search for broad competitor candidates
  const candidates = await searchCompetitorChannels(
    apiKey,
    dna.searchQueries,
    channel.id,
    maxResults // not used in searchCompetitorChannels anymore, but kept for signature
  );
  
  // 4. AI Deep Filtering to ensure matching style and tone
  const competitors = await filterCompetitorsByStyle(dna, candidates, maxResults);

  return {
    source: {
      channelId: channel.id,
      title: channel.snippet?.title || "",
      thumbnail:
        channel.snippet?.thumbnails?.high?.url ||
        channel.snippet?.thumbnails?.default?.url ||
        "",
      customUrl: channel.snippet?.customUrl || "",
      country: channel.snippet?.country || "",
      subscribers: Number(channel.statistics?.subscriberCount || 0),
      totalViews: Number(channel.statistics?.viewCount || 0),
      videoCount: Number(channel.statistics?.videoCount || 0),
      description: (channel.snippet?.description || "").slice(0, 300),
      topic: dna.topic,
      contentStyle: dna.contentStyle,
      tone: dna.tone,
      searchQueries: dna.searchQueries,
      language: dna.language,
    },
    competitors,
  };
}

async function runCompetitorAiAnalysis(source, competitors) {
  const provider = AI_PROVIDER;
  const geminiKey = DEFAULT_GEMINI_API_KEY;
  const wokushopKey = DEFAULT_WOKUSHOP_API_KEY;

  const prompt = buildCompetitorAnalysisPrompt(source, competitors);
  let raw;

  if (provider === "wokushop" && wokushopKey) {
    raw = await callWokushop({
      apiKey: wokushopKey,
      model: DEFAULT_WOKUSHOP_MODEL,
      prompt,
    });
  } else if (geminiKey) {
    raw = await callGemini({
      apiKey: geminiKey,
      model: DEFAULT_GEMINI_MODEL,
      prompt,
    });
  } else {
    throw new Error("No AI API key configured.");
  }

  const cleaned = raw.replace(/^```json\s*/u, "").replace(/```$/u, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch (error) {
    return { summary: raw };
  }
}

function saveAnalysisHistory(data) {
  const channelId = data.channel?.id || "unknown";
  const channelDir = path.join(ANALYSIS_HISTORY_DIR, channelId);
  fs.mkdirSync(channelDir, { recursive: true });

  const timestamp = Date.now();
  const record = {
    channelId,
    channelTitle: data.channel?.title || "",
    channelThumbnail: data.channel?.thumbnail || "",
    customUrl: data.channel?.customUrl || "",
    country: data.channel?.country || "",
    subscriberCount: data.channel?.subscriberCount || 0,
    totalViews: data.channel?.totalViews || 0,
    videoCount: data.channel?.videoCount || 0,
    analyzedAt: new Date().toISOString(),
    timestamp,
    publicMetrics: data.publicMetrics || null,
    estimates: data.estimates || null,
    aiInsights: data.aiInsights || null,
    topRecentVideos: (data.topRecentVideos || []).slice(0, 5),
  };

  const filename = `${timestamp}.json`;
  const fullPath = path.join(channelDir, filename);
  fs.writeFileSync(fullPath, JSON.stringify(record, null, 2), "utf8");
  logServerEvent("history", "saved analysis", { channelId, path: fullPath });
  return record;
}

function updateHistoryAiInsights(channelId, timestamp, aiInsights) {
  const channelDir = path.join(ANALYSIS_HISTORY_DIR, channelId);
  const filename = `${timestamp}.json`;
  const fullPath = path.join(channelDir, filename);
  if (!fs.existsSync(fullPath)) {
    return false;
  }
  try {
    const record = JSON.parse(fs.readFileSync(fullPath, "utf8"));
    record.aiInsights = aiInsights;
    fs.writeFileSync(fullPath, JSON.stringify(record, null, 2), "utf8");
    return true;
  } catch (error) {
    logServerEvent("history", "failed to update AI insights", { error: error.message });
    return false;
  }
}

function readAllAnalysisHistory() {
  const channels = [];
  if (!fs.existsSync(ANALYSIS_HISTORY_DIR)) {
    return channels;
  }

  for (const entry of fs.readdirSync(ANALYSIS_HISTORY_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    const channelId = entry.name;
    const channelDir = path.join(ANALYSIS_HISTORY_DIR, channelId);
    const analyses = [];

    for (const file of fs.readdirSync(channelDir).sort().reverse()) {
      if (!file.endsWith(".json")) {
        continue;
      }
      try {
        const record = JSON.parse(fs.readFileSync(path.join(channelDir, file), "utf8"));
        analyses.push(record);
      } catch (error) {
        // skip corrupt files
      }
    }

    if (analyses.length) {
      const latest = analyses[0];
      channels.push({
        channelId,
        channelTitle: latest.channelTitle,
        channelThumbnail: latest.channelThumbnail,
        customUrl: latest.customUrl,
        country: latest.country,
        subscriberCount: latest.subscriberCount,
        totalViews: latest.totalViews,
        latestAnalyzedAt: latest.analyzedAt,
        analysisCount: analyses.length,
      });
    }
  }

  channels.sort((a, b) => new Date(b.latestAnalyzedAt) - new Date(a.latestAnalyzedAt));
  return channels;
}

function readChannelAnalysisHistory(channelId) {
  const channelDir = path.join(ANALYSIS_HISTORY_DIR, channelId);
  if (!fs.existsSync(channelDir)) {
    return [];
  }

  const analyses = [];
  for (const file of fs.readdirSync(channelDir).sort().reverse()) {
    if (!file.endsWith(".json")) {
      continue;
    }
    try {
      const record = JSON.parse(fs.readFileSync(path.join(channelDir, file), "utf8"));
      analyses.push(record);
    } catch (error) {
      // skip corrupt files
    }
  }
  return analyses;
}

function deleteAnalysisHistoryEntry(channelId, timestamp) {
  const channelDir = path.join(ANALYSIS_HISTORY_DIR, channelId);
  const fullPath = path.join(channelDir, `${timestamp}.json`);
  if (!fs.existsSync(fullPath)) {
    throw new Error("Không tìm thấy bản ghi phân tích.");
  }
  fs.unlinkSync(fullPath);
  logServerEvent("history", "deleted entry", { channelId, timestamp });

  // Clean up empty channel dir
  const remaining = fs.readdirSync(channelDir).filter((f) => f.endsWith(".json"));
  if (!remaining.length) {
    fs.rmdirSync(channelDir);
  }
  return { deleted: true, channelId, timestamp };
}

function serveStatic(req, res, pathname) {
  const relativePath = pathname === "/" ? "/index.html" : pathname;
  const targetPath = path.normalize(path.join(PUBLIC_DIR, relativePath));

  if (!targetPath.startsWith(PUBLIC_DIR)) {
    sendText(res, 403, "Forbidden");
    return;
  }

  fs.readFile(targetPath, (error, data) => {
    if (error) {
      sendText(res, 404, "Not found");
      return;
    }

    const ext = path.extname(targetPath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    logServerEvent("http", `${req.method} ${url.pathname}`);

    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
      });
      res.end();
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/public") {
      const apiKey = url.searchParams.get("apiKey") || DEFAULT_YOUTUBE_API_KEY;
      const channelInput = url.searchParams.get("channel");

      if (!apiKey || !channelInput) {
        sendJson(res, 400, {
          error:
            "Channel is required, and apiKey must be provided either in query params or as YOUTUBE_API_KEY env.",
        });
        return;
      }

      const channel = await resolveChannel(apiKey, channelInput);
      const uploadsPlaylistId = channel.contentDetails?.relatedPlaylists?.uploads;

      if (!uploadsPlaylistId) {
        throw new Error("Channel uploads playlist could not be resolved.");
      }

      const uploads = await getUploads(apiKey, uploadsPlaylistId, MAX_RECENT_VIDEOS);
      const videoIds = uploads
        .map((item) => item.contentDetails?.videoId)
        .filter(Boolean);
      const videos = await getVideoDetails(apiKey, videoIds);
      const metrics = buildPublicMetrics(channel, videos);

      // Save to analysis history
      try {
        const historyRecord = saveAnalysisHistory(metrics);
        metrics._historyTimestamp = historyRecord.timestamp;
      } catch (historyError) {
        logServerEvent("history", "failed to save", { error: historyError.message });
      }

      sendJson(res, 200, metrics);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/config") {
      sendJson(res, 200, {
        hasYoutubeApiKey: Boolean(DEFAULT_YOUTUBE_API_KEY),
        hasGeminiApiKey: Boolean(DEFAULT_GEMINI_API_KEY),
        geminiModel: DEFAULT_GEMINI_MODEL,
        hasYtDlp: fs.existsSync(YT_DLP_PATH),
        promptLibraryPath: PROMPT_LIBRARY_DIR,
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/video") {
      const videoInput = url.searchParams.get("video");
      if (!videoInput) {
        sendJson(res, 400, { error: "Video URL or video ID is required." });
        return;
      }

      const metadata = await getVideoMetadata(videoInput);
      sendJson(res, 200, {
        ...metadata,
        durationHuman: formatDurationHuman(metadata.duration),
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/owner") {
      const rawBody = await readBody(req);
      const payload = rawBody ? JSON.parse(rawBody) : {};
      const metrics = await buildOwnerMetrics(payload);
      sendJson(res, 200, metrics);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/insights") {
      const rawBody = await readBody(req);
      const payload = rawBody ? JSON.parse(rawBody) : {};
      const insights = await buildAiInsights(payload);

      // Update history with AI insights if timestamp provided
      if (payload.historyTimestamp && payload.channel?.id) {
        try {
          updateHistoryAiInsights(payload.channel.id, payload.historyTimestamp, insights);
        } catch (err) {
          logServerEvent("history", "failed to update AI insights", { error: err.message });
        }
      }

      sendJson(res, 200, insights);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/client-log") {
      const rawBody = await readBody(req);
      const payload = rawBody ? JSON.parse(rawBody) : {};
      logServerEvent("client", payload.message || "client event", payload.meta || null);
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/prompt-library/analyze") {
      const rawBody = await readBody(req);
      const payload = rawBody ? JSON.parse(rawBody) : {};
      logServerEvent("prompt-analyze", "api route entered");
      const result = await analyzePromptEntry(payload);
      logServerEvent("prompt-analyze", "api route completed");
      sendJson(res, 200, result);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/prompt-library/save") {
      const rawBody = await readBody(req);
      const payload = rawBody ? JSON.parse(rawBody) : {};
      logServerEvent("prompt-save", "api route entered");
      const result = savePromptEntry(payload);
      logServerEvent("prompt-save", "api route completed");
      sendJson(res, 200, result);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/prompt-library/delete") {
      logServerEvent("prompt-delete", "api route start");
      const rawBody = await readBody(req);
      logServerEvent("prompt-delete", "body received", {
        length: rawBody.length,
      });
      const payload = rawBody ? JSON.parse(rawBody) : {};
      logServerEvent("prompt-delete", "api route entered", {
        id: payload.id || "",
      });
      const result = deletePromptEntry(payload.id);
      logServerEvent("prompt-delete", "api route completed");
      sendJson(res, 200, result);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/prompt-library") {
      const search = url.searchParams.get("search") || "";
      const group = url.searchParams.get("group") || "";
      const result = queryPromptLibrary({ search, group });
      sendJson(res, 200, result);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/history") {
      const channelId = url.searchParams.get("channelId") || "";
      if (channelId) {
        const analyses = readChannelAnalysisHistory(channelId);
        sendJson(res, 200, { channelId, analyses });
      } else {
        const channels = readAllAnalysisHistory();
        sendJson(res, 200, { channels });
      }
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/history/delete") {
      const rawBody = await readBody(req);
      const payload = rawBody ? JSON.parse(rawBody) : {};
      const result = deleteAnalysisHistoryEntry(payload.channelId, payload.timestamp);
      sendJson(res, 200, result);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/competitors") {
      const apiKey = url.searchParams.get("apiKey") || DEFAULT_YOUTUBE_API_KEY;
      const channelInput = url.searchParams.get("channel");
      const maxResults = url.searchParams.get("maxResults") || "10";

      if (!apiKey || !channelInput) {
        sendJson(res, 400, {
          error: "channel is required, and apiKey must be provided either in query params or as YOUTUBE_API_KEY env.",
        });
        return;
      }

      const result = await findCompetitors(apiKey, channelInput, {
        maxResults: Number(maxResults),
      });
      sendJson(res, 200, result);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/competitors/analyze") {
      const rawBody = await readBody(req);
      const payload = rawBody ? JSON.parse(rawBody) : {};
      if (!payload.source || !payload.competitors?.length) {
        sendJson(res, 400, { error: "source and competitors are required." });
        return;
      }
      const analysis = await runCompetitorAiAnalysis(
        payload.source,
        payload.competitors
      );
      sendJson(res, 200, {
        generatedAt: new Date().toISOString(),
        analysis,
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/video-download") {
      const videoInput = url.searchParams.get("video");
      const mode = url.searchParams.get("mode");
      if (!videoInput || !mode) {
        sendJson(res, 400, {
          error: "Both video and mode query parameters are required.",
        });
        return;
      }

      if (mode === "transcript") {
        const transcript = await downloadTranscript(videoInput);
        sendFile(res, transcript.path, transcript.filename);
        return;
      }

      if (mode === "thumbnail") {
        const thumbnail = await downloadThumbnail(videoInput);
        sendFile(res, thumbnail.path, thumbnail.filename);
        return;
      }

      if (mode === "video") {
        const video = await getDirectVideoStream(videoInput);
        await sendRemoteFile(res, video.url, video.filename, "video/mp4");
        return;
      }

      sendJson(res, 400, { error: "Unsupported download mode." });
      return;
    }

    serveStatic(req, res, url.pathname);
  } catch (error) {
    logServerEvent("error", error.message || "Unexpected server error");
    sendJson(res, 500, {
      error: error.message || "Unexpected server error.",
    });
  }
});

server.listen(PORT, () => {
  console.log(`YouTube analytics dashboard running at http://localhost:${PORT}`);
});
