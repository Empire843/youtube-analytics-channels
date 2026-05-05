"use client";

import { useState, useCallback } from "react";
import StatusToast from "@/components/ui/StatusToast";
import CollapsibleSection from "@/components/ui/CollapsibleSection";

export default function VideoPage() {
  const [videoInput, setVideoInput] = useState("");
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
      const res = await fetch(`/api/video?video=${encodeURIComponent(videoInput)}`);
      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Failed to fetch video data.");
      }

      setData(result);
      showToast("Video loaded successfully!", "success");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (mode: string) => {
    if (!videoInput) return;
    const url = `/api/video-download?video=${encodeURIComponent(videoInput)}&mode=${mode}`;

    if (mode === "video") {
      // For video: fetch via JS to catch errors and show toast instead of error page
      showToast("Preparing video download. Large videos may take a while...", "info");
      try {
        const res = await fetch(url);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({ error: "Video download failed." }));
          showToast(errData.error || "Video download failed.", "error");
          return;
        }
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = data?.title ? `${data.title}.mp4` : "video.mp4";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
        showToast("Video download started!", "success");
      } catch (err: any) {
        showToast(err.message || "Video download failed.", "error");
      }
      return;
    }

    // For transcript/thumbnail: use hidden anchor (small files, Content-Disposition works)
    const a = document.createElement("a");
    a.href = url;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const fmt = (n: number) => new Intl.NumberFormat("en-US").format(n);

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
          <p className="eyebrow">Video Utilities</p>
          <h1>Video Tools</h1>
          <p className="hero-text">
            Extract transcripts, download thumbnails, or get direct video links.
          </p>
        </div>
      </section>

      <section className="workspace-grid" id="workspace-grid">
        <aside className="sidebar" id="workspace-sidebar">
          <section className="panel sticky-panel">
            <div className="panel-head">
              <h2>Video Tools</h2>
              <p>Paste a YouTube video link to inspect and download assets.</p>
            </div>
            <form onSubmit={handleSubmit} className="stack">
              <label>
                <span>Video</span>
                <input
                  type="text"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={videoInput}
                  onChange={(e) => setVideoInput(e.target.value)}
                  required
                />
              </label>
              <div className="button-row">
                <button type="submit" disabled={loading}>
                  {loading ? "Loading..." : "Load video tools"}
                </button>
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => {
                    setVideoInput("");
                    setData(null);
                    setError(null);
                  }}
                >
                  Clear
                </button>
              </div>
            </form>

            {data && (
              <div className="video-actions">
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => handleDownload("transcript")}
                  disabled={!data.transcriptAvailable}
                >
                  📄 Transcript
                </button>
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => handleDownload("thumbnail")}
                  disabled={!data.thumbnailDownloadAvailable}
                >
                  🖼️ Thumbnail
                </button>
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => handleDownload("video")}
                  disabled={!data.videoDownloadAvailable}
                >
                  🎬 Video
                </button>
              </div>
            )}
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
              <h2>Extract Video Assets</h2>
              <p>
                Enter a YouTube video URL to retrieve its thumbnail, download its
                transcript (if available), or save the video locally.
              </p>
            </section>
          )}

          {loading && (
            <section className="panel" style={{ textAlign: "center", padding: "48px" }}>
              <p style={{ color: "var(--muted)", fontSize: "1.1rem" }}>Loading video data...</p>
            </section>
          )}

          {data && (
            <>
              {/* Video Summary */}
              <CollapsibleSection title="Video summary" eyebrow="Video Tools">
                <div className="video-summary">
                  <img
                    src={data.thumbnail}
                    alt={data.title}
                    className="video-thumbnail"
                  />
                  <div>
                    <h3 style={{ fontSize: "1.25rem", margin: "0 0 12px 0", color: "var(--text)" }}>
                      {data.title}
                    </h3>
                    <p style={{ margin: "0 0 8px 0", color: "var(--muted)" }}>
                      <strong>Channel:</strong> {data.channel}
                    </p>
                    <div className="video-meta-grid">
                      <div className="video-meta-card">
                        <strong>Duration</strong>
                        <p>{data.durationHuman || data.durationString || "—"}</p>
                      </div>
                      <div className="video-meta-card">
                        <strong>Views</strong>
                        <p>{fmt(Number(data.viewCount || 0))}</p>
                      </div>
                      <div className="video-meta-card">
                        <strong>Likes</strong>
                        <p>{fmt(Number(data.likeCount || 0))}</p>
                      </div>
                      <div className="video-meta-card">
                        <strong>Uploaded</strong>
                        <p>{data.uploadDate || "—"}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CollapsibleSection>

              {/* Availability Badges */}
              <section className="panel">
                <p className="eyebrow">Asset Availability</p>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "8px" }}>
                  <span className={`config-badge ${data.transcriptAvailable ? "" : "off"}`}>
                    📄 Transcript {data.transcriptAvailable ? "✓" : "✗"}
                  </span>
                  <span className={`config-badge ${data.thumbnailDownloadAvailable ? "" : "off"}`}>
                    🖼️ Thumbnail {data.thumbnailDownloadAvailable ? "✓" : "✗"}
                  </span>
                  <span className={`config-badge ${data.videoDownloadAvailable ? "" : "off"}`}>
                    🎬 Video {data.videoDownloadAvailable ? "✓" : "✗"}
                  </span>
                </div>
              </section>

              {/* Description */}
              {data.description && (
                <CollapsibleSection title="Description" eyebrow="Details" defaultOpen={false}>
                  <p className="video-description">
                    {data.description}
                  </p>
                </CollapsibleSection>
              )}
            </>
          )}
        </main>
      </section>
    </>
  );
}
