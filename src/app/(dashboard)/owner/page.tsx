"use client";

import { useState, useCallback } from "react";
import StatusToast from "@/components/ui/StatusToast";
import CollapsibleSection from "@/components/ui/CollapsibleSection";
import DataTable from "@/components/ui/DataTable";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function OwnerPage() {
  const [channelId, setChannelId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState({ visible: false, message: "", type: "info" as "info" | "success" | "error" });

  const showToast = useCallback((message: string, type: "info" | "success" | "error" = "info") => {
    setToast({ visible: true, message, type });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setData(null);

    try {
      const res = await fetch("/api/owner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelId,
          accessToken,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        }),
      });
      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Failed to load owner analytics.");
      }

      setData(result);
      showToast("Owner analytics loaded!", "success");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fmt = (n: number) => new Intl.NumberFormat("en-US").format(n);
  const fmtCurrency = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);

  const geoCols = [
    { key: "country", label: "Country" },
    { key: "views", label: "Views", align: "right" as const, render: (v: number) => fmt(Number(v || 0)) },
    { key: "estimatedRevenue", label: "Revenue", align: "right" as const, render: (v: number) => fmtCurrency(Number(v || 0)) },
    { key: "watchTime", label: "Watch Time (min)", align: "right" as const, render: (v: number) => fmt(Math.round(Number(v || 0))) },
  ];

  const demoCols = [
    { key: "ageGroup", label: "Age Group" },
    { key: "gender", label: "Gender" },
    { key: "viewerPercentage", label: "Percentage", align: "right" as const, render: (v: number) => `${Number(v || 0).toFixed(2)}%` },
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
          <p className="eyebrow">Owner Verified Analytics</p>
          <h1>Owner Analytics</h1>
          <p className="hero-text">
            For channel owners or managers with YouTube Analytics API access.
          </p>
        </div>
      </section>

      <section className="workspace-grid" id="workspace-grid">
        <aside className="sidebar" id="workspace-sidebar">
          <section className="panel sticky-panel">
            <div className="panel-head">
              <h2>Connect Channel</h2>
              <p>Enter your Channel ID and an OAuth Access Token.</p>
            </div>
            <form onSubmit={handleSubmit} className="stack">
              <label>
                <span>Channel ID</span>
                <input
                  type="text"
                  placeholder="UC..."
                  value={channelId}
                  onChange={(e) => setChannelId(e.target.value)}
                  required
                />
              </label>
              <label>
                <span>OAuth Access Token</span>
                <textarea
                  rows={4}
                  placeholder="Bearer token from Google OAuth flow"
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  required
                />
              </label>
              <div className="grid-2">
                <label>
                  <span>Start Date</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </label>
                <label>
                  <span>End Date</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </label>
              </div>
              <div className="button-row">
                <button type="submit" disabled={loading}>
                  {loading ? "Loading..." : "Load owner analytics"}
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
              <h2>View Private Metrics</h2>
              <p>
                Provide an OAuth token to load geographic, demographic, and
                actual revenue data.
              </p>
            </section>
          )}

          {loading && (
            <section className="panel" style={{ textAlign: "center", padding: "48px" }}>
              <p style={{ color: "var(--muted)", fontSize: "1.1rem" }}>Loading owner analytics...</p>
            </section>
          )}

          {data && (
            <>
              {/* Summary Stats */}
              <CollapsibleSection title="Period Summary" eyebrow="Overview">
                <section className="stats-grid">
                  <div className="stat-card accent">
                    <p className="stat-label">Revenue</p>
                    <h3>{fmtCurrency(data.monetization?.estimatedRevenue || 0)}</h3>
                    <p className="summary-meta">RPM: ${(data.monetization?.rpm || 0).toFixed(2)}</p>
                  </div>
                  <div className="stat-card">
                    <p className="stat-label">Net Subscribers</p>
                    <h3>{fmt(data.audience?.netSubscribers || 0)}</h3>
                    <p className="summary-meta">+{fmt(data.audience?.gained || 0)} / -{fmt(data.audience?.lost || 0)}</p>
                  </div>
                  <div className="stat-card">
                    <p className="stat-label">Total Views</p>
                    <h3>{fmt(data.timeseries?.reduce((s: number, r: any) => s + Number(r.views || 0), 0) || 0)}</h3>
                  </div>
                  <div className="stat-card">
                    <p className="stat-label">Watch Time (hrs)</p>
                    <h3>{fmt(Math.round((data.timeseries?.reduce((s: number, r: any) => s + Number(r.watchTime || 0), 0) || 0) / 60))}</h3>
                  </div>
                </section>
              </CollapsibleSection>

              {/* Timeline Chart */}
              {data.timeseries && data.timeseries.length > 0 && (
                <CollapsibleSection title="Daily Analytics" eyebrow="Timeline">
                  <div style={{ width: "100%", height: 320 }}>
                    <ResponsiveContainer>
                      <LineChart data={data.timeseries}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                        <XAxis
                          dataKey="day"
                          tick={{ fontSize: 11, fill: "var(--muted)" }}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: "var(--muted)" }}
                          tickLine={false}
                          tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v.toString()}
                        />
                        <Tooltip
                          contentStyle={{
                            background: "var(--card-strong)",
                            border: "1px solid var(--line)",
                            borderRadius: "12px",
                            fontSize: "0.875rem",
                          }}
                        />
                        <Line type="monotone" dataKey="views" stroke="var(--accent)" strokeWidth={2} dot={false} name="Views" />
                        <Line type="monotone" dataKey="estimatedRevenue" stroke="var(--accent-2)" strokeWidth={2} dot={false} name="Revenue ($)" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CollapsibleSection>
              )}

              {/* Demographics & Geography Tables */}
              <section className="data-grid">
                {data.demographics && data.demographics.length > 0 && (
                  <CollapsibleSection title="Demographics" eyebrow="Audience">
                    <DataTable columns={demoCols} rows={data.demographics} />
                  </CollapsibleSection>
                )}
                {data.geography && data.geography.length > 0 && (
                  <CollapsibleSection title="Top Countries" eyebrow="Geography">
                    <DataTable columns={geoCols} rows={data.geography} />
                  </CollapsibleSection>
                )}
              </section>
            </>
          )}
        </main>
      </section>
    </>
  );
}
