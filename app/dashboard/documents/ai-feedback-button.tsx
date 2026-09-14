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
    <div className="mt-sm">
      <button type="button" className="projects-filter-button" onClick={handleClick} disabled={loading}>
        <Sparkles size={14} aria-hidden="true" />
        {loading ? "AI geri bildirimi hazırlanıyor..." : feedback ? "Yeniden geri bildirim al" : "AI Geri Bildirimi Al (ChatGPT)"}
      </button>

      {error && (
        <p className="alert mt-sm" data-tone="danger" role="alert">{error}</p>
      )}

      {feedback && (
        <div className="callout" data-tone="warning">
          <strong className="dashboard-kicker cluster">
            <AlertTriangle size={13} aria-hidden="true" />
            AI geri bildirimi — öğreticidir, tezinize/makalenize doğrudan kopyalamayın
          </strong>
          <ul className="callout-body result-list">
            {bullets.map((b, i) => (
              <li key={i}>{b.replace(/^[-•]\s*/, "")}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
