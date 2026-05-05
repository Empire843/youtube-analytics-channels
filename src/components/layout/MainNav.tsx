"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

export default function MainNav() {
  const pathname = usePathname();
  const [config, setConfig] = useState<any>(null);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then(setConfig)
      .catch(() => {});
  }, []);

  const isActive = (path: string) => {
    return pathname === path ? "active" : "";
  };

  return (
    <aside className="main-nav panel">
      <div className="main-nav-head">
        <p className="eyebrow">Workspace</p>
        <h2>YouTube Ops</h2>
        <p className="summary-text">Choose a core toolset from the main navigation.</p>
      </div>
      <nav className="main-nav-links">
        <Link href="/channel" className={`main-nav-link ${isActive("/channel")}`}>
          <strong>Channel Analysis</strong>
          <span>Public metrics, estimates, and insights</span>
        </Link>
        <Link href="/video" className={`main-nav-link ${isActive("/video")}`}>
          <strong>Video Tools</strong>
          <span>Transcript, thumbnail, and video utilities</span>
        </Link>
        <Link href="/prompts" className={`main-nav-link ${isActive("/prompts")}`}>
          <strong>Prompt Tools</strong>
          <span>Studio, AI analysis, variables, and library</span>
        </Link>
        <Link href="/owner" className={`main-nav-link ${isActive("/owner")}`}>
          <strong>Owner Analytics</strong>
          <span>Verified revenue and audience analytics</span>
        </Link>
        <Link href="/competitors" className={`main-nav-link ${isActive("/competitors")}`}>
          <strong>Competitors</strong>
          <span>Find similar channels in the same niche</span>
        </Link>
        <Link href="/history" className={`main-nav-link ${isActive("/history")}`}>
          <strong>History</strong>
          <span>Review previously analyzed channels</span>
        </Link>
      </nav>
      {config && (
        <div className="main-nav-foot">
          <div className="config-badges">
            <span className={`config-badge ${config.hasYoutubeApiKey ? "" : "off"}`}>
              {config.hasYoutubeApiKey ? "✓" : "✗"} YouTube
            </span>
            <span className={`config-badge ${config.hasGeminiApiKey ? "" : "off"}`}>
              {config.hasGeminiApiKey ? "✓" : "✗"} Gemini
            </span>
            {config.hasYtDlp !== undefined && (
              <span className={`config-badge ${config.hasYtDlp ? "" : "off"}`}>
                {config.hasYtDlp ? "✓" : "✗"} yt-dlp
              </span>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
