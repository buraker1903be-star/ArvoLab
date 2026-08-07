"use client";

import { useState } from "react";
import { Sparkles, AlertTriangle } from "lucide-react";
import { requestAiFeedback } from "@/app/actions/ai-feedback";

interface AiFeedbackButtonProps {
  documentId: string;
  initialFeedback: string | null;
}

export default function AiFeedbackButton({ documentId, initialFeedback }: AiFeedbackButtonProps) {
  const [feedback, setFeedback] = useState<string | null>(initialFeedback);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await requestAiFeedback(documentId);
      if (res.error) {
        setError(res.error);
      } else if (res.feedback) {
        setFeedback(res.feedback);
      }
    } finally {
      setLoading(false);
    }
  }

  const bullets = feedback
    ? feedback
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
    : [];

  return (
    <div style={{ marginTop: 10 }}>
      <button type="button" className="projects-filter-button" onClick={handleClick} disabled={loading}>
        <Sparkles size={14} />
        {loading ? "AI geri bildirimi hazırlanıyor..." : feedback ? "Yeniden geri bildirim al" : "AI Geri Bildirimi Al (ChatGPT)"}
      </button>

      {error && (
        <p style={{ color: "var(--danger)", fontSize: 12, marginTop: 6 }}>{error}</p>
      )}

      {feedback && (
        <div
          style={{
            marginTop: 10,
            padding: "12px 14px",
            background: "#fffbeb",
            border: "1px dashed #d97706",
            borderRadius: 10,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11,
              fontWeight: 700,
              color: "#92400e",
              marginBottom: 8,
              textTransform: "uppercase",
              letterSpacing: ".03em",
            }}
          >
            <AlertTriangle size={13} />
            AI geri bildirimi — öğreticidir, tezinize/makalenize doğrudan kopyalamayın
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: "#78350f", lineHeight: 1.6 }}>
            {bullets.map((b, i) => (
              <li key={i}>{b.replace(/^[-•]\s*/, "")}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
