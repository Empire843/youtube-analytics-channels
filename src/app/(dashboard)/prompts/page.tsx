"use client";

import { useState, useEffect, useCallback } from "react";
import StatusToast from "@/components/ui/StatusToast";
import ConfirmModal from "@/components/ui/ConfirmModal";

export default function PromptsPage() {
  const [activeTab, setActiveTab] = useState("builder");

  // Builder state
  const [template, setTemplate] = useState("");
  const [variables, setVariables] = useState<string[]>([]);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});

  // Library state
  const [promptInput, setPromptInput] = useState("");
  const [promptTitle, setPromptTitle] = useState("");
  const [thumbnailDataUrl, setThumbnailDataUrl] = useState("");
  const [library, setLibrary] = useState<any[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  // Modal
  const [confirmModal, setConfirmModal] = useState({ open: false, id: "", group: "" });

  // Toast
  const [toast, setToast] = useState({ visible: false, message: "", type: "info" as "info" | "success" | "error" });
  const showToast = useCallback((message: string, type: "info" | "success" | "error" = "info") => {
    setToast({ visible: true, message, type });
  }, []);

  // Load saved template from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("youtubePromptTemplate");
    const savedVars = localStorage.getItem("youtubePromptVariables");
    if (saved) setTemplate(saved);
    if (savedVars) {
      try { setVariableValues(JSON.parse(savedVars)); } catch {}
    }
  }, []);

  useEffect(() => {
    if (activeTab === "library") fetchLibrary();
  }, [activeTab, searchQuery, groupFilter]);

  const scanVariables = () => {
    const pattern = /\[<([^>]+)>\]|\{\{([^\}]+)\}\}|\[\[([^\]]+)\]\]/gu;
    const found = new Set<string>();
    let match;
    while ((match = pattern.exec(template)) !== null) {
      const v = match[1] || match[2] || match[3];
      if (v) found.add(v.trim());
    }
    setVariables(Array.from(found));
    showToast(`Found ${found.size} variable(s).`, "success");
  };

  const fetchLibrary = async () => {
    setLoadingLibrary(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      if (groupFilter) params.set("group", groupFilter);
      const res = await fetch(`/api/library?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setLibrary(data.items || []);
        setGroups(data.groups || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingLibrary(false);
    }
  };

  const handleAnalyze = async () => {
    if (!promptInput) return;
    setAnalyzing(true);
    try {
      const res = await fetch("/api/prompt-library/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: promptInput, title: promptTitle }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setAnalysisResult(data.analysis);
      if (!promptTitle && data.analysis.suggestedTitle) {
        setPromptTitle(data.analysis.suggestedTitle);
      }
      showToast("Analysis complete!", "success");
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSave = async () => {
    if (!promptInput || !analysisResult) return;
    setSaving(true);
    try {
      const payload: any = {
        prompt: promptInput,
        title: promptTitle,
        thumbnailDataUrl: thumbnailDataUrl || undefined,
        analysis: analysisResult,
        primaryGroup: analysisResult?.primaryGroup,
        renderedPrompt: template,
        variables: variables.map((v) => ({ name: v })),
      };
      if (editingId) payload.id = editingId;

      const res = await fetch("/api/prompt-library/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      resetEditor();
      fetchLibrary();
      showToast("Saved to library!", "success");
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, group: string) => {
    try {
      await fetch("/api/prompt-library/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, group }),
      });
      fetchLibrary();
      showToast("Prompt deleted.", "success");
    } catch (e: any) {
      showToast(e.message, "error");
    }
  };

  const handleCopy = async (prompt: string) => {
    await navigator.clipboard.writeText(prompt);
    showToast("Prompt copied to clipboard!", "success");
  };

  const handleEdit = (item: any) => {
    setPromptInput(item.prompt || "");
    setPromptTitle(item.title || "");
    setThumbnailDataUrl(item.thumbnailDataUrl || "");
    setAnalysisResult(item.analysis || null);
    setEditingId(item.id);
    showToast("Loaded prompt for editing.", "info");
  };

  const resetEditor = () => {
    setPromptInput("");
    setPromptTitle("");
    setThumbnailDataUrl("");
    setAnalysisResult(null);
    setEditingId(null);
  };

  const handleThumbnailUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setThumbnailDataUrl(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const renderTemplate = () => {
    let result = template;
    variables.forEach((v) => {
      const val = variableValues[v] || `[${v}]`;
      result = result.replace(
        new RegExp(`\\[<${v}>\\]|\\{\\{${v}\\}\\}|\\[\\[${v}\\]\\]`, "g"),
        val
      );
    });
    return result;
  };

  const saveTemplateLocally = () => {
    localStorage.setItem("youtubePromptTemplate", template);
    localStorage.setItem("youtubePromptVariables", JSON.stringify(variableValues));
    showToast("Template saved locally in this browser.", "success");
  };

  const copyRendered = async () => {
    const rendered = renderTemplate();
    await navigator.clipboard.writeText(rendered);
    showToast("Rendered prompt copied to clipboard!", "success");
  };

  const copyVariablesJson = async () => {
    const vars = variables.reduce((acc, v) => {
      acc[v] = variableValues[v] || "";
      return acc;
    }, {} as Record<string, string>);
    await navigator.clipboard.writeText(JSON.stringify(vars, null, 2));
    showToast("Variables JSON copied!", "success");
  };

  const normalizePrompt = () => {
    setTemplate((t) =>
      t
        .replace(/\r\n/g, "\n")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
    );
    showToast("Prompt normalized.", "success");
  };

  const estimateTokens = (text: string) => Math.ceil(text.length / 4);

  return (
    <>
      <StatusToast
        message={toast.message}
        type={toast.type}
        visible={toast.visible}
        onClose={() => setToast((t) => ({ ...t, visible: false }))}
      />
      <ConfirmModal
        open={confirmModal.open}
        title="Delete Prompt"
        message="Are you sure you want to delete this prompt? This action cannot be undone."
        danger
        confirmLabel="Delete"
        onConfirm={() => {
          handleDelete(confirmModal.id, confirmModal.group);
          setConfirmModal({ open: false, id: "", group: "" });
        }}
        onCancel={() => setConfirmModal({ open: false, id: "", group: "" })}
      />

      <section className="panel prompt-studio">
        <div className="prompt-studio-hero">
          <div>
            <p className="eyebrow">Prompt Tools</p>
            <h2>Prompt Studio</h2>
            <p className="summary-text">
              Build prompt templates, detect variables, and preview the final
              rendered prompt in a full-width workspace.
            </p>
          </div>
        </div>

        <nav className="prompt-submenu">
          <button
            className={`prompt-submenu-link ${activeTab === "builder" ? "active" : ""}`}
            onClick={() => setActiveTab("builder")}
          >
            Template Builder
          </button>
          <button
            className={`prompt-submenu-link ${activeTab === "library" ? "active" : ""}`}
            onClick={() => setActiveTab("library")}
          >
            Library & Analyze
          </button>
        </nav>

        {/* ── Builder Tab ──────────────────────── */}
        {activeTab === "builder" && (
          <div className="prompt-studio-grid">
            <article className="prompt-editor-surface">
              <div className="prompt-surface-head">
                <h3>Prompt editor</h3>
              </div>
              <label className="prompt-editor-label">
                <textarea
                  rows={14}
                  placeholder="Example: Write a [<tone>] YouTube script about {{topic}} for [[audience]]."
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                />
              </label>
              {/* Prompt stats */}
              <div className="prompt-stats" style={{ padding: "10px 14px", marginTop: "12px" }}>
                <span style={{ fontSize: "0.82rem", color: "var(--muted)" }}>
                  {template.length} chars · {template.split(/\s+/g).filter(Boolean).length} words · ~{estimateTokens(template)} tokens
                </span>
              </div>
              <div className="button-row" style={{ marginTop: "16px" }}>
                <button type="button" onClick={scanVariables}>Scan variables</button>
                <button className="ghost-button" type="button" onClick={normalizePrompt}>Normalize</button>
                <button className="ghost-button" type="button" onClick={saveTemplateLocally}>Save locally</button>
                <button className="ghost-button" type="button" onClick={() => setTemplate("")}>Clear</button>
              </div>
              <div className="prompt-helper" style={{ marginTop: "24px" }}>
                <strong>Template patterns supported</strong>
                <p>
                  Use [&lt;variable&gt;], {"{{"}variable{"}}"}, or [[variable]]
                  anywhere in your prompt.
                </p>
              </div>
            </article>

            <article className="prompt-variables-surface" style={{ padding: "24px", background: "var(--bg-secondary)", borderRadius: "12px", border: "1px solid var(--line)" }}>
              <div className="prompt-surface-head">
                <h3>Variable inputs</h3>
              </div>
              <div className="prompt-variables">
                {variables.length === 0 ? (
                  <p className="empty">No variables detected yet.</p>
                ) : (
                  <div className="stack">
                    {variables.map((v) => (
                      <label key={v}>
                        <span>{v}</span>
                        <input
                          type="text"
                          value={variableValues[v] || ""}
                          onChange={(e) =>
                            setVariableValues((prev) => ({
                              ...prev,
                              [v]: e.target.value,
                            }))
                          }
                        />
                      </label>
                    ))}
                  </div>
                )}
              </div>
              {variables.length > 0 && (
                <div style={{ marginTop: "24px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <h4>Preview:</h4>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button className="ghost-button" type="button" onClick={copyRendered} style={{ padding: "6px 10px", fontSize: "0.82rem" }}>
                        Copy rendered
                      </button>
                      <button className="ghost-button" type="button" onClick={copyVariablesJson} style={{ padding: "6px 10px", fontSize: "0.82rem" }}>
                        Copy JSON
                      </button>
                    </div>
                  </div>
                  <pre style={{ padding: "16px", background: "rgba(255,255,255,0.7)", borderRadius: "8px", whiteSpace: "pre-wrap", border: "1px solid var(--line)" }}>
                    {renderTemplate()}
                  </pre>
                </div>
              )}
            </article>
          </div>
        )}

        {/* ── Library Tab ──────────────────────── */}
        {activeTab === "library" && (
          <div style={{ display: "flex", gap: "24px", alignItems: "flex-start" }}>
            <article className="prompt-analysis-surface" style={{ flex: "2", padding: "24px", background: "rgba(255,255,255,0.5)", borderRadius: "12px", border: "1px solid var(--line)" }}>
              <div className="prompt-surface-head">
                <h3>{editingId ? "Edit Prompt" : "Analyze and Save"}</h3>
                <p className="summary-note">
                  Stored locally in the project folder for now.
                </p>
              </div>
              <div className="prompt-library-main stack">
                <label>
                  <span>Prompt Title</span>
                  <input
                    type="text"
                    placeholder="Optional title"
                    value={promptTitle}
                    onChange={(e) => setPromptTitle(e.target.value)}
                  />
                </label>
                <label className="prompt-editor-label">
                  <span>Prompt To Analyze and Save</span>
                  <textarea
                    rows={8}
                    placeholder="Paste any collected prompt here..."
                    value={promptInput}
                    onChange={(e) => setPromptInput(e.target.value)}
                  />
                </label>
                <div className="button-row" style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
                  <button type="button" onClick={handleAnalyze} disabled={analyzing || !promptInput}>
                    {analyzing ? "Analyzing..." : "Analyze with AI"}
                  </button>
                  <button className="ghost-button" type="button" onClick={handleSave} disabled={saving || !promptInput || !analysisResult}>
                    {saving ? "Saving..." : editingId ? "Update" : "Save to library"}
                  </button>
                  <button className="ghost-button" type="button" onClick={resetEditor}>
                    New prompt
                  </button>
                </div>

                {analysisResult && (
                  <div style={{ marginTop: "24px", padding: "16px", background: "rgba(255,255,255,0.7)", borderRadius: "8px", border: "1px solid var(--line)" }}>
                    <h4 style={{ margin: "0 0 8px 0" }}>Analysis Result:</h4>
                    <p style={{ margin: "0 0 12px 0", fontSize: "0.875rem", color: "var(--muted)" }}>
                      {analysisResult.summary}
                    </p>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "12px" }}>
                      <span style={{ fontSize: "0.75rem", padding: "2px 8px", background: "var(--accent)", color: "white", borderRadius: "12px" }}>
                        {analysisResult.primaryGroup}
                      </span>
                      {analysisResult.tags?.map((t: string) => (
                        <span key={t} style={{ fontSize: "0.75rem", padding: "2px 8px", border: "1px solid var(--line)", borderRadius: "12px" }}>
                          {t}
                        </span>
                      ))}
                    </div>
                    {analysisResult.useCases?.length > 0 && (
                      <div style={{ fontSize: "0.875rem" }}>
                        <strong>Use cases:</strong>
                        <ul style={{ margin: "4px 0 0 0", paddingLeft: "20px", color: "var(--muted)" }}>
                          {analysisResult.useCases.map((u: string) => (
                            <li key={u}>{u}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </article>

            <aside className="prompt-library-aside" style={{ flex: "1", display: "flex", flexDirection: "column", gap: "24px" }}>
              <div className="prompt-thumbnail-field" style={{ padding: "24px", background: "rgba(255,255,255,0.5)", borderRadius: "12px", border: "1px solid var(--line)" }}>
                <div className="prompt-thumbnail-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                  <span>Thumbnail</span>
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => setThumbnailDataUrl("")}
                    style={{ padding: "4px 8px", fontSize: "0.875rem" }}
                  >
                    Remove
                  </button>
                </div>
                <label className="prompt-thumbnail-dropzone" style={{ display: "block", cursor: "pointer", padding: "16px", border: "2px dashed var(--line)", borderRadius: "8px", textAlign: "center", marginBottom: "16px" }}>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    style={{ display: "none" }}
                    onChange={handleThumbnailUpload}
                  />
                  <span className="prompt-thumbnail-dropzone-copy" style={{ fontSize: "0.875rem", color: "var(--muted)" }}>
                    Choose a thumbnail image or replace the current one.
                  </span>
                </label>
                <div className="prompt-thumbnail-preview" style={{ minHeight: "100px", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--line)", borderRadius: "8px", background: "rgba(255,255,255,0.7)", overflow: "hidden" }}>
                  {thumbnailDataUrl ? (
                    <img src={thumbnailDataUrl} alt="Thumbnail preview" style={{ maxWidth: "100%", maxHeight: "200px", objectFit: "contain" }} />
                  ) : (
                    <p style={{ color: "var(--muted)", fontSize: "0.875rem" }}>No thumbnail selected yet.</p>
                  )}
                </div>
              </div>
            </aside>
          </div>
        )}

        {/* ── Library List ──────────────────────── */}
        {activeTab === "library" && (
          <article className="prompt-library-surface" style={{ marginTop: "32px" }}>
            <div className="prompt-surface-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3>Saved Prompt Collection</h3>
              <button className="ghost-button" type="button" onClick={fetchLibrary} disabled={loadingLibrary}>
                {loadingLibrary ? "Refreshing..." : "Refresh"}
              </button>
            </div>

            {/* Search & Filter */}
            <div className="prompt-library-toolbar" style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "10px", marginBottom: "20px" }}>
              <input
                type="text"
                placeholder="Search prompts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <select
                value={groupFilter}
                onChange={(e) => setGroupFilter(e.target.value)}
                style={{
                  padding: "14px 16px",
                  borderRadius: "16px",
                  border: "1px solid var(--line)",
                  background: "rgba(255,255,255,0.9)",
                  fontFamily: "inherit",
                  color: "var(--text)",
                  minWidth: "160px",
                }}
              >
                <option value="">All groups</option>
                {groups.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            <div className="prompt-library-list">
              {library.length === 0 ? (
                <p className="empty">
                  {loadingLibrary ? "Loading..." : "No saved prompts yet."}
                </p>
              ) : (
                library.map((p) => (
                  <article key={p.id} className="prompt-card">
                    <div className={`prompt-card-thumb ${p.thumbnailDataUrl ? "" : "is-empty"}`}>
                      {p.thumbnailDataUrl ? (
                        <img src={p.thumbnailDataUrl} alt={p.title || "Prompt thumbnail"} loading="lazy" />
                      ) : (
                        <span>No image</span>
                      )}
                    </div>
                    <div className="prompt-card-content">
                      <div className="prompt-card-header">
                        <span className="prompt-card-group">
                          {p.primaryGroup || "no-group"} &bull; #{p.sequence || ""}
                        </span>
                        <div className="prompt-card-actions">
                          <button
                            className="prompt-card-action"
                            type="button"
                            onClick={() => handleCopy(p.prompt || "")}
                            title="Copy prompt"
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                          </button>
                          <button
                            className="prompt-card-action"
                            type="button"
                            onClick={() => handleEdit(p)}
                            title="Edit prompt"
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                            </svg>
                          </button>
                          <button
                            className="prompt-card-action prompt-card-action--danger"
                            type="button"
                            onClick={() => setConfirmModal({ open: true, id: p.id, group: p.primaryGroup })}
                            title="Delete prompt"
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      <h4 className="prompt-card-title">
                        {p.title || p.analysis?.suggestedTitle || `Prompt #${p.sequence || ""}`}
                      </h4>
                      {p.summary && (
                        <p className="prompt-library-meta prompt-library-summary">{p.summary}</p>
                      )}
                      {p.tags?.length > 0 && (
                        <div className="prompt-card-tags">
                          <div className="prompt-chip-row">
                            {p.tags.slice(0, 4).map((t: string) => (
                              <span key={t} className="prompt-chip">{t}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="prompt-card-snippet">
                        {(p.prompt || "").slice(0, 180)}
                      </div>
                      <div className="prompt-card-footer">
                        <span className="prompt-card-date">
                          Saved {new Date(p.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          </article>
        )}
      </section>
    </>
  );
}
