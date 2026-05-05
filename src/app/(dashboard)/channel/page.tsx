"use client";

import { useState, useEffect, useCallback } from "react";
import CollapsibleSection from "@/components/ui/CollapsibleSection";
import DataTable from "@/components/ui/DataTable";
import StatusToast from "@/components/ui/StatusToast";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function ChannelPage() {
  const [channelInput, setChannelInput] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // AI Insights
  const [insights, setInsights] = useState<any>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);

  // Toast
  const [toast, setToast] = useState({ visible: false, message: "", type: "info" as "info" | "success" | "error" });
  const showToast = useCallback((message: string, type: "info" | "success" | "error" = "info") => {
    setToast({ visible: true, message, type });
  }, []);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const id = searchParams.get("id");
    if (id) {
      setChannelInput(id);
      loadHistoryData(id);
    }
  }, []);

  const loadHistoryData = async (channelId: string) => {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch(`/api/history?channelId=${encodeURIComponent(channelId)}`);
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to load history.");

      if (result.analyses && result.analyses.length > 0) {
        const latest = result.analyses.sort((a: any, b: any) => new Date(b.analyzedAt).getTime() - new Date(a.analyzedAt).getTime())[0];
        setData(latest);
        if (latest.insights) {
          setInsights(latest.insights);
        }
      } else {
        setError("No analysis history found for this channel.");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setData(null);
    setInsights(null);

    try {
      const params = new URLSearchParams({ channel: channelInput });
      if (apiKey) params.set("apiKey", apiKey);
      const res = await fetch(`/api/public?${params.toString()}`);
      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Failed to analyze channel.");
      }

      setData(result);
      showToast("Channel analyzed successfully!", "success");

      // Auto-trigger AI insights like main branch
      autoLoadInsights(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const autoLoadInsights = async (analysisData: any) => {
    setInsightsLoading(true);
    try {
      const res = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: analysisData.channel,
          publicMetrics: analysisData.publicMetrics,
          estimates: analysisData.estimates,
          historyTimestamp: analysisData._historyTimestamp || analysisData.analyzedAt,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to generate insights.");
      setInsights(result);
      showToast("AI insights generated!", "success");
    } catch (err: any) {
      showToast(`Public metrics loaded, but AI insights are currently unavailable: ${err.message}`, "error");
    } finally {
      setInsightsLoading(false);
    }
  };

  const loadAiInsights = async () => {
    if (!data) return;
    setInsightsLoading(true);
    try {
      const res = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: data.channel,
          publicMetrics: data.publicMetrics,
          estimates: data.estimates,
          historyTimestamp: data._historyTimestamp || data.analyzedAt,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to generate insights.");
      setInsights(result);
      showToast("AI insights generated!", "success");
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setInsightsLoading(false);
    }
  };

  const fmt = (n: number) => new Intl.NumberFormat("en-US").format(n);
  const fmtPct = (n: number) => `${n.toFixed(2)}%`;
  const fmtCurrency = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

  const topVideoCols = [
    { key: "title", label: "Title", render: (v: string, row: any) => (
      <a href={row.url} target="_blank" rel="noreferrer" style={{ fontWeight: 600 }}>{v}</a>
    )},
    { key: "views", label: "Views", align: "right" as const, render: (v: number) => fmt(v) },
    { key: "likes", label: "Likes", align: "right" as const, render: (v: number) => fmt(v) },
    { key: "comments", label: "Comments", align: "right" as const, render: (v: number) => fmt(v) },
  ];

  const recentVideoCols = [
    { key: "title", label: "Title", render: (v: string, row: any) => (
      <a href={row.url} target="_blank" rel="noreferrer" style={{ fontWeight: 600 }}>{v}</a>
    )},
    { key: "views", label: "Views", align: "right" as const, render: (v: number) => fmt(v) },
    { key: "publishedAt", label: "Published", render: (v: string) => v ? new Date(v).toLocaleDateString() : "—" },
    { key: "durationSeconds", label: "Duration", align: "right" as const, render: (v: number) => {
      if (!v) return "—";
      const m = Math.floor(v / 60);
      const s = v % 60;
      return `${m}:${String(s).padStart(2, "0")}`;
    }},
  ];

  return (
    <>
      <StatusToast
        message={toast.message}
        type={toast.type}
        visible={toast.visible}
        onClose={() => setToast((t) => ({ ...t, visible: false }))}
      />

      <section className="hero hero-compact">
        <div className="hero-copy">
          <p className="eyebrow">YouTube Channel Analyzer</p>
          <h1>Channel Analysis</h1>
          <p className="hero-text">
            Public metrics, estimates, and insights for any YouTube channel.
          </p>
        </div>
        {data?.channel && (
          <div className="hero-card">
            <div className="pill-row">
              <span className="pill">{data.publicMetrics?.contentProfile || "—"}</span>
              <span className="pill">Growth: {data.publicMetrics?.growthBand || "—"}</span>
            </div>
            <p className="hero-note">
              Engagement: {fmtPct(data.publicMetrics?.engagementRate || 0)} · Upload every{" "}
              {(data.publicMetrics?.avgDaysBetweenUploads || 0).toFixed(1)} days
            </p>
          </div>
        )}
      </section>

      <section className="workspace-grid" id="workspace-grid">
        <aside className="sidebar" id="workspace-sidebar">
          <section className="panel sticky-panel">
            <div className="panel-head">
              <h2>Analyze Channel</h2>
              <p>Enter a channel link, handle, or channel ID.</p>
            </div>
            <form onSubmit={handleSubmit} className="stack">
              <label>
                <span>Channel</span>
                <input
                  type="text"
                  placeholder="https://www.youtube.com/@GoogleDevelopers"
                  value={channelInput}
                  onChange={(e) => setChannelInput(e.target.value)}
                  required
                />
              </label>
              <label>
                <span>YouTube Data API Key</span>
                <input
                  type="password"
                  placeholder="Leave blank if the server already has a key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
              </label>
              <div className="button-row">
                <button type="submit" disabled={loading}>
                  {loading ? "Analyzing..." : "Analyze now"}
                </button>
              </div>
            </form>
          </section>
        </aside>

        <main className="content-stack" id="workspace-content">
          {error && (
            <section className="status error" style={{ display: "block" }}>
              <p><strong>Error:</strong> {error}</p>
            </section>
          )}

          {!data && !loading && !error && (
            <section className="panel empty-state">
              <p className="eyebrow">Quick Start</p>
              <h2>Choose a workflow</h2>
              <p>
                Enter a channel URL on the left to begin analysis. We will
                extract public metrics and estimate revenue.
              </p>
            </section>
          )}

          {loading && (
            <section className="panel" style={{ textAlign: "center", padding: "48px" }}>
              <p style={{ color: "var(--muted)", fontSize: "1.1rem" }}>Analyzing channel data...</p>
            </section>
          )}

          {data && (
            <>
              {/* Channel Summary */}
              {data.channel && (
                <section className="panel">
                  <div className="summary">
                    <div className="summary-media">
                      {data.channel.thumbnail && (
                        <img
                          src={data.channel.thumbnail}
                          alt={data.channel.title}
                        />
                      )}
                    </div>
                    <div>
                      <h2 style={{ marginBottom: "4px" }}>{data.channel.title}</h2>
                      <p className="summary-meta" style={{ margin: "0 0 8px" }}>
                        {data.channel.customUrl || data.channel.id}
                        {data.channel.country ? ` · ${data.channel.country}` : ""}
                      </p>
                      {data.channel.description && (
                        <p className="summary-text" style={{ margin: 0, maxWidth: "60ch" }}>
                          {data.channel.description.slice(0, 200)}
                          {data.channel.description.length > 200 ? "..." : ""}
                        </p>
                      )}
                    </div>
                  </div>
                </section>
              )}

              {/* Overview Stats */}
              <CollapsibleSection title="Overview snapshot" eyebrow="Overview">
                <section className="stats-grid">
                  <div className="stat-card">
                    <p className="stat-label">Subscribers</p>
                    <h3>{fmt(data.channel?.subscriberCount || 0)}</h3>
                  </div>
                  <div className="stat-card">
                    <p className="stat-label">Total Views</p>
                    <h3>{fmt(data.channel?.totalViews || 0)}</h3>
                  </div>
                  <div className="stat-card">
                    <p className="stat-label">Videos</p>
                    <h3>{fmt(data.channel?.videoCount || 0)}</h3>
                  </div>
                  <div className="stat-card accent">
                    <p className="stat-label">Growth Score</p>
                    <h3>{data.publicMetrics?.growthScore || 0}/100</h3>
                    <p className="summary-meta">{data.publicMetrics?.growthBand || "—"}</p>
                  </div>
                </section>
              </CollapsibleSection>

              {/* Public Metrics */}
              <CollapsibleSection title="Performance Metrics" eyebrow="Metrics">
                <section className="stats-grid">
                  <div className="stat-card">
                    <p className="stat-label">Avg Views/Video</p>
                    <h3>{fmt(Math.round(data.publicMetrics?.recentAvgViews || 0))}</h3>
                  </div>
                  <div className="stat-card">
                    <p className="stat-label">Median Views</p>
                    <h3>{fmt(Math.round(data.publicMetrics?.recentMedianViews || 0))}</h3>
                  </div>
                  <div className="stat-card">
                    <p className="stat-label">Engagement Rate</p>
                    <h3>{fmtPct(data.publicMetrics?.engagementRate || 0)}</h3>
                  </div>
                  <div className="stat-card">
                    <p className="stat-label">Upload Cadence</p>
                    <h3>{(data.publicMetrics?.avgDaysBetweenUploads || 0).toFixed(1)} days</h3>
                  </div>
                </section>
              </CollapsibleSection>

              {/* Revenue Estimates */}
              {data.estimates && (
                <CollapsibleSection title="Revenue & Estimates" eyebrow="Estimates">
                  <section className="stats-grid">
                    <div className="stat-card accent">
                      <p className="stat-label">Est. Monthly Revenue</p>
                      <h3>{fmtCurrency(data.estimates?.monthlyRevenue || 0)}</h3>
                      <p className="summary-meta">RPM: ${(data.estimates?.rpm || 0).toFixed(2)}</p>
                    </div>
                    <div className="stat-card">
                      <p className="stat-label">Est. Monthly Views</p>
                      <h3>{fmt(Math.round(data.estimates?.monthlyViews || 0))}</h3>
                    </div>
                    <div className="stat-card">
                      <p className="stat-label">Videos/Month</p>
                      <h3>{(data.estimates?.videosPerMonth || 0).toFixed(1)}</h3>
                    </div>
                    <div className="stat-card">
                      <p className="stat-label">Content Profile</p>
                      <h3>{data.publicMetrics?.contentProfile || "—"}</h3>
                    </div>
                  </section>
                </CollapsibleSection>
              )}

              {/* Views Chart */}
              {data.chartFallback && data.chartFallback.length > 0 && (
                <CollapsibleSection title="Recent Views Trend" eyebrow="Chart">
                  <div style={{ width: "100%", height: 320 }}>
                    <ResponsiveContainer>
                      <LineChart data={data.chartFallback}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 12, fill: "var(--muted)" }}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 12, fill: "var(--muted)" }}
                          tickLine={false}
                          tickFormatter={(v) =>
                            v >= 1000000
                              ? `${(v / 1000000).toFixed(1)}M`
                              : v >= 1000
                              ? `${(v / 1000).toFixed(0)}K`
                              : v.toString()
                          }
                        />
                        <Tooltip
                          contentStyle={{
                            background: "var(--card-strong)",
                            border: "1px solid var(--line)",
                            borderRadius: "12px",
                            fontSize: "0.875rem",
                          }}
                          formatter={(value: any) => [fmt(value), "Views"]}
                          labelFormatter={(label) => `Date: ${label}`}
                        />
                        <Line
                          type="monotone"
                          dataKey="views"
                          stroke="var(--accent)"
                          strokeWidth={2.5}
                          dot={{ r: 4, fill: "var(--accent)" }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CollapsibleSection>
              )}

              {/* Data Tables */}
              {(data.topRecentVideos || data.recentVideos) && (
                <section className="data-grid">
                  {data.topRecentVideos && data.topRecentVideos.length > 0 && (
                    <CollapsibleSection title="Top Performing Videos" eyebrow="Rankings">
                      <DataTable columns={topVideoCols} rows={data.topRecentVideos} />
                    </CollapsibleSection>
                  )}
                  {data.recentVideos && data.recentVideos.length > 0 && (
                    <CollapsibleSection title="Recent Uploads" eyebrow="Timeline">
                      <DataTable columns={recentVideoCols} rows={data.recentVideos.slice(0, 10)} />
                    </CollapsibleSection>
                  )}
                </section>
              )}

              {/* AI Insights */}
              <CollapsibleSection
                title="AI Insights"
                eyebrow="Intelligence"
                actions={
                  !insights ? (
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={loadAiInsights}
                      disabled={insightsLoading}
                    >
                      {insightsLoading ? "Generating..." : "Generate Insights"}
                    </button>
                  ) : null
                }
              >
                {!insights && !insightsLoading && (
                  <p className="empty">
                    Click &quot;Generate Insights&quot; to get AI-powered analysis of this channel.
                  </p>
                )}
                {insightsLoading && (
                  <p style={{ color: "var(--muted)", textAlign: "center", padding: "24px" }}>
                    Generating AI insights...
                  </p>
                )}
                {insights && (
                  <div className="insight-grid">
                    {/* Summary + model info */}
                    <section className="insight-block">
                      <p className="eyebrow">AI Summary</p>
                      <p className="insight-summary">
                        {insights.insights?.summary || insights.summary || "No summary returned."}
                      </p>
                      <p className="summary-note">
                        Model: {insights.model || "—"} | Generated:{" "}
                        {insights.generatedAt
                          ? new Date(insights.generatedAt).toLocaleString()
                          : "—"}
                      </p>
                    </section>

                    {/* Monetization View */}
                    {(insights.insights?.monetizationView || insights.monetizationView) && (
                      <section className="insight-block">
                        <h3>💰 Monetization View</h3>
                        <p>{insights.insights?.monetizationView || insights.monetizationView}</p>
                      </section>
                    )}

                    {/* Content Strategy */}
                    {(insights.insights?.contentStrategy || insights.contentStrategy) && (
                      <section className="insight-block">
                        <h3>🎯 Content Strategy</h3>
                        <p>{insights.insights?.contentStrategy || insights.contentStrategy}</p>
                      </section>
                    )}

                    {/* Strengths */}
                    {(insights.insights?.strengths || insights.strengths)?.length > 0 && (
                      <div className="insight-block">
                        <h3>💪 Strengths</h3>
                        <ul className="insight-list">
                          {(insights.insights?.strengths || insights.strengths).map((s: string, i: number) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Risks (main uses 'risks', not 'weaknesses') */}
                    {(insights.insights?.risks || insights.risks)?.length > 0 && (
                      <div className="insight-block">
                        <h3>⚠️ Risks</h3>
                        <ul className="insight-list">
                          {(insights.insights?.risks || insights.risks).map((r: string, i: number) => (
                            <li key={i}>{r}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Opportunities */}
                    {(insights.insights?.opportunities || insights.opportunities)?.length > 0 && (
                      <div className="insight-block">
                        <h3>🚀 Opportunities</h3>
                        <ul className="insight-list">
                          {(insights.insights?.opportunities || insights.opportunities).map((o: string, i: number) => (
                            <li key={i}>{o}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Next Actions (main uses 'nextActions', not 'actions') */}
                    {(insights.insights?.nextActions || insights.nextActions)?.length > 0 && (
                      <div className="insight-block">
                        <h3>✅ Next Actions</h3>
                        <ul className="insight-list">
                          {(insights.insights?.nextActions || insights.nextActions).map((a: string, i: number) => (
                            <li key={i}>{a}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </CollapsibleSection>

              {/* Notes */}
              {data.notes && data.notes.length > 0 && (
                <section className="panel" style={{ opacity: 0.8 }}>
                  <p className="eyebrow">Notes</p>
                  <ul style={{ margin: 0, paddingLeft: "18px", color: "var(--muted)", lineHeight: 1.8 }}>
                    {data.notes.map((n: string, i: number) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </main>
      </section>
    </>
  );
}
