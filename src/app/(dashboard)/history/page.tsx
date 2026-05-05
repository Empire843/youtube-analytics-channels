"use client";

import { useState, useEffect, useCallback } from "react";
import StatusToast from "@/components/ui/StatusToast";
import ConfirmModal from "@/components/ui/ConfirmModal";

export default function HistoryPage() {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedChannel, setExpandedChannel] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

  // Confirm modal
  const [confirmModal, setConfirmModal] = useState({
    open: false,
    title: "",
    message: "",
    channelId: "",
    timestamp: "",
    action: "" as "channel" | "entry",
  });

  // Toast
  const [toast, setToast] = useState({ visible: false, message: "", type: "info" as "info" | "success" | "error" });
  const showToast = useCallback((message: string, type: "info" | "success" | "error" = "info") => {
    setToast({ visible: true, message, type });
  }, []);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/history");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load history.");
      setHistory(data.channels || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const loadTimeline = async (channelId: string) => {
    if (expandedChannel === channelId) {
      setExpandedChannel(null);
      setTimeline([]);
      return;
    }
    setExpandedChannel(channelId);
    setTimelineLoading(true);
    try {
      const res = await fetch(`/api/history?channelId=${encodeURIComponent(channelId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load timeline.");
      setTimeline(
        (data.analyses || []).sort(
          (a: any, b: any) => new Date(b.analyzedAt).getTime() - new Date(a.analyzedAt).getTime()
        )
      );
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setTimelineLoading(false);
    }
  };

  const handleDeleteChannel = async (channelId: string) => {
    try {
      const res = await fetch("/api/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", channelId }),
      });
      if (!res.ok) throw new Error("Failed to delete.");
      setExpandedChannel(null);
      setTimeline([]);
      fetchHistory();
      showToast("Channel history deleted.", "success");
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleDeleteEntry = async (channelId: string, timestamp: string) => {
    try {
      const res = await fetch("/api/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "deleteEntry", channelId, timestamp }),
      });
      if (!res.ok) throw new Error("Failed to delete entry.");
      // Reload timeline
      loadTimeline(channelId);
      fetchHistory();
      showToast("Analysis entry deleted.", "success");
    } catch (err: any) {
      showToast(err.message, "error");
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
      <ConfirmModal
        open={confirmModal.open}
        title={confirmModal.title}
        message={confirmModal.message}
        danger
        confirmLabel="Delete"
        onConfirm={() => {
          if (confirmModal.action === "channel") {
            handleDeleteChannel(confirmModal.channelId);
          } else {
            handleDeleteEntry(confirmModal.channelId, confirmModal.timestamp);
          }
          setConfirmModal((m) => ({ ...m, open: false }));
        }}
        onCancel={() => setConfirmModal((m) => ({ ...m, open: false }))}
      />

      <section className="panel history-workspace">
        <div className="history-hero">
          <div>
            <p className="eyebrow">Analysis History</p>
            <h2>Analyzed Channels</h2>
            <p className="summary-text">
              Review previous analysis results. Click a channel to see all analysis records.
            </p>
          </div>
          <div className="history-toolbar">
            <button className="ghost-button" type="button" onClick={fetchHistory} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {error && (
          <div className="status error" style={{ marginBottom: "24px" }}>
            <p><strong>Error:</strong> {error}</p>
          </div>
        )}

        <div className="history-channel-list">
          {history.length === 0 && !loading ? (
            <p className="empty">No analysis history found.</p>
          ) : (
            history.map((ch) => (
              <div key={ch.channelId}>
                <article
                  className="history-channel-card"
                  style={{ cursor: "pointer" }}
                  onClick={() => loadTimeline(ch.channelId)}
                >
                  <div className="history-channel-thumb">
                    {ch.channelThumbnail ? (
                      <img src={ch.channelThumbnail} alt={ch.channelTitle || ch.channelId} loading="lazy" />
                    ) : (
                      <span className="history-channel-avatar">
                        {(ch.channelTitle || ch.channelId || "?")[0]}
                      </span>
                    )}
                  </div>
                  <div className="history-channel-info">
                    <h4 className="history-channel-name">
                      {ch.channelTitle || ch.channelId}
                    </h4>
                    <p className="history-channel-meta">
                      {ch.customUrl ? `@${ch.customUrl}` : ch.channelId}
                      {ch.country ? ` · ${ch.country}` : ""}
                    </p>
                    <div className="history-channel-stats">
                      <span>{new Intl.NumberFormat().format(ch.subscriberCount || 0)} subscribers</span>
                      <span>{new Intl.NumberFormat().format(ch.totalViews || 0)} views</span>
                    </div>
                    <div className="history-channel-foot">
                      <span className="history-badge">{ch.historyCount} analyses</span>
                      <span className="history-date">
                        Latest: {new Date(ch.latestAnalysis).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="history-timeline-actions" style={{ display: "flex", gap: "6px", flexShrink: 0, alignSelf: "flex-start", marginTop: "4px" }}>
                    <a
                      href={`/channel?id=${ch.channelId}`}
                      className="ghost-button"
                      style={{ textDecoration: "none", fontSize: "0.82rem", padding: "6px 10px" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      Analyze
                    </a>
                    <button
                      className="ghost-button"
                      type="button"
                      style={{ fontSize: "0.82rem", padding: "6px 10px" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        loadTimeline(ch.channelId);
                      }}
                    >
                      {expandedChannel === ch.channelId ? "▲" : "▼"}
                    </button>
                    <button
                      className="ghost-button history-delete-btn"
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmModal({
                          open: true,
                          title: "Delete Channel History",
                          message: `Delete all analysis history for "${ch.channelTitle || ch.channelId}"?`,
                          channelId: ch.channelId,
                          timestamp: "",
                          action: "channel",
                        });
                      }}
                      style={{ color: "var(--accent)", fontSize: "0.82rem", padding: "6px 10px" }}
                    >
                      ×
                    </button>
                  </div>
                </article>

                {/* Expandable Timeline */}
                {expandedChannel === ch.channelId && (
                  <div className="history-timeline" style={{
                    padding: "16px 24px 24px",
                    marginTop: "-8px",
                    marginBottom: "16px",
                    background: "rgba(255,255,255,0.5)",
                    borderRadius: "0 0 var(--radius) var(--radius)",
                    border: "1px solid var(--line)",
                    borderTop: "none",
                  }}>
                    {timelineLoading ? (
                      <p style={{ color: "var(--muted)", textAlign: "center", padding: "16px" }}>
                        Loading timeline...
                      </p>
                    ) : timeline.length === 0 ? (
                      <p className="empty">No analysis records found.</p>
                    ) : (
                      <div style={{ display: "grid", gap: "10px" }}>
                        {timeline.map((entry, i) => (
                          <div
                            key={i}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              padding: "14px 16px",
                              borderRadius: "14px",
                              background: "rgba(255,255,255,0.72)",
                              border: "1px solid var(--line)",
                            }}
                          >
                            <div>
                              <p style={{ margin: "0 0 4px", fontWeight: 700, fontSize: "0.92rem" }}>
                                {new Date(entry.analyzedAt).toLocaleString()}
                              </p>
                              <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--muted)" }}>
                                {entry.channel?.subscriberCount
                                  ? `${new Intl.NumberFormat().format(entry.channel.subscriberCount)} subs`
                                  : ""}
                                {entry.insights ? " · AI insights available" : ""}
                              </p>
                            </div>
                            <div style={{ display: "flex", gap: "6px" }}>
                              <a
                                href={`/channel?id=${ch.channelId}`}
                                className="ghost-button"
                                style={{ textDecoration: "none", fontSize: "0.82rem", padding: "6px 10px" }}
                              >
                                View
                              </a>
                              <button
                                className="ghost-button"
                                type="button"
                                onClick={() =>
                                  setConfirmModal({
                                    open: true,
                                    title: "Delete Entry",
                                    message: `Delete analysis from ${new Date(entry.analyzedAt).toLocaleString()}?`,
                                    channelId: ch.channelId,
                                    timestamp: entry.analyzedAt,
                                    action: "entry",
                                  })
                                }
                                style={{ color: "var(--accent)", fontSize: "0.82rem", padding: "6px 10px" }}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </section>
    </>
  );
}
