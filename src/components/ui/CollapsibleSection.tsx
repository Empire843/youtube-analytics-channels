"use client";

import { useState } from "react";

interface CollapsibleSectionProps {
  title: string;
  eyebrow?: string;
  defaultOpen?: boolean;
  actions?: React.ReactNode;
  children: React.ReactNode;
  id?: string;
}

export default function CollapsibleSection({
  title,
  eyebrow,
  defaultOpen = true,
  actions,
  children,
  id,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="panel" id={id}>
      <div className="section-header">
        <div>
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h2>{title}</h2>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {actions}
          <button
            className="section-toggle"
            type="button"
            onClick={() => setOpen((v) => !v)}
          >
            <span className="toggle-text">{open ? "Collapse" : "Expand"}</span>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                transform: open ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 200ms ease",
              }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
      </div>
      {open && <div className="collapsible">{children}</div>}
    </section>
  );
}
