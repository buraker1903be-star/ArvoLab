"use client";

import { ASISTANA_ULASILAMADI_METIN } from "@/lib/asistan-istemci";
import { useCeviri } from "@/app/_components/dil-saglayici";
import { useState } from "react";
import Link from "next/link";
import { Sparkles, AlertTriangle, CreditCard } from "lucide-react";
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
  const t = useCeviri();
  const [feedback, setFeedback] = useState<string | null>(initialFeedback);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [odemeGerekli, setOdemeGerekli] = useState(false);
  const [krediUyarisi, setKrediUyarisi] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await requestAiFeedback(documentId);
      if (res.error) {
        setError(res.error);
        setOdemeGerekli(res.odemeGerekli === true);
      } else if (res.feedback) {
        setFeedback(res.feedback);
        setKrediUyarisi(res.krediUyarisi ?? null);
      }
    } catch (hata) {
      /* İşlemin kendisi düştüyse (süre aşımı, bağlantı) hata ekranına gitmesin. */
      console.error("[geri bildirim] çağrı düştü:", hata);
      setError(t(ASISTANA_ULASILAMADI_METIN));
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
          {loading
            ? t({ tr: "AI geri bildirimi hazırlanıyor...", en: "Preparing AI feedback..." })
            : feedback
              ? t({ tr: "Yeniden geri bildirim al", en: "Get feedback again" })
              : t({ tr: "Asistandan geri bildirim al", en: "Get feedback from the assistant" })}
        </button>
      ) : (
        /* Eskiden düğme görünüyor, her tıklama "Vercel ayarlarına anahtar
           ekleyin" diyen bir hata ve başarısız bir kayıt üretiyordu. */
        <p className="alert" data-tone="info">{t({ tr: "AI geri bildirimi şu an kapalı.", en: "AI feedback is currently turned off." })}</p>
      )}

      {krediUyarisi && (
        <p className="muted text-sm mt-sm" role="status">
          {krediUyarisi}
        </p>
      )}

      {okunamadi && !feedback && (
        <p className="alert mt-sm" data-tone="warning" role="alert">
          {t({
            tr: "Bu belgenin önceki değerlendirmesi okunamadı. Hiç değerlendirilmemiş olduğu anlamına gelmez; yeniden çalıştırmadan önce sayfayı yenileyin.",
            en: "This document's previous review couldn't be loaded. That doesn't mean it was never reviewed; refresh the page before running it again.",
          })}
        </p>
      )}

      {error && (
        <p className="alert mt-sm" data-tone="danger" role="alert">
          {error}
          {/* Deneme hakkı bitti (lib/ai/erisim.ts): kilidi ödeme açar. */}
          {odemeGerekli ? (
            <>
              {" "}
              <Link href="/dashboard/abonelik" className="projects-primary-button button-compact">
                <CreditCard size={14} aria-hidden="true" /> {t({ tr: "Aboneliği başlat", en: "Start subscription" })}
              </Link>
            </>
          ) : null}
        </p>
      )}

      {/*
        Öteki asistan sonuçlarıyla AYNI kart dili (04.11.2026): başlıklı
        kart, maddeler tek tek satır. Eskiden bütün geri bildirim sarı bir
        uyarı kutusunun içindeydi; uyarı rengi içeriği "hata listesi" gibi
        gösteriyordu. Kopyalama uyarısı kaybolmadı, başlığın altında.
      */}
      {feedback && (
        <div className="belge-geri-bildirim">
          <div className="belge-geri-bildirim-bas">
            <span className="yazim-asistan-ikon" aria-hidden="true">
              <Sparkles size={12} />
            </span>
            <b>{t({ tr: "Asistanın geri bildirimi", en: "Assistant feedback" })}</b>
            <small>{t({ tr: `${bullets.length} madde`, en: `${bullets.length} ${bullets.length === 1 ? "point" : "points"}` })}</small>
          </div>
          <p className="belge-geri-bildirim-not">
            <AlertTriangle size={13} aria-hidden="true" />
            {t({
              tr: "Öğreticidir; tezinize ya da makalenize doğrudan kopyalamayın.",
              en: "For guidance only; don't copy it directly into your thesis or article.",
            })}
          </p>
          <ol className="belge-geri-bildirim-liste">
            {bullets.map((b, i) => (
              <li key={i}>{b.replace(/^[-•]\s*/, "")}</li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
