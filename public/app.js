const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat("en-US");
const percentFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});

const publicForm = document.getElementById("public-form");
const videoForm = document.getElementById("video-form");
const ownerForm = document.getElementById("owner-form");
const fillOwnerBtn = document.getElementById("fill-owner-btn");
const clearVideoBtn = document.getElementById("clear-video-btn");
const scanPromptBtn = document.getElementById("scan-prompt-btn");
const analyzePromptAiBtn = document.getElementById("analyze-prompt-ai-btn");
const normalizePromptBtn = document.getElementById("normalize-prompt-btn");
const clearPromptBtn = document.getElementById("clear-prompt-btn");
const copyRenderedPromptBtn = document.getElementById("copy-rendered-prompt-btn");
const copyVariablesJsonBtn = document.getElementById("copy-variables-json-btn");
const savePromptTemplateBtn = document.getElementById("save-prompt-template-btn");
const savePromptLibraryBtn = document.getElementById("save-prompt-library-btn");
const resetPromptLibraryBtn = document.getElementById("reset-prompt-library-btn");
const toggleAllBtn = document.getElementById("toggle-all-btn");
const downloadTranscriptBtn = document.getElementById("download-transcript-btn");
const downloadThumbnailBtn = document.getElementById("download-thumbnail-btn");
const downloadVideoBtn = document.getElementById("download-video-btn");
const statusBox = document.getElementById("status-box");
const channelSummary = document.getElementById("channel-summary");
const publicStats = document.getElementById("public-stats");
const tablesSection = document.getElementById("tables-section");
const ownerTablesSection = document.getElementById("owner-tables-section");
const fallbackChartPanel = document.getElementById("fallback-chart-panel");
const ownerChartPanel = document.getElementById("owner-chart-panel");
const topVideosTable = document.getElementById("top-videos-table");
const recentVideosTable = document.getElementById("recent-videos-table");
const geographyTable = document.getElementById("geography-table");
const demographicsTable = document.getElementById("demographics-table");
const aiInsightsPanel = document.getElementById("ai-insights-panel");
const aiInsightsContent = document.getElementById("ai-insights-content");
const emptyState = document.getElementById("empty-state");
const emptyStateTitle = document.getElementById("empty-state-title");
const emptyStateText = document.getElementById("empty-state-text");
const overviewPanel = document.getElementById("overview-panel");
const configBadges = document.getElementById("config-badges");
const ownerChannelIdInput = document.getElementById("owner-channel-id");
const videoActions = document.getElementById("video-actions");
const videoSummaryPanel = document.getElementById("video-summary-panel");
const videoSummaryContent = document.getElementById("video-summary-content");
const promptTemplateInput = document.getElementById("prompt-template-input");
const promptLibraryTitleInput = document.getElementById("prompt-library-title");
const promptThumbnailInput = document.getElementById("prompt-thumbnail-input");
const clearPromptThumbnailBtn = document.getElementById("clear-prompt-thumbnail-btn");
const promptThumbnailPreview = document.getElementById("prompt-thumbnail-preview");
const promptLibraryInput = document.getElementById("prompt-library-input");
const promptVariables = document.getElementById("prompt-variables");
const promptOutputPanel = document.getElementById("prompt-output-panel");
const promptRenderedOutput = document.getElementById("prompt-rendered-output");
const promptStats = document.getElementById("prompt-stats");
const promptAnalysisContent = document.getElementById("prompt-analysis-content");
const promptStorageNote = document.getElementById("prompt-storage-note");
const promptLibraryList = document.getElementById("prompt-library-list");
const promptLibrarySearch = document.getElementById("prompt-library-search");
const promptLibraryGroupFilter = document.getElementById("prompt-library-group-filter");
const refreshPromptLibraryBtn = document.getElementById("refresh-prompt-library-btn");
const confirmModal = document.getElementById("confirm-modal");
const confirmModalTitle = document.getElementById("confirm-modal-title");
const confirmModalMessage = document.getElementById("confirm-modal-message");
const confirmModalCancel = document.getElementById("confirm-modal-cancel");
const confirmModalConfirm = document.getElementById("confirm-modal-confirm");
const workspaceGrid = document.getElementById("workspace-grid");
const pageNavItems = Array.from(document.querySelectorAll("[data-nav-page]"));
const pageSections = Array.from(document.querySelectorAll("[data-workspace-page]"));
const promptPaneNavItems = Array.from(document.querySelectorAll("[data-prompt-pane]"));
const promptPaneSections = Array.from(document.querySelectorAll("[data-prompt-pane-section]"));

let recentViewsChart;
let ownerAnalyticsChart;
let lastPublicCards = [];
let lastOwnerCards = [];
let currentPublicPayload = null;
let currentOwnerPayload = null;
let currentVideoPayload = null;
let promptVariableState = {};
let currentPromptAnalysis = null;
let currentEditingPromptId = null;
let currentPromptThumbnailDataUrl = "";
let currentPromptThumbnailMeta = null;
const pendingPromptDeleteIds = new Set();
let currentPromptLibraryItems = [];
let runtimeConfig = {
  hasYoutubeApiKey: false,
  hasGeminiApiKey: false,
  geminiModel: "",
  hasYtDlp: false,
  promptLibraryPath: "",
};
let activePage = "channel";
let activePromptPane = "builder";
let pendingConfirmResolver = null;
const pageToHash = {
  channel: "#channel-workspace",
  video: "#video-workspace",
  prompt: "#prompt-workspace",
  owner: "#owner-workspace",
};
const hashToPage = Object.fromEntries(
  Object.entries(pageToHash).map(([page, hash]) => [hash, page])
);

const pageIntroContent = {
  channel: {
    title: "Channel analysis workspace",
    text: "Analyze a YouTube channel, review performance metrics, estimated monetization, and Gemini insights in a focused analytics view.",
  },
  video: {
    title: "Video tools workspace",
    text: "Paste one YouTube video link to inspect metadata and download the transcript, thumbnail, or direct video asset when available.",
  },
  prompt: {
    title: "Prompt tools workspace",
    text: "Paste a prompt template, detect variables automatically, fill values quickly, and generate a clean rendered prompt for reuse.",
  },
  owner: {
    title: "Owner analytics workspace",
    text: "Load verified owner analytics like RPM, subscriber movement, geography, and demographics without unrelated tools on screen.",
  },
};

const promptHighlightPalette = [
  { bg: "rgba(232, 93, 4, 0.18)", border: "rgba(232, 93, 4, 0.36)", text: "#9f3f02" },
  { bg: "rgba(23, 59, 122, 0.18)", border: "rgba(23, 59, 122, 0.34)", text: "#173b7a" },
  { bg: "rgba(255, 183, 3, 0.22)", border: "rgba(214, 136, 0, 0.34)", text: "#8a5b00" },
  { bg: "rgba(95, 168, 98, 0.22)", border: "rgba(95, 168, 98, 0.34)", text: "#2f6b31" },
  { bg: "rgba(164, 80, 139, 0.18)", border: "rgba(164, 80, 139, 0.34)", text: "#7b355f" },
  { bg: "rgba(0, 151, 167, 0.18)", border: "rgba(0, 151, 167, 0.34)", text: "#006b74" },
];

async function readResponsePayload(response) {
  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    return {
      error: text,
      rawText: text,
    };
  }
}

function reportClientLog(message, meta = {}) {
  fetch("/api/client-log", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    keepalive: true,
    body: JSON.stringify({ message, meta }),
  }).catch(() => {});
}

function showStatus(message, type = "info") {
  statusBox.className = `status ${type}`;
  statusBox.textContent = message;
}

function setActivePromptPane(pane) {
  activePromptPane = pane;
  promptPaneNavItems.forEach((item) => {
    item.classList.toggle("active", item.dataset.promptPane === pane);
  });
  promptPaneSections.forEach((section) => {
    section.classList.toggle("prompt-pane-hidden", section.dataset.promptPaneSection !== pane);
  });
}

function hideStatus() {
  statusBox.className = "status hidden";
  statusBox.textContent = "";
}

function closeConfirmModal(result) {
  if (!pendingConfirmResolver) {
    return;
  }

  const resolver = pendingConfirmResolver;
  pendingConfirmResolver = null;
  confirmModal.classList.add("hidden");
  confirmModal.setAttribute("aria-hidden", "true");
  resolver(result);
}

function openConfirmModal({
  title = "Confirm action",
  message = "Are you sure you want to continue?",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
} = {}) {
  confirmModalTitle.textContent = title;
  confirmModalMessage.textContent = message;
  confirmModalConfirm.textContent = confirmLabel;
  confirmModalCancel.textContent = cancelLabel;
  confirmModal.classList.remove("hidden");
  confirmModal.setAttribute("aria-hidden", "false");

  return new Promise((resolve) => {
    pendingConfirmResolver = resolve;
    setTimeout(() => confirmModalConfirm.focus(), 0);
  });
}

function formatNumber(value) {
  return numberFormatter.format(Math.round(Number(value || 0)));
}

function formatPercent(value) {
  return `${percentFormatter.format(Number(value || 0))}%`;
}

function formatDate(value) {
  if (!value) {
    return "N/A";
  }

  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatBytes(value) {
  const size = Number(value || 0);
  if (!size) {
    return "0 B";
  }

  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

function estimateTokens(text) {
  return Math.max(0, Math.round((text || "").length / 4));
}

function getPromptTemplate() {
  return promptTemplateInput.value || "";
}

function getLibraryPromptTemplate() {
  return promptLibraryInput.value || "";
}

function getPromptForLibraryWorkflow() {
  const libraryPrompt = getLibraryPromptTemplate().trim();
  if (libraryPrompt) {
    return libraryPrompt;
  }

  const builderPrompt = getPromptTemplate().trim();
  if (builderPrompt) {
    promptLibraryInput.value = builderPrompt;
    return builderPrompt;
  }

  return "";
}

function resetPromptLibraryEditor() {
  currentEditingPromptId = null;
  currentPromptAnalysis = null;
  currentPromptThumbnailDataUrl = "";
  currentPromptThumbnailMeta = null;
  promptLibraryTitleInput.value = "";
  promptThumbnailInput.value = "";
  promptLibraryInput.value = "";
  promptAnalysisContent.innerHTML =
    `<p class="empty">Run AI analysis to get a suggested title, group, tags, and usage notes for this prompt.</p>`;
  savePromptLibraryBtn.textContent = "Save to library";
  renderPromptThumbnailPreview();
}

function renderPromptThumbnailPreview() {
  if (!currentPromptThumbnailDataUrl) {
    promptThumbnailPreview.className = "prompt-thumbnail-preview empty";
    promptThumbnailPreview.innerHTML = `<p>No thumbnail selected yet.</p>`;
    return;
  }

  const orientationClass =
    currentPromptThumbnailMeta?.orientation === "portrait"
      ? "is-portrait"
      : currentPromptThumbnailMeta?.orientation === "landscape"
        ? "is-landscape"
        : "";
  promptThumbnailPreview.className = `prompt-thumbnail-preview ${orientationClass}`.trim();
  promptThumbnailPreview.innerHTML = `<img src="${currentPromptThumbnailDataUrl}" alt="Prompt thumbnail preview" />`;
}

async function loadImageMeta(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const width = Number(image.naturalWidth || 0);
      const height = Number(image.naturalHeight || 0);
      const orientation =
        width > height ? "landscape" : height > width ? "portrait" : "square";
      resolve({
        width,
        height,
        orientation,
        aspectRatio: width && height ? Number((width / height).toFixed(4)) : null,
      });
    };
    image.onerror = () => reject(new Error("Failed to read image dimensions."));
    image.src = dataUrl;
  });
}

async function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read the selected image."));
    reader.readAsDataURL(file);
  });
}

async function loadImageElement(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to decode the selected image."));
    image.src = dataUrl;
  });
}

async function compressImageDataUrl(dataUrl, options = {}) {
  const {
    maxWidth = 1600,
    maxHeight = 1600,
    targetBytes = 1024 * 1024,
    mimeType = "image/jpeg",
  } = options;
  const sourceImage = await loadImageElement(dataUrl);
  const width = Number(sourceImage.naturalWidth || sourceImage.width || 0);
  const height = Number(sourceImage.naturalHeight || sourceImage.height || 0);

  if (!width || !height) {
    throw new Error("Could not determine the image dimensions.");
  }

  const scale = Math.min(1, maxWidth / width, maxHeight / height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not prepare the image for upload.");
  }

  context.drawImage(sourceImage, 0, 0, canvas.width, canvas.height);

  let output = canvas.toDataURL(mimeType, 0.9);
  let quality = 0.82;
  while (output.length > targetBytes * 1.37 && quality >= 0.45) {
    output = canvas.toDataURL(mimeType, quality);
    quality -= 0.08;
  }

  const meta = await loadImageMeta(output);
  return {
    dataUrl: output,
    meta,
    bytesApprox: Math.round((output.length * 3) / 4),
  };
}

async function readImageFileAsDataUrl(file) {
  const originalDataUrl = await readFileAsDataUrl(file);
  const originalMeta = await loadImageMeta(originalDataUrl);
  const originalPayload = {
    dataUrl: originalDataUrl,
    meta: originalMeta,
    bytesApprox: file.size,
    wasCompressed: false,
    originalBytes: file.size,
  };

  if (file.size <= 1024 * 1024) {
    return originalPayload;
  }

  const compressed = await compressImageDataUrl(originalDataUrl, {
    maxWidth: 1600,
    maxHeight: 1600,
    targetBytes: 900 * 1024,
    mimeType: "image/jpeg",
  });

  if (compressed.bytesApprox >= file.size) {
    return originalPayload;
  }

  return {
    ...compressed,
    wasCompressed: true,
    originalBytes: file.size,
  };
}

function getPromptThumbnailLayout(item) {
  const orientation =
    item.thumbnailOrientation ||
    (Number(item.thumbnailHeight || 0) > Number(item.thumbnailWidth || 0)
      ? "portrait"
      : Number(item.thumbnailWidth || 0) > Number(item.thumbnailHeight || 0)
        ? "landscape"
        : "landscape");

  return {
    orientation,
    className: orientation === "portrait" ? "is-portrait" : "is-landscape",
  };
}

function getPromptVariablePayload() {
  return extractPromptVariables(getPromptTemplate()).map((variable) => ({
    name: variable.name,
    value: promptVariableState[variable.name] || "",
    placeholders: variable.placeholders,
  }));
}

function extractPromptVariables(template) {
  const patterns = [
    /\[<([a-zA-Z0-9_ -]+)>\]/gu,
    /\{\{([a-zA-Z0-9_ -]+)\}\}/gu,
    /\[\[([a-zA-Z0-9_ -]+)\]\]/gu,
  ];
  const found = new Map();

  patterns.forEach((pattern) => {
    let match = pattern.exec(template);
    while (match) {
      const rawName = String(match[1] || "").trim();
      if (rawName && !found.has(rawName)) {
        found.set(rawName, {
          name: rawName,
          placeholders: [match[0]],
        });
      } else if (rawName) {
        found.get(rawName).placeholders.push(match[0]);
      }
      match = pattern.exec(template);
    }
  });

  return Array.from(found.values());
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;")
    .replace(/'/gu, "&#39;");
}

function getFileNameFromPath(value) {
  const normalized = String(value || "").replace(/\\/gu, "/");
  const parts = normalized.split("/");
  return parts[parts.length - 1] || normalized;
}

function getPromptVariableColor(index) {
  return promptHighlightPalette[index % promptHighlightPalette.length];
}

function renderPromptVariables(template) {
  const variables = extractPromptVariables(template);

  if (!variables.length) {
    promptVariables.innerHTML = `<p class="empty">No variables detected yet.</p>`;
    promptOutputPanel.classList.toggle("hidden", !template.trim());
    updateRenderedPrompt();
    return;
  }

  promptVariables.innerHTML = `
    <div class="prompt-variable-grid">
      ${variables
        .map(
          (variable, index) => {
            const color = getPromptVariableColor(index);
            return `
        <label class="prompt-variable-card">
          <code style="color:${color.text};">${variable.name}</code>
          <input
            type="text"
            data-prompt-variable="${variable.name}"
            value="${(promptVariableState[variable.name] || "").replace(/"/gu, "&quot;")}"
            placeholder="Enter value for ${variable.name}"
            style="border-color:${color.border}; box-shadow: inset 0 0 0 1px ${color.bg};"
          />
        </label>
      `;
          }
        )
        .join("")}
    </div>
  `;

  promptVariables.querySelectorAll("[data-prompt-variable]").forEach((input) => {
    input.addEventListener("input", (event) => {
      promptVariableState[event.target.dataset.promptVariable] = event.target.value;
      updateRenderedPrompt();
    });
  });

  promptOutputPanel.classList.remove("hidden");
  updateRenderedPrompt();
}

function buildRenderedPrompt(template) {
  const variables = extractPromptVariables(template);
  let rendered = template;

  variables.forEach((variable) => {
    const value = promptVariableState[variable.name] || "";
    variable.placeholders.forEach((placeholder) => {
      rendered = rendered.replace(
        new RegExp(escapeRegExp(placeholder), "gu"),
        value
      );
    });
  });

  return rendered;
}

function buildRenderedPromptMarkup(template) {
  const variables = extractPromptVariables(template);

  if (!variables.length) {
    return escapeHtml(buildRenderedPrompt(template));
  }

  const placeholderEntries = [];
  variables.forEach((variable, index) => {
    const color = getPromptVariableColor(index);
    variable.placeholders.forEach((placeholder) => {
      placeholderEntries.push({
        placeholder,
        value: promptVariableState[variable.name] || "",
        name: variable.name,
        color,
      });
    });
  });

  placeholderEntries.sort((a, b) => b.placeholder.length - a.placeholder.length);

  let cursor = 0;
  let html = "";

  while (cursor < template.length) {
    const matchedEntry = placeholderEntries.find((entry) =>
      template.startsWith(entry.placeholder, cursor)
    );

    if (!matchedEntry) {
      html += escapeHtml(template[cursor]);
      cursor += 1;
      continue;
    }

    const displayValue = matchedEntry.value || `(${matchedEntry.name})`;
    html += `<span class="prompt-token" style="background:${matchedEntry.color.bg};border-color:${matchedEntry.color.border};color:${matchedEntry.color.text};" title="${escapeHtml(matchedEntry.name)}">${escapeHtml(displayValue)}</span>`;
    cursor += matchedEntry.placeholder.length;
  }

  return html;
}

function updateRenderedPrompt() {
  const template = getPromptTemplate();
  const rendered = buildRenderedPrompt(template);
  promptRenderedOutput.innerHTML = rendered
    ? buildRenderedPromptMarkup(template)
    : "Rendered prompt will appear here.";
  promptStats.textContent = `Variables: ${extractPromptVariables(template).length} | Characters: ${rendered.length} | Words: ${
    rendered.trim() ? rendered.trim().split(/\s+/u).length : 0
  } | Estimated tokens: ${estimateTokens(rendered)}`;
}

function normalizePromptText() {
  const normalized = getPromptTemplate()
    .replace(/\r\n/gu, "\n")
    .replace(/[ \t]+\n/gu, "\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
  promptTemplateInput.value = normalized;
  renderPromptVariables(normalized);
}

function renderPromptChipRow(items) {
  if (!items || !items.length) {
    return `<p class="empty">No items yet.</p>`;
  }

  return `<div class="prompt-chip-row">${items
    .map((item) => `<span class="prompt-chip">${escapeHtml(item)}</span>`)
    .join("")}</div>`;
}

function renderPromptAnalysisResult(result) {
  currentPromptAnalysis = result;
  setActivePromptPane("library");
  const { analysis, model, analyzedAt } = result;
  promptAnalysisContent.innerHTML = `
    ${
      result.warning
        ? `<div class="prompt-analysis-card"><p class="eyebrow">Fallback Mode</p><p>${escapeHtml(
            result.warning
          )}</p></div>`
        : ""
    }
    <div class="prompt-analysis-grid">
      <article class="prompt-analysis-card">
        <p class="eyebrow">Summary</p>
        <h4>${analysis.suggestedTitle || "Untitled prompt"}</h4>
        <p>${analysis.summary || "No summary returned."}</p>
        <p class="prompt-library-meta">Model: ${model} | Analyzed: ${formatDate(analyzedAt)}</p>
      </article>
      <article class="prompt-analysis-card">
        <p class="eyebrow">Grouping</p>
        <h4>${analysis.primaryGroup || "general"}</h4>
        ${renderPromptChipRow(analysis.groups || [])}
      </article>
      <article class="prompt-analysis-card">
        <p class="eyebrow">Tags</p>
        ${renderPromptChipRow(analysis.tags || [])}
      </article>
      <article class="prompt-analysis-card">
        <p class="eyebrow">Use Cases</p>
        ${renderPromptChipRow(analysis.useCases || [])}
      </article>
    </div>
    <div class="prompt-analysis-grid">
      <article class="prompt-analysis-card">
        <p class="eyebrow">Quality Notes</p>
        ${renderPromptChipRow(analysis.qualityNotes || [])}
      </article>
      <article class="prompt-analysis-card">
        <p class="eyebrow">Risks</p>
        ${renderPromptChipRow(analysis.risks || [])}
      </article>
    </div>
  `;
}

function renderPromptLibrary(data) {
  currentPromptLibraryItems = Array.isArray(data.items) ? data.items : [];
  const currentGroup = promptLibraryGroupFilter.value;
  promptLibraryGroupFilter.innerHTML = `
    <option value="">All groups</option>
    ${(data.groups || [])
      .map(
        (group) =>
          `<option value="${group}"${currentGroup === group ? " selected" : ""}>${group}</option>`
      )
      .join("")}
  `;

  if (!data.items || !data.items.length) {
    promptLibraryList.innerHTML = `<p class="empty">No saved prompts match this filter yet.</p>`;
    return;
  }

  promptLibraryList.innerHTML = data.items
    .map(
      (item) => {
        const thumbnailLayout = getPromptThumbnailLayout(item);
        const title = item.title || item.analysis?.suggestedTitle || `Prompt #${item.sequence || ""}`;
        const tagsMarkup = item.tags?.length ? renderPromptChipRow(item.tags.slice(0, 4)) : "";
        const summaryMarkup = item.summary
          ? `<p class="prompt-library-meta prompt-library-summary">${escapeHtml(item.summary)}</p>`
          : "";
        return `
      <article class="prompt-card">
        <div class="prompt-card-thumb ${thumbnailLayout.className}${
          item.thumbnailDataUrl ? "" : " is-empty"
        }">
          ${
            item.thumbnailDataUrl
              ? `<img src="${item.thumbnailDataUrl}" alt="${escapeHtml(item.title || "Prompt thumbnail")}" loading="lazy" />`
              : `<span>No image</span>`
          }
        </div>
        <div class="prompt-card-content">
          <div class="prompt-card-header">
            <span class="prompt-card-group">${escapeHtml(item.primaryGroup || "no-group")} · #${escapeHtml(
              item.sequence || ""
            )}</span>
            <div class="prompt-card-actions">
              <button class="prompt-card-action" type="button" data-copy-prompt-id="${escapeHtml(item.id)}" title="Copy prompt">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              </button>
              <button class="prompt-card-action" type="button" data-edit-prompt-id="${escapeHtml(item.id)}" title="Edit prompt">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button class="prompt-card-action prompt-card-action--danger" type="button" data-delete-prompt-id="${escapeHtml(item.id)}" title="Delete prompt" ${pendingPromptDeleteIds.has(item.id) ? "disabled" : ""}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </div>
          <h4 class="prompt-card-title">${escapeHtml(title)}</h4>
          ${summaryMarkup}
          ${tagsMarkup ? `<div class="prompt-card-tags">${tagsMarkup}</div>` : ""}
          <div class="prompt-card-snippet">${escapeHtml((item.prompt || "").slice(0, 180))}</div>
          <div class="prompt-card-footer">
            <span class="prompt-card-date">Saved ${formatDate(item.createdAt)}</span>
          </div>
        </div>
      </article>
    `;
      }
    )
    .join("");
}

async function loadPromptLibrary() {
  try {
    const search = promptLibrarySearch.value.trim();
    const group = promptLibraryGroupFilter.value.trim();
    const response = await fetch(
      `/api/prompt-library?search=${encodeURIComponent(search)}&group=${encodeURIComponent(group)}`
    );
    const data = await readResponsePayload(response);
    if (!response.ok) {
      throw new Error(data.error || "Failed to load the prompt library.");
    }
    renderPromptLibrary(data);
  } catch (error) {
    promptLibraryList.innerHTML = `<p class="empty">${error.message}</p>`;
  }
}

async function analyzePromptWithAi() {
  const prompt = getPromptForLibraryWorkflow();
  reportClientLog("prompt analyze invoked", {
    libraryLength: getLibraryPromptTemplate().trim().length,
    builderLength: getPromptTemplate().trim().length,
  });
  if (!prompt) {
    reportClientLog("prompt analyze blocked: empty prompt");
    showStatus("Paste a prompt in Template Builder or Analyze and Save before running AI analysis.", "error");
    return;
  }

  setActivePage("prompt");
  setActivePromptPane("library");
  emptyState.classList.add("hidden");
  showStatus("Analyzing prompt structure, group, and tags...");

  try {
    const response = await fetch("/api/prompt-library/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        renderedPrompt: prompt,
        variables: [],
      }),
    });
    const data = await readResponsePayload(response);
    if (!response.ok) {
      reportClientLog("prompt analyze failed", { error: data.error || "Failed to analyze the prompt." });
      throw new Error(data.error || "Failed to analyze the prompt.");
    }
    reportClientLog("prompt analyze succeeded", { model: data.model || "unknown" });
    renderPromptAnalysisResult(data);
    showStatus("Prompt analysis is ready.", "success");
  } catch (error) {
    reportClientLog("prompt analyze exception", { error: error.message });
    showStatus(error.message, "error");
  }
}

async function savePromptToLibrary() {
  const prompt = getPromptForLibraryWorkflow();
  reportClientLog("prompt save invoked", {
    hasAnalysis: Boolean(currentPromptAnalysis),
    promptLength: prompt.length,
    editingId: currentEditingPromptId || "",
  });
  if (!prompt) {
    reportClientLog("prompt save blocked: empty prompt");
    showStatus("Paste a prompt in Template Builder or Analyze and Save before saving it to the library.", "error");
    return;
  }

  showStatus("Saving prompt to the local library...");

  try {
    const enteredTitle = promptLibraryTitleInput.value.trim();
    const derivedTitle = currentPromptAnalysis?.analysis?.suggestedTitle?.trim() || "";
    const response = await fetch("/api/prompt-library/save", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: currentEditingPromptId,
        title: enteredTitle || derivedTitle,
        prompt,
        renderedPrompt: prompt,
        variables: [],
        primaryGroup: currentPromptAnalysis?.analysis?.primaryGroup || "no-group",
        analysis: currentPromptAnalysis?.analysis || null,
        thumbnailDataUrl: currentPromptThumbnailDataUrl || "",
        thumbnailWidth: currentPromptThumbnailMeta?.width || null,
        thumbnailHeight: currentPromptThumbnailMeta?.height || null,
        thumbnailOrientation: currentPromptThumbnailMeta?.orientation || "",
      }),
    });
    const data = await readResponsePayload(response);
    if (!response.ok) {
      reportClientLog("prompt save failed", { error: data.error || "Failed to save the prompt." });
      throw new Error(data.error || "Failed to save the prompt.");
    }
    reportClientLog("prompt save succeeded", { relativePath: data.relativePath || "" });
    setActivePromptPane("library");
    await loadPromptLibrary();
    currentEditingPromptId = data.record?.id || null;
    currentPromptThumbnailDataUrl = data.record?.thumbnailDataUrl || "";
    currentPromptThumbnailMeta = data.record?.thumbnailDataUrl
      ? {
          width: Number(data.record?.thumbnailWidth || 0),
          height: Number(data.record?.thumbnailHeight || 0),
          orientation: data.record?.thumbnailOrientation || "landscape",
        }
      : null;
    promptLibraryTitleInput.value = data.record?.title || enteredTitle;
    promptThumbnailInput.value = "";
    renderPromptThumbnailPreview();
    savePromptLibraryBtn.textContent = currentEditingPromptId ? "Update prompt" : "Save to library";
    showStatus(`Prompt saved to ${data.relativePath}.`, "success");
  } catch (error) {
    reportClientLog("prompt save exception", { error: error.message });
    showStatus(error.message, "error");
  }
}

async function deletePromptFromLibrary(id) {
  if (!id) {
    showStatus("Missing prompt id for delete.", "error");
    return;
  }

  if (pendingPromptDeleteIds.has(id)) {
    return;
  }

  const matched = currentPromptLibraryItems.find((item) => item.id === id);
  const promptTitle = matched?.title || `Prompt #${matched?.sequence || ""}` || "this prompt";
  const confirmed = await openConfirmModal({
    title: `Delete "${promptTitle}"?`,
    message: "This prompt will be removed from your library. This action cannot be undone from the current UI.",
    confirmLabel: "Delete",
    cancelLabel: "Cancel",
  });

  if (!confirmed) {
    showStatus("Delete cancelled.", "success");
    return;
  }

  pendingPromptDeleteIds.add(id);
  loadPromptLibrary();

  reportClientLog("prompt delete invoked", { id });
  showStatus("Deleting prompt from the library...");

  try {
    const response = await fetch("/api/prompt-library/delete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id }),
    });
    const data = await readResponsePayload(response);
    if (!response.ok) {
      throw new Error(data.error || "Failed to delete the prompt.");
    }
    if (currentEditingPromptId === id) {
      resetPromptLibraryEditor();
    }
    await loadPromptLibrary();
    showStatus("Prompt deleted from the library.", "success");
  } catch (error) {
    showStatus(error.message, "error");
  } finally {
    pendingPromptDeleteIds.delete(id);
    void loadPromptLibrary();
  }
}

async function copyPromptFromLibrary(id) {
  if (!id) {
    showStatus("Missing prompt id for copy.", "error");
    return;
  }

  const matched = currentPromptLibraryItems.find((item) => item.id === id);
  if (!matched?.prompt) {
    showStatus("Could not find that prompt in the library.", "error");
    return;
  }

  await navigator.clipboard.writeText(matched.prompt);
  showStatus(`Copied "${matched.title || "prompt"}" to clipboard.`, "success");
}

async function editPromptFromLibrary(id) {
  if (!id) {
    showStatus("Missing prompt id for edit.", "error");
    return;
  }

  reportClientLog("prompt edit invoked", { id });

  try {
    const response = await fetch(
      `/api/prompt-library?search=&group=${encodeURIComponent("")}`
    );
    const data = await readResponsePayload(response);
    if (!response.ok) {
      throw new Error(data.error || "Failed to load the prompt library.");
    }
    const matched = (data.items || []).find((item) => item.id === id);
    if (!matched) {
      throw new Error("Could not find that prompt in the library.");
    }

    setActivePage("prompt");
    setActivePromptPane("library");
  currentEditingPromptId = matched.id;
  currentPromptThumbnailDataUrl = matched.thumbnailDataUrl || "";
  currentPromptThumbnailMeta = matched.thumbnailDataUrl
    ? {
        width: Number(matched.thumbnailWidth || 0),
        height: Number(matched.thumbnailHeight || 0),
        orientation: matched.thumbnailOrientation || "landscape",
      }
    : null;
  promptLibraryTitleInput.value = matched.title || "";
  promptThumbnailInput.value = "";
  renderPromptThumbnailPreview();
  promptLibraryInput.value = matched.prompt || "";
    currentPromptAnalysis = matched.analysis
      ? {
          model: "saved-library",
          analyzedAt: matched.updatedAt || matched.createdAt,
          analysis: matched.analysis,
        }
      : null;

    if (currentPromptAnalysis) {
      renderPromptAnalysisResult(currentPromptAnalysis);
    } else {
      promptAnalysisContent.innerHTML =
        `<p class="empty">This prompt has not been analyzed yet. You can analyze it now or save updates directly.</p>`;
    }

    savePromptLibraryBtn.textContent = "Update prompt";
    showStatus("Prompt loaded into Analyze and Save for editing.", "success");
  } catch (error) {
    reportClientLog("prompt edit exception", { error: error.message });
    showStatus(error.message, "error");
  }
}

async function handlePromptAnalyzeClick() {
  reportClientLog("prompt analyze click received");
  analyzePromptAiBtn.disabled = true;
  const originalLabel = analyzePromptAiBtn.textContent;
  analyzePromptAiBtn.textContent = "Analyzing...";
  try {
    await analyzePromptWithAi();
  } finally {
    analyzePromptAiBtn.disabled = false;
    analyzePromptAiBtn.textContent = originalLabel;
  }
}

async function handlePromptSaveClick() {
  reportClientLog("prompt save click received");
  savePromptLibraryBtn.disabled = true;
  const originalLabel = savePromptLibraryBtn.textContent;
  savePromptLibraryBtn.textContent = "Saving...";
  try {
    await savePromptToLibrary();
  } finally {
    savePromptLibraryBtn.disabled = false;
    savePromptLibraryBtn.textContent = currentEditingPromptId ? "Update prompt" : originalLabel;
  }
}

function renderConfigBadges() {
  configBadges.innerHTML = `
    <span class="config-badge${runtimeConfig.hasYoutubeApiKey ? "" : " off"}">
      YouTube key: ${runtimeConfig.hasYoutubeApiKey ? "ready" : "missing"}
    </span>
    <span class="config-badge${runtimeConfig.hasGeminiApiKey ? "" : " off"}">
      Gemini: ${runtimeConfig.hasGeminiApiKey ? runtimeConfig.geminiModel : "disabled"}
    </span>
    <span class="config-badge${runtimeConfig.hasYtDlp ? "" : " off"}">
      yt-dlp: ${runtimeConfig.hasYtDlp ? "ready" : "missing"}
    </span>
  `;
}

function updateEmptyState(page) {
  const content = pageIntroContent[page] || pageIntroContent.channel;
  emptyStateTitle.textContent = content.title;
  emptyStateText.textContent = content.text;
}

function sectionMatchesPage(section, page) {
  const pages = (section.dataset.workspacePage || "").split(/\s+/u).filter(Boolean);
  return pages.includes(page);
}

function pageHasResults(page) {
  if (page === "channel") {
    return Boolean(currentPublicPayload);
  }

  if (page === "video") {
    return Boolean(currentVideoPayload);
  }

  if (page === "prompt") {
    return Boolean(getPromptTemplate().trim());
  }

  if (page === "owner") {
    return Boolean(currentOwnerPayload);
  }

  return false;
}

function syncPagePanels() {
  const hasPromptTemplate = Boolean(getPromptTemplate().trim());
  const hasAiContent = Boolean(aiInsightsContent.innerHTML.trim());

  channelSummary.classList.toggle(
    "hidden",
    !(activePage === "channel" && currentPublicPayload)
  );
  videoSummaryPanel.classList.toggle(
    "hidden",
    !(activePage === "video" && currentVideoPayload)
  );
  promptOutputPanel.classList.toggle(
    "hidden",
    !(activePage === "prompt" && hasPromptTemplate)
  );
  overviewPanel.classList.toggle(
    "hidden",
    !(
      (activePage === "channel" && currentPublicPayload) ||
      (activePage === "owner" && currentOwnerPayload)
    )
  );
  fallbackChartPanel.classList.toggle(
    "hidden",
    !(activePage === "channel" && currentPublicPayload)
  );
  tablesSection.classList.toggle(
    "hidden",
    !(activePage === "channel" && currentPublicPayload)
  );
  aiInsightsPanel.classList.toggle(
    "hidden",
    !(activePage === "channel" && currentPublicPayload && hasAiContent)
  );
  ownerChartPanel.classList.toggle(
    "hidden",
    !(activePage === "owner" && currentOwnerPayload)
  );
  ownerTablesSection.classList.toggle(
    "hidden",
    !(activePage === "owner" && currentOwnerPayload)
  );
}

function setActivePage(page, options = {}) {
  const { updateHash = true } = options;
  activePage = page;
  workspaceGrid.classList.toggle("prompt-mode", page === "prompt");

  pageNavItems.forEach((item) => {
    item.classList.toggle("active", item.dataset.navPage === page);
  });

  pageSections.forEach((section) => {
    section.classList.toggle("page-hidden", !sectionMatchesPage(section, page));
  });

  if (page === "prompt") {
    setActivePromptPane(activePromptPane || "builder");
  }

  syncPagePanels();
  updateEmptyState(page);
  emptyState.classList.toggle("hidden", pageHasResults(page));
  if (page === "prompt") {
    loadPromptLibrary();
  }

  if (updateHash) {
    const nextHash = pageToHash[page] || pageToHash.channel;
    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
    }
  }
}

function getPageFromHash(hash = window.location.hash) {
  return hashToPage[hash] || "channel";
}

function renderStatsCards() {
  const merged = [
    ...lastPublicCards.map((card) => ({ ...card, accent: false })),
    ...lastOwnerCards.map((card) => ({ ...card, accent: true })),
  ];

  publicStats.innerHTML = merged
    .map(
      (card) => `
      <article class="stat-card${card.accent ? " accent" : ""}">
        <p class="stat-label">${card.label}</p>
        <h3>${card.value}</h3>
        <p class="stat-sub">${card.subtext || ""}</p>
      </article>
    `
    )
    .join("");
}

function setPublicCards(cards) {
  lastPublicCards = cards;
  renderStatsCards();
}

function setOwnerCards(cards) {
  lastOwnerCards = cards;
  renderStatsCards();
}

function renderTable(container, columns, rows) {
  if (!rows.length) {
    container.innerHTML = `<p class="empty">No data available.</p>`;
    return;
  }

  const head = columns.map((column) => `<th>${column.label}</th>`).join("");
  const body = rows
    .map(
      (row) => `
      <tr>
        ${columns.map((column) => `<td>${column.render(row)}</td>`).join("")}
      </tr>
    `
    )
    .join("");

  container.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead><tr>${head}</tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  `;
}

function renderList(title, items) {
  if (!items || !items.length) {
    return "";
  }

  return `
    <section class="insight-block">
      <h3>${title}</h3>
      <ul class="insight-list">
        ${items.map((item) => `<li>${item}</li>`).join("")}
      </ul>
    </section>
  `;
}

function renderAiInsights(payload) {
  const { insights, model, generatedAt } = payload;
  aiInsightsPanel.classList.remove("hidden");
  aiInsightsContent.innerHTML = `
    <div class="insight-grid">
      <section class="insight-block">
        <p class="eyebrow">AI Summary</p>
        <p class="insight-summary">${insights.summary || "No summary returned."}</p>
        <p class="summary-note">Model: ${model} | Generated: ${formatDate(generatedAt)}</p>
      </section>
      <section class="insight-block">
        <h3>Monetization View</h3>
        <p>${insights.monetizationView || "No monetization view returned."}</p>
      </section>
      <section class="insight-block">
        <h3>Content Strategy</h3>
        <p>${insights.contentStrategy || "No content strategy returned."}</p>
      </section>
      ${renderList("Strengths", insights.strengths)}
      ${renderList("Risks", insights.risks)}
      ${renderList("Opportunities", insights.opportunities)}
      ${renderList("Next Actions", insights.nextActions)}
    </div>
  `;
}

function resetAiInsights() {
  aiInsightsPanel.classList.add("hidden");
  aiInsightsContent.innerHTML = "";
}

function renderAiUnavailable(message) {
  aiInsightsPanel.classList.remove("hidden");
  aiInsightsContent.innerHTML = `
    <div class="insight-grid">
      <section class="insight-block">
        <p class="eyebrow">Gemini Unavailable</p>
        <p class="insight-summary">${message}</p>
      </section>
    </div>
  `;
}

function setToggleState(button, expanded) {
  const targetId = button.dataset.target;
  const target = document.getElementById(targetId);
  if (!target) {
    return;
  }

  target.classList.toggle("hidden", !expanded);
  button.setAttribute("aria-expanded", String(expanded));
  const textNode = button.querySelector(".toggle-text");
  if (textNode) {
    textNode.textContent = expanded
      ? button.dataset.labelCollapse || "Collapse"
      : button.dataset.labelExpand || "Expand";
  }
}

function toggleSection(button, forceExpanded) {
  const expanded =
    typeof forceExpanded === "boolean"
      ? forceExpanded
      : button.getAttribute("aria-expanded") !== "true";
  setToggleState(button, expanded);
}

function initializeToggles() {
  document.querySelectorAll(".section-toggle").forEach((button) => {
    button.addEventListener("click", () => toggleSection(button));
  });
}

function setAllSections(expanded) {
  document.querySelectorAll(".section-toggle").forEach((button) => {
    toggleSection(button, expanded);
  });
  toggleAllBtn.textContent = expanded ? "Collapse all" : "Expand all";
}

function showResultsShell() {
  emptyState.classList.add("hidden");
  if (activePage === "channel") {
    channelSummary.classList.remove("hidden");
    overviewPanel.classList.remove("hidden");
  }
}

function resetVideoTools() {
  currentVideoPayload = null;
  videoActions.classList.add("hidden");
  videoSummaryPanel.classList.add("hidden");
  videoSummaryContent.innerHTML = "";
  [downloadTranscriptBtn, downloadThumbnailBtn, downloadVideoBtn].forEach((button) => {
    button.disabled = false;
    button.title = "";
  });
}

function getVideoDownloadUrl(mode) {
  const input = document.getElementById("video-input").value.trim();
  return `/api/video-download?video=${encodeURIComponent(input)}&mode=${encodeURIComponent(mode)}`;
}

function renderVideoSummary(data) {
  currentVideoPayload = data;
  setActivePage("video");
  emptyState.classList.add("hidden");
  videoSummaryPanel.classList.remove("hidden");
  videoActions.classList.remove("hidden");
  downloadTranscriptBtn.disabled = !data.transcriptAvailable;
  downloadTranscriptBtn.title = data.transcriptAvailable
    ? ""
    : "This video does not expose subtitles or auto-captions.";
  downloadThumbnailBtn.disabled = !data.thumbnailDownloadAvailable;
  downloadThumbnailBtn.title = data.thumbnailDownloadAvailable
    ? ""
    : "Thumbnail is not available for this video.";
  downloadVideoBtn.disabled = !data.videoDownloadAvailable;
  downloadVideoBtn.title = data.videoDownloadAvailable
    ? ""
    : "Direct MP4 download is not available for this video in the current environment.";
  videoSummaryContent.innerHTML = `
    <div class="video-summary">
      <div>
        ${data.thumbnail ? `<img class="video-thumbnail" src="${data.thumbnail}" alt="${data.title}" />` : ""}
      </div>
      <div>
        <p class="eyebrow">Video Summary</p>
        <h2>${data.title || "Untitled video"}</h2>
        <p class="summary-meta">
          ${data.channel || data.uploader || "Unknown creator"}
          ${data.uploadDate ? ` | ${data.uploadDate}` : ""}
        </p>
        <div class="video-meta-grid">
          <div class="video-meta-card">
            <strong>Duration</strong>
            <p>${data.durationHuman || "N/A"}</p>
          </div>
          <div class="video-meta-card">
            <strong>Views</strong>
            <p>${formatNumber(data.viewCount || 0)}</p>
          </div>
          <div class="video-meta-card">
            <strong>Likes</strong>
            <p>${formatNumber(data.likeCount || 0)}</p>
          </div>
          <div class="video-meta-card">
            <strong>Captions</strong>
            <p>${data.transcriptAvailable ? "Available" : "Not available"}</p>
          </div>
          <div class="video-meta-card">
            <strong>Direct video download</strong>
            <p>${data.videoDownloadAvailable ? "Available" : "Limited"}</p>
          </div>
        </div>
        <p class="video-description">${(data.description || "").slice(0, 700) || "No description was available."}</p>
      </div>
    </div>
  `;
}

async function loadRuntimeConfig() {
  try {
    const response = await fetch("/api/config");
    const data = await readResponsePayload(response);
    if (response.ok) {
      runtimeConfig = data;
    }
  } catch (error) {
    runtimeConfig = {
      hasYoutubeApiKey: false,
      hasGeminiApiKey: false,
      geminiModel: "",
      hasYtDlp: false,
      promptLibraryPath: "",
    };
  }

  renderConfigBadges();
  if (runtimeConfig.promptLibraryPath) {
    promptStorageNote.textContent = `Stored locally in ${runtimeConfig.promptLibraryPath}`;
  }
}

async function loadAiInsights() {
  if (!currentPublicPayload || !runtimeConfig.hasGeminiApiKey) {
    return;
  }

  setActivePage("channel");
  showStatus("Generating Gemini insights...");

  try {
    const response = await fetch("/api/insights", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channel: currentPublicPayload.channel,
        publicMetrics: currentPublicPayload.publicMetrics,
        estimates: currentPublicPayload.estimates,
        ownerMetrics: currentOwnerPayload,
      }),
    });

    const data = await readResponsePayload(response);
    if (!response.ok) {
      throw new Error(data.error || "Failed to generate Gemini insights.");
    }

    renderAiInsights(data);
    showStatus("Analysis loaded, including Gemini insights.", "success");
  } catch (error) {
    renderAiUnavailable(error.message);
    showStatus(
      "Public metrics loaded, but Gemini insights are currently unavailable.",
      "error"
    );
  }
}

function renderPublicSummary(data) {
  const { channel, publicMetrics, estimates } = data;
  setActivePage("channel");
  showResultsShell();
  channelSummary.innerHTML = `
    <div class="summary">
      <div class="summary-media">
        ${channel.thumbnail ? `<img src="${channel.thumbnail}" alt="${channel.title}" />` : ""}
      </div>
      <div class="summary-body">
        <p class="eyebrow">Channel Summary</p>
        <h2>${channel.title}</h2>
        <p class="summary-meta">
          ${channel.customUrl ? `@${channel.customUrl}` : channel.id}
          ${channel.country ? ` | ${channel.country}` : ""}
        </p>
        <p class="summary-text">${channel.description || "No description."}</p>
        <p class="summary-note">
          Data fetched at ${formatDate(publicMetrics.fetchedAt)}. Last public upload:
          ${formatDate(publicMetrics.lastUpdated)}.
        </p>
      </div>
    </div>
  `;

  setPublicCards([
    {
      label: "Average Views / Video",
      value: formatNumber(publicMetrics.avgViewsPerVideo),
      subtext: "All-time total views / total videos",
    },
    {
      label: "Total Views",
      value: formatNumber(publicMetrics.totalViews),
      subtext: `Across ${formatNumber(publicMetrics.totalVideos)} videos`,
    },
    {
      label: "Last Updated",
      value: formatDate(publicMetrics.lastUpdated),
      subtext: "Latest detected public upload",
    },
    {
      label: "Has Shorts",
      value: publicMetrics.hasShort ? "Yes" : "No",
      subtext: `${formatNumber(publicMetrics.shortCount)} shorts in recent sample`,
    },
    {
      label: "Recent Avg Views",
      value: formatNumber(publicMetrics.recentAvgViews),
      subtext: "Average on the recent sample",
    },
    {
      label: "Engagement Rate",
      value: formatPercent(publicMetrics.engagementRate),
      subtext: "Avg (likes + comments) / avg views",
    },
    {
      label: "Posting Cadence",
      value: `${percentFormatter.format(publicMetrics.avgDaysBetweenUploads || 0)} days`,
      subtext: "Average gap between recent uploads",
    },
    {
      label: "Shorts Ratio",
      value: formatPercent((publicMetrics.shortRatio || 0) * 100),
      subtext: "Shorts share in recent sample",
    },
    {
      label: "Estimated RPM Range",
      value: `$${(estimates.estimatedRpmLow || 0).toFixed(2)} - $${(
        estimates.estimatedRpmHigh || 0
      ).toFixed(2)}`,
      subtext: `${estimates.confidence} confidence estimate`,
    },
    {
      label: "Estimated Monthly Revenue",
      value: `$${formatNumber(estimates.estimatedMonthlyRevenueLow || 0)} - $${formatNumber(
        estimates.estimatedMonthlyRevenueHigh || 0
      )}`,
      subtext: "Modeled from recent views and upload cadence",
    },
    {
      label: "Growth Score",
      value: `${formatNumber(publicMetrics.growthScore || 0)}/100`,
      subtext: `Channel health band: ${publicMetrics.growthBand || "n/a"}`,
    },
    {
      label: "Content Profile",
      value: publicMetrics.contentProfile || "unknown",
      subtext: `${formatNumber(estimates.estimatedMonthlyViews || 0)} est. monthly views`,
    },
  ]);
}

function drawRecentViewsChart(points) {
  fallbackChartPanel.classList.remove("hidden");
  const ctx = document.getElementById("recent-views-chart");
  if (recentViewsChart) {
    recentViewsChart.destroy();
  }

  recentViewsChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: points.map((point) => point.label),
      datasets: [
        {
          label: "Views",
          data: points.map((point) => point.views),
          borderColor: "#e85d04",
          backgroundColor: "rgba(232, 93, 4, 0.12)",
          fill: true,
          tension: 0.35,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          ticks: {
            callback: (value) => formatNumber(value),
          },
        },
      },
    },
  });
}

function drawOwnerAnalyticsChart(points) {
  ownerChartPanel.classList.remove("hidden");
  const ctx = document.getElementById("owner-analytics-chart");
  if (ownerAnalyticsChart) {
    ownerAnalyticsChart.destroy();
  }

  ownerAnalyticsChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: points.map((point) => point.day),
      datasets: [
        {
          type: "line",
          label: "Views",
          data: points.map((point) => point.views),
          borderColor: "#173b7a",
          backgroundColor: "rgba(23, 59, 122, 0.15)",
          yAxisID: "y",
          tension: 0.3,
        },
        {
          type: "bar",
          label: "Net Subscribers",
          data: points.map((point) => point.netSubscribers),
          backgroundColor: "#ffb703",
          yAxisID: "y1",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          position: "left",
          ticks: {
            callback: (value) => formatNumber(value),
          },
        },
        y1: {
          position: "right",
          grid: {
            drawOnChartArea: false,
          },
        },
      },
    },
  });
}

publicForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const channel = document.getElementById("channel-input").value.trim();
  const apiKey = document.getElementById("api-key-input").value.trim();

  resetAiInsights();
  currentOwnerPayload = null;
  lastOwnerCards = [];
  renderStatsCards();
  showStatus("Loading public channel metrics and estimated revenue model...");

  try {
    const response = await fetch(
      `/api/public?channel=${encodeURIComponent(channel)}&apiKey=${encodeURIComponent(apiKey)}`
    );
    const data = await readResponsePayload(response);

    if (!response.ok) {
      throw new Error(data.error || "Failed to load public metrics.");
    }

    currentPublicPayload = data;
    renderPublicSummary(data);
    drawRecentViewsChart(data.chartFallback || []);
    tablesSection.classList.remove("hidden");

    renderTable(
      topVideosTable,
      [
        {
          label: "Video",
          render: (row) =>
            `<a href="${row.url}" target="_blank" rel="noreferrer">${row.title}</a>`,
        },
        { label: "Views", render: (row) => formatNumber(row.views) },
        { label: "Likes", render: (row) => formatNumber(row.likes) },
        { label: "Comments", render: (row) => formatNumber(row.comments) },
      ],
      data.topRecentVideos || []
    );

    renderTable(
      recentVideosTable,
      [
        { label: "Published", render: (row) => formatDate(row.publishedAt) },
        {
          label: "Title",
          render: (row) =>
            `<a href="${row.url}" target="_blank" rel="noreferrer">${row.title}</a>`,
        },
        { label: "Views", render: (row) => formatNumber(row.views) },
        { label: "Format", render: (row) => (row.isShort ? "Short" : "Long") },
      ],
      data.recentVideos || []
    );

    ownerTablesSection.classList.add("hidden");
    ownerChartPanel.classList.add("hidden");
    setAllSections(true);

    if (runtimeConfig.hasGeminiApiKey) {
      await loadAiInsights();
    } else {
      showStatus(
        "Public metrics loaded. Gemini insights are disabled because GEMINI_API_KEY is not configured.",
        "success"
      );
    }
  } catch (error) {
    showStatus(error.message, "error");
  }
});

videoForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const video = document.getElementById("video-input").value.trim();
  resetVideoTools();
  showStatus("Loading video metadata and download tools...");

  try {
    const response = await fetch(`/api/video?video=${encodeURIComponent(video)}`);
    const data = await readResponsePayload(response);
    if (!response.ok) {
      throw new Error(data.error || "Failed to load video tools.");
    }

    renderVideoSummary(data);
    showStatus("Video tools loaded successfully.", "success");
  } catch (error) {
    showStatus(error.message, "error");
  }
});

ownerForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const channelId = ownerChannelIdInput.value.trim();
  const accessToken = document.getElementById("access-token-input").value.trim();
  const startDate = document.getElementById("start-date-input").value;
  const endDate = document.getElementById("end-date-input").value;

  showStatus("Loading owner analytics...");

  try {
    const response = await fetch("/api/owner", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channelId,
        accessToken,
        startDate,
        endDate,
      }),
    });

    const data = await readResponsePayload(response);

    if (!response.ok) {
      throw new Error(data.error || "Failed to load owner analytics.");
    }

    setActivePage("owner");
    emptyState.classList.add("hidden");
    overviewPanel.classList.remove("hidden");
    currentOwnerPayload = data;
    setOwnerCards([
      {
        label: "Verified RPM",
        value: currencyFormatter.format(data.monetization.rpm || 0),
        subtext: "Derived as estimated revenue / views * 1000",
      },
      {
        label: "Verified Revenue",
        value: currencyFormatter.format(data.monetization.estimatedRevenue || 0),
        subtext: `${data.dateRange.startDate} to ${data.dateRange.endDate}`,
      },
      {
        label: "Net Subscribers",
        value: formatNumber(data.audience.netSubscribers || 0),
        subtext: `Gained ${formatNumber(
          data.audience.subscribersGained || 0
        )} / Lost ${formatNumber(data.audience.subscribersLost || 0)}`,
      },
      {
        label: "Watch Time (Minutes)",
        value: formatNumber(data.audience.watchTimeMinutes || 0),
        subtext: "Total watch time in selected range",
      },
    ]);

    drawOwnerAnalyticsChart(data.charts.viewsAndSubscribers || []);
    ownerTablesSection.classList.remove("hidden");

    renderTable(
      geographyTable,
      [
        { label: "Country", render: (row) => row.country },
        { label: "Views", render: (row) => formatNumber(row.views) },
        {
          label: "Revenue",
          render: (row) => currencyFormatter.format(row.estimatedRevenue || 0),
        },
        { label: "Watch Time", render: (row) => formatNumber(row.watchTime) },
      ],
      data.geography || []
    );

    renderTable(
      demographicsTable,
      [
        { label: "Age Group", render: (row) => row.ageGroup },
        { label: "Gender", render: (row) => row.gender },
        {
          label: "Viewer %",
          render: (row) => formatPercent(row.viewerPercentage || 0),
        },
      ],
      data.demographics || []
    );

    showStatus("Owner analytics loaded successfully.", "success");
    if (currentPublicPayload && runtimeConfig.hasGeminiApiKey) {
      await loadAiInsights();
    }
  } catch (error) {
    showStatus(error.message, "error");
  }
});

fillOwnerBtn.addEventListener("click", () => {
  const channelId = currentPublicPayload?.channel?.id;
  if (channelId) {
    setActivePage("owner");
    ownerChannelIdInput.value = channelId;
    const ownerToggle = document.querySelector('[data-target="owner-form-body"]');
    if (ownerToggle) {
      toggleSection(ownerToggle, true);
    }
    showStatus("Channel ID has been filled into the owner form.", "success");
  } else {
    showStatus("Analyze a channel first before filling the owner channel ID.", "error");
  }
});

clearVideoBtn.addEventListener("click", () => {
  document.getElementById("video-input").value = "";
  resetVideoTools();
  showStatus("Video tools have been cleared.", "success");
});

scanPromptBtn.addEventListener("click", () => {
  setActivePage("prompt");
  setActivePromptPane("builder");
  emptyState.classList.add("hidden");
  renderPromptVariables(getPromptTemplate());
  showStatus("Prompt variables have been scanned.", "success");
});

analyzePromptAiBtn.addEventListener("click", handlePromptAnalyzeClick);

normalizePromptBtn.addEventListener("click", () => {
  setActivePage("prompt");
  emptyState.classList.add("hidden");
  normalizePromptText();
  showStatus("Prompt spacing has been normalized.", "success");
});

clearPromptBtn.addEventListener("click", () => {
  promptTemplateInput.value = "";
  promptVariableState = {};
  currentPromptAnalysis = null;
  setActivePromptPane("builder");
  promptVariables.innerHTML = `<p class="empty">No variables detected yet.</p>`;
  promptRenderedOutput.textContent = "";
  promptStats.textContent = "";
  promptOutputPanel.classList.add("hidden");
  promptAnalysisContent.innerHTML =
    `<p class="empty">Run AI analysis to get a suggested title, group, tags, and usage notes for this prompt.</p>`;
  showStatus("Prompt tools have been cleared.", "success");
});

resetPromptLibraryBtn.addEventListener("click", () => {
  resetPromptLibraryEditor();
  showStatus("Prompt library editor has been reset.", "success");
});

promptTemplateInput.addEventListener("input", () => {
  setActivePage("prompt");
  setActivePromptPane("builder");
  emptyState.classList.add("hidden");
  currentPromptAnalysis = null;
  promptAnalysisContent.innerHTML =
    `<p class="empty">Run AI analysis to get a suggested title, group, tags, and usage notes for this prompt.</p>`;
  renderPromptVariables(getPromptTemplate());
});

promptThumbnailInput.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  if (file.size > 12 * 1024 * 1024) {
    promptThumbnailInput.value = "";
    showStatus("Please choose an image smaller than 12 MB.", "error");
    return;
  }

  try {
    const imagePayload = await readImageFileAsDataUrl(file);
    currentPromptThumbnailDataUrl = imagePayload.dataUrl;
    currentPromptThumbnailMeta = imagePayload.meta;
    renderPromptThumbnailPreview();
    reportClientLog("prompt thumbnail loaded", {
      name: file.name,
      type: file.type,
      originalBytes: imagePayload.originalBytes || file.size,
      finalBytes: imagePayload.bytesApprox || file.size,
      orientation: imagePayload.meta?.orientation || "",
      width: imagePayload.meta?.width || 0,
      height: imagePayload.meta?.height || 0,
      wasCompressed: Boolean(imagePayload.wasCompressed),
    });
    showStatus(
      imagePayload.wasCompressed
        ? `Thumbnail loaded and optimized from ${formatBytes(
            imagePayload.originalBytes
          )} to ${formatBytes(imagePayload.bytesApprox)}.`
        : `Thumbnail loaded successfully (${formatBytes(file.size)}).`,
      "success"
    );
  } catch (error) {
    currentPromptThumbnailDataUrl = "";
    currentPromptThumbnailMeta = null;
    promptThumbnailInput.value = "";
    renderPromptThumbnailPreview();
    showStatus(error.message, "error");
  }
});

clearPromptThumbnailBtn.addEventListener("click", () => {
  currentPromptThumbnailDataUrl = "";
  currentPromptThumbnailMeta = null;
  promptThumbnailInput.value = "";
  renderPromptThumbnailPreview();
  showStatus("Thumbnail removed from the current prompt draft.", "success");
});

copyRenderedPromptBtn.addEventListener("click", async () => {
  const rendered = buildRenderedPrompt(getPromptTemplate());
  await navigator.clipboard.writeText(rendered);
  showStatus("Rendered prompt copied to clipboard.", "success");
});

copyVariablesJsonBtn.addEventListener("click", async () => {
  const variables = extractPromptVariables(getPromptTemplate()).reduce((acc, variable) => {
    acc[variable.name] = promptVariableState[variable.name] || "";
    return acc;
  }, {});
  await navigator.clipboard.writeText(JSON.stringify(variables, null, 2));
  showStatus("Variables JSON copied to clipboard.", "success");
});

savePromptTemplateBtn.addEventListener("click", () => {
  const template = getPromptTemplate().trim();
  if (!template) {
    showStatus("Enter a prompt template before saving.", "error");
    return;
  }
  localStorage.setItem("youtubePromptTemplate", template);
  localStorage.setItem("youtubePromptVariables", JSON.stringify(promptVariableState));
  showStatus("Prompt template saved locally in this browser.", "success");
});

savePromptLibraryBtn.addEventListener("click", handlePromptSaveClick);

refreshPromptLibraryBtn.addEventListener("click", async () => {
  await loadPromptLibrary();
  showStatus("Prompt library refreshed.", "success");
});

promptLibrarySearch.addEventListener("input", () => {
  loadPromptLibrary();
});

promptLibraryGroupFilter.addEventListener("change", () => {
  loadPromptLibrary();
});

promptPaneNavItems.forEach((item) => {
  item.addEventListener("click", () => {
    setActivePage("prompt");
    setActivePromptPane(item.dataset.promptPane || "builder");
  });
});

confirmModalCancel.addEventListener("click", () => {
  closeConfirmModal(false);
});

confirmModalConfirm.addEventListener("click", () => {
  closeConfirmModal(true);
});

confirmModal.addEventListener("click", (event) => {
  if (event.target instanceof HTMLElement && event.target.dataset.confirmClose === "backdrop") {
    closeConfirmModal(false);
  }
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && pendingConfirmResolver) {
    closeConfirmModal(false);
  }
});

promptLibraryList.addEventListener("click", (event) => {
  const copyButton = event.target.closest("[data-copy-prompt-id]");
  if (copyButton) {
    const id = copyButton.dataset.copyPromptId || "";
    reportClientLog("prompt copy click received", { id });
    void copyPromptFromLibrary(id);
    return;
  }

  const editButton = event.target.closest("[data-edit-prompt-id]");
  if (editButton) {
    const id = editButton.dataset.editPromptId || "";
    reportClientLog("prompt edit click received", { id });
    void editPromptFromLibrary(id);
    return;
  }

  const deleteButton = event.target.closest("[data-delete-prompt-id]");
  if (deleteButton) {
    const id = deleteButton.dataset.deletePromptId || "";
    reportClientLog("prompt delete click received", { id });
    void deletePromptFromLibrary(id);
  }
});

downloadTranscriptBtn.addEventListener("click", () => {
  if (!currentVideoPayload) {
    showStatus("Load a video first before downloading a transcript.", "error");
    return;
  }
  if (!currentVideoPayload.transcriptAvailable) {
    showStatus("This video does not expose subtitles or auto-captions.", "error");
    return;
  }
  window.location.href = getVideoDownloadUrl("transcript");
});

downloadThumbnailBtn.addEventListener("click", () => {
  if (!currentVideoPayload) {
    showStatus("Load a video first before downloading a thumbnail.", "error");
    return;
  }
  if (!currentVideoPayload.thumbnailDownloadAvailable) {
    showStatus("Thumbnail is not available for this video.", "error");
    return;
  }
  window.location.href = getVideoDownloadUrl("thumbnail");
});

downloadVideoBtn.addEventListener("click", () => {
  if (!currentVideoPayload) {
    showStatus("Load a video first before downloading the video.", "error");
    return;
  }
  if (!currentVideoPayload.videoDownloadAvailable) {
    showStatus(
      "Direct MP4 download is not available for this video in the current environment.",
      "error"
    );
    return;
  }
  showStatus("Preparing video download. Large videos may take a while...");
  window.location.href = getVideoDownloadUrl("video");
});

toggleAllBtn.addEventListener("click", () => {
  const expand = toggleAllBtn.textContent.includes("Expand");
  setAllSections(expand);
});

pageNavItems.forEach((item) => {
  item.addEventListener("click", () => {
    const page = item.dataset.navPage || "channel";
    setActivePage(page);
    hideStatus();
  });
});

window.addEventListener("hashchange", () => {
  const page = getPageFromHash();
  if (page !== activePage) {
    setActivePage(page, { updateHash: false });
    hideStatus();
  }
});

initializeToggles();
loadRuntimeConfig();
const savedPromptTemplate = localStorage.getItem("youtubePromptTemplate") || "";
const savedPromptVariables = localStorage.getItem("youtubePromptVariables") || "{}";
if (savedPromptTemplate) {
  promptTemplateInput.value = savedPromptTemplate;
}
try {
  promptVariableState = JSON.parse(savedPromptVariables);
} catch (error) {
  promptVariableState = {};
}
setActivePromptPane("builder");
renderPromptVariables(getPromptTemplate());
promptLibraryInput.value = "";
renderPromptThumbnailPreview();
setActivePage(getPageFromHash(), { updateHash: false });
hideStatus();
promptLibraryInput.addEventListener("input", () => {
  setActivePage("prompt");
  setActivePromptPane("library");
  emptyState.classList.add("hidden");
  currentPromptAnalysis = null;
  promptAnalysisContent.innerHTML =
    `<p class="empty">Run AI analysis to get a suggested title, group, tags, and usage notes for this prompt.</p>`;
});
