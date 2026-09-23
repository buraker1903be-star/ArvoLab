"use client";

import { useState } from "react";
import { Sparkles, AlertTriangle } from "lucide-react";
import { requestAiFeedback } from "@/app/actions/ai-feedback";

interface AiFeedbackButtonProps {
  documentId: string;
  initialFeedback: string | null;
  /** Yapay zeka sunucusu tanımlı değilse düğme yerine açıklama gösterilir. */
  configured: boolean;
  /**
   * Önceki değerlendirme OKUNAMADI. "Hiç değerlendirilmemiş" ile aynı
   * gösterilirse kullanıcı asistanı boşuna yeniden çalıştırır — ve her
   * çalıştırma gerçek bir istek demek.
   */
  okunamadi?: boolean;
}

export default function AiFeedbackButton({ documentId, initialFeedback, configured, okunamadi = false }: AiFeedbackButtonProps) {
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
      {configured ? (
        <button type="button" className="projects-filter-button" onClick={handleClick} disabled={loading}>
          <Sparkles size={14} aria-hidden="true" />
          {/* Sağlayıcının adı arayüzde GEÇMEZ (AGENTS.md). "ChatGPT" yazıyordu
              ve istekler Claude'a gittiği halde kullanıcı ChatGPT kullanıldığını
              sanıyordu — üstelik model değiştiğinde burası da yalan söylemeye
              başlıyordu. Kullanıcı "ArvoLab Asistanı" görür. */}
          {loading ? "AI geri bildirimi hazırlanıyor..." : feedback ? "Yeniden geri bildirim al" : "Asistandan geri bildirim al"}
        </button>
      ) : (
        /* Eskiden düğme görünüyor, her tıklama "Vercel ayarlarına anahtar
           ekleyin" diyen bir hata ve başarısız bir kayıt üretiyordu. */
        <p className="alert" data-tone="info">AI geri bildirimi şu an kapalı.</p>
      )}

      {okunamadi && !feedback && (
        <p className="alert mt-sm" data-tone="warning" role="alert">
          Bu belgenin önceki değerlendirmesi okunamadı. Hiç değerlendirilmemiş
          olduğu anlamına gelmez; yeniden çalıştırmadan önce sayfayı yenileyin.
        </p>
      )}

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
