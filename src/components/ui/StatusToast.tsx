"use client";

import { useEffect } from "react";

interface StatusToastProps {
  message: string;
  type?: "info" | "success" | "error";
  visible: boolean;
  onClose: () => void;
  duration?: number;
}

export default function StatusToast({
  message,
  type = "info",
  visible,
  onClose,
  duration = 4000,
}: StatusToastProps) {
  useEffect(() => {
    if (!visible || duration <= 0) return;
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [visible, duration, onClose]);

  if (!visible) return null;

  return (
    <div className={`status-toast status-toast--${type}`}>
      <p className="status-toast-message">{message}</p>
      <button
        className="status-toast-close"
        type="button"
        onClick={onClose}
        aria-label="Close"
      >
        ×
      </button>
    </div>
  );
}
