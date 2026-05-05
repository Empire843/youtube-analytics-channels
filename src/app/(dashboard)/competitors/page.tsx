"use client";

import { useState, useCallback } from "react";
import StatusToast from "@/components/ui/StatusToast";
import CollapsibleSection from "@/components/ui/CollapsibleSection";

export default function CompetitorsPage() {
  const [channelInput, setChannelInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState({ visible: false, message: "", type: "info" as "info" | "success" | "error" });

  const showToast = useCallback((message: string, type: "info" | "success" | "error" = "info") => {
    setToast({ visible: true, message, type });
  }, []);

  const fmt = (n: number) => new Intl.NumberFormat("en-US").format(n);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setData(null);

    try {
      const res = await fetch("/api/competitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelInput }),
      });
      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Failed to find competitors.");
      }

      setData(result);
      showToast(`Found ${result.competitors?.length || 0} competitors!`, "success");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAiAnalysis = async () => {
    if (!data?.source || !data?.competitors) return;
    setAnalyzing(true);
    setError(null);

    try {
      const res = await fetch("/api/competitors/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: data.source,
          competitors: data.competitors,
        }),
      });
      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Failed to analyze competitors.");
      }

      setData((prev: any) => ({
        ...prev,
        aiAnalysis: result.analysis,
      }));
      showToast("AI analysis complete!", "success");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <>
      <StatusToast
        message={toast.message}
        type={toast.type}
        visible={toast.visible}
        onClose={() => setToast((t) => ({ ...t, visible: false }))}
      />

      <section className="panel competitor-workspace">
        <div className="competitor-hero">
          <div>
            <p className="eyebrow">Competitor Finder</p>
            <h2>Find Similar Channels</h2>
            <p className="summary-text">
              Enter a YouTube channel to discover competitors in the same niche
              using AI-powered keyword analysis.
            </p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="competitor-form">
          <div className="competitor-form-row">
            <input
              type="text"
              placeholder="Channel URL, @handle, or channel ID"
              value={channelInput}
              onChange={(e) => setChannelInput(e.target.value)}
              required
            />
            <button type="submit" disabled={loading}>
              {loading ? "Searching..." : "Find Competitors"}
            </button>
          </div>
        </form>

        {error && (
          <section className="status error" style={{ display: "block", marginTop: "24px" }}>
            <p><strong>Error:</strong> {error}</p>
          </section>
        )}

        {loading && (
          <section className="panel" style={{ textAlign: "center", padding: "48px", marginTop: "24px" }}>
            <p style={{ color: "var(--muted)", fontSize: "1.1rem" }}>
              Searching for competitors...
            </p>
          </section>
        )}

        {data && (
          <div className="competitor-results" style={{ marginTop: "24px" }}>
            {/* Source Channel Card */}
            <div className="competitor-source-card" style={{
              marginBottom: "24px",
              padding: "20px",
              border: "1px solid var(--line)",
              borderRadius: "18px",
              background: "rgba(255,255,255,0.5)",
              display: "flex",
              gap: "16px",
              alignItems: "center",
            }}>
              {data.source?.thumbnail && (
                <img
                  src={data.source.thumbnail}
                  alt={data.source.title}
                  style={{ width: "64px", height: "64px", borderRadius: "16px", objectFit: "cover" }}
                />
              )}
              <div>
                <h3 style={{ fontSize: "1.125rem", margin: "0 0 6px 0", color: "var(--text)" }}>
                  Target: {data.source?.title}
                </h3>
                <p style={{ margin: "0 0 4px 0", color: "var(--muted)", fontSize: "0.875rem" }}>
                  <strong>Topic:</strong> {data.dna?.topic} &nbsp;|&nbsp;
                  <strong>Style:</strong> {data.dna?.contentStyle}
                </p>
                <p style={{ margin: "0", color: "var(--muted)", fontSize: "0.875rem" }}>
                  <strong>Tone:</strong> {data.dna?.tone} &nbsp;|&nbsp;
                  <strong>Language:</strong> {data.dna?.language}
                </p>
              </div>
            </div>

            {/* Competitor Grid Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3>Similar Channels ({data.competitors?.length || 0})</h3>
              <button
                className="ghost-button"
                type="button"
                onClick={handleAiAnalysis}
                disabled={analyzing}
              >
                {analyzing ? "Analyzing..." : "Run AI Analysis"}
              </button>
            </div>

            {/* Competitor Grid */}
            <div className="competitor-grid" style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: "16px",
            }}>
              {data.competitors?.map((comp: any, i: number) => (
                <div
                  key={i}
                  className="channel-card"
                  style={{
                    padding: "20px",
                    border: "1px solid var(--line)",
                    borderRadius: "18px",
                    background: "rgba(255,255,255,0.5)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                  }}
                >
                  <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                    {comp.thumbnail && (
                      <img
                        src={comp.thumbnail}
                        alt={comp.title}
                        style={{ width: "48px", height: "48px", borderRadius: "12px", objectFit: "cover" }}
                      />
                    )}
                    <div>
                      <h4 style={{ margin: "0 0 2px 0", color: "var(--text)" }}>{comp.title}</h4>
                      {comp.customUrl && (
                        <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.82rem" }}>
                          {comp.customUrl}
                        </p>
                      )}
                    </div>
                  </div>
                  {comp.matchScore && (
                    <div style={{
                      display: "inline-flex",
                      alignSelf: "flex-start",
                      padding: "4px 10px",
                      borderRadius: "999px",
                      background: "var(--accent-soft)",
                      fontSize: "0.78rem",
                      fontWeight: 700,
                      color: "var(--accent)",
                    }}>
                      Match: {comp.matchScore}%
                    </div>
                  )}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    <div style={{ fontSize: "0.875rem" }}>
                      <strong style={{ display: "block", color: "var(--muted)", fontSize: "0.78rem" }}>Subscribers</strong>
                      {fmt(Number(comp.subscribers || 0))}
                    </div>
                    <div style={{ fontSize: "0.875rem" }}>
                      <strong style={{ display: "block", color: "var(--muted)", fontSize: "0.78rem" }}>Total Views</strong>
                      {fmt(Number(comp.totalViews || 0))}
                    </div>
                  </div>
                  {comp.description && (
                    <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--muted)", lineHeight: 1.5 }}>
                      {comp.description.slice(0, 120)}{comp.description.length > 120 ? "..." : ""}
                    </p>
                  )}
                  <a
                    href={`https://youtube.com/${comp.customUrl || "channel/" + comp.channelId}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "var(--accent-2)", fontSize: "0.875rem", fontWeight: 700 }}
                  >
                    Visit Channel →
                  </a>
                </div>
              ))}
            </div>

            {/* AI Analysis */}
            {data.aiAnalysis && (
              <CollapsibleSection title="AI Competitive Analysis" eyebrow="Intelligence">
                {data.aiAnalysis.summary && (
                  <p style={{ marginBottom: "24px", color: "var(--text)", lineHeight: 1.7 }}>
                    {data.aiAnalysis.summary}
                  </p>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginBottom: "24px" }}>
                  <div className="insight-block">
                    <h3 style={{ color: "var(--accent-2)" }}>💪 Strengths</h3>
                    <ul className="insight-list">
                      {data.aiAnalysis.strengths?.map((s: string, i: number) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="insight-block">
                    <h3 style={{ color: "var(--accent)" }}>⚠️ Weaknesses</h3>
                    <ul className="insight-list">
                      {data.aiAnalysis.weaknesses?.map((w: string, i: number) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
                  <div className="insight-block">
                    <h3>🚀 Opportunities</h3>
                    <ul className="insight-list">
                      {data.aiAnalysis.opportunities?.map((o: string, i: number) => (
                        <li key={i}>{o}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="insight-block">
                    <h3>✅ Recommendations</h3>
                    <ul className="insight-list">
                      {data.aiAnalysis.recommendations?.map((r: string, i: number) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CollapsibleSection>
            )}
          </div>
        )}
      </section>
    </>
  );
}
