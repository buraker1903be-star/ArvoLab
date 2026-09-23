"use client";

import { useEffect, useRef, useState } from "react";
import { Check, MessageSquare } from "lucide-react";
import { showToast } from "@/app/dashboard/_components/toast-events";
import BosDurum from "@/app/dashboard/_components/bos-durum";
import {
  addManuscriptComment,
  deleteManuscriptComment,
  listManuscriptComments,
  setManuscriptCommentResolved,
  type ManuscriptComment,
} from "@/app/actions/manuscript-comments";

interface ManuscriptCommentsProps {
  projectId: string;
  /** Yorum yazılırken editörde seçili metin (alıntı olarak bağlanır) */
  getQuote: () => string;
  /** Alıntıya tıklayınca metinde o yeri bul */
  onFind: (quote: string) => void;
}

/** "Ayşe Yılmaz" → "AY"; yorumun kime ait olduğu listede bir bakışta görünsün. */
const basHarfler = (ad: string) =>
  ad.trim().split(/\s+/).slice(0, 2).map((parca) => parca[0]?.toLocaleUpperCase("tr-TR") ?? "").join("") || "?";

const formatTime = (value: string) => new Date(value).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" });

// Danışman/uzman ile müşteri arasında metne bağlı notlar.
export default function ManuscriptComments({ projectId, getQuote, onFind }: ManuscriptCommentsProps) {
  const [comments, setComments] = useState<ManuscriptComment[] | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  /*
    Okuma hatası ayrı tutulur. Eskiden result.error hiç okunmuyordu:
    yorumlar yüklenemediğinde "Henüz yorum yok." yazıyordu ve danışmanın
    düzeltme notları sessizce kaybolmuş gibi görünüyordu — kullanıcı
    düzeltmeleri yapmadan teslim edebilirdi.
  */
  const [yuklemeHatasi, setYuklemeHatasi] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await listManuscriptComments(projectId);
      if (cancelled) return;
      setYuklemeHatasi(result.error ?? null);
      setComments(result.comments);
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, reloadKey]);

  // Karşı tarafın yeni yorumları sayfa açıkken de gelsin: sekme görünürken dakikada bir yenilenir.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") setReloadKey((key) => key + 1);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  /*
    Sekme açıkken dakikada bir yenileniyor; karşı taraf yorum yazınca liste
    sessizce değişiyor ve yeni notun geldiği fark edilmiyordu. İlk yüklemeden
    sonra gelen yorumlar kısa süre vurgulanır.
  */
  const bilinenler = useRef<Set<string> | null>(null);
  const [yeniler, setYeniler] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!comments) return;
    const simdiki = new Set(comments.map((comment) => comment.id));
    if (bilinenler.current === null) {
      bilinenler.current = simdiki;
      return;
    }
    const gelenler = comments.filter((comment) => !bilinenler.current!.has(comment.id)).map((comment) => comment.id);
    bilinenler.current = simdiki;
    if (gelenler.length === 0) return;
    const t = window.setTimeout(() => setYeniler(new Set(gelenler)), 0);
    const temizlik = window.setTimeout(() => setYeniler(new Set()), 6000);
    return () => {
      clearTimeout(t);
      clearTimeout(temizlik);
    };
  }, [comments]);

  const refresh = () => setReloadKey((key) => key + 1);
  const open = (comments ?? []).filter((comment) => !comment.resolvedAt);
  const visible = showResolved ? comments ?? [] : open;
  const resolvedCount = (comments?.length ?? 0) - open.length;

  const submit = async () => {
    const text = body.trim();
    if (!text) return;
    setBusy(true);
    try {
      const result = await addManuscriptComment(projectId, text, getQuote() || null);
      if (result.error) {
        showToast("error", result.error);
        return;
      }
      setBody("");
      showToast("success", "Yorum eklendi.");
      refresh();
    } finally {
      setBusy(false);
    }
  };

  /*
    İşlem sırasında düğmeler kilitlenir: "Çözüldü" ve "Sil" yan yana
    duruyor, arka arkaya tıklama kolay. Başarıda da bildirim verilir;
    eskiden yalnızca hata duyuruluyordu, başarılı silme sessizdi.
  */
  const run = async (action: () => Promise<{ error?: string }>, basariMetni: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await action();
      if (result.error) showToast("error", result.error);
      else {
        showToast("success", basariMetni);
        refresh();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="outline-card">
      <header className="outline-head">
        <strong>
          <MessageSquare size={15} aria-hidden="true" /> Yorumlar
        </strong>
        <span className="muted text-sm">{comments === null ? "…" : `${open.length} açık`}</span>
      </header>

      <form
        className="comment-form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <textarea
          className="outline-textarea"
          rows={2}
          maxLength={2000}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Not ya da soru yazın; metinde seçili bir yer varsa ona bağlanır."
          aria-label="Yorum"
        />
        <button type="submit" className="projects-filter-button outline-action" disabled={busy || !body.trim()}>
          Yorum ekle
        </button>
      </form>

      {visible.length > 0 ? (
        <ul className="comment-list">
          {visible.map((comment) => (
            <li
              key={comment.id}
              className="comment-item"
              data-resolved={comment.resolvedAt ? "true" : "false"}
              data-mine={comment.isMine ? "true" : undefined}
              data-new={yeniler.has(comment.id) ? "true" : undefined}
            >
              <div className="comment-meta">
                <span className="comment-author">
                  <span className="comment-avatar" aria-hidden="true">{basHarfler(comment.isMine ? "Siz" : comment.authorName ?? "Ekip üyesi")}</span>
                  {comment.isMine ? "Siz" : comment.authorName ?? "Ekip üyesi"}
                  {comment.resolvedAt ? (
                    <span className="comment-resolved" title="Çözüldü"><Check size={12} aria-hidden="true" />Çözüldü</span>
                  ) : null}
                </span>
                <span>{formatTime(comment.createdAt)}</span>
              </div>
              {comment.quote ? (
                <button type="button" className="comment-quote" onClick={() => onFind(comment.quote!)} title="Metinde göster">
                  “{comment.quote}”
                </button>
              ) : null}
              <p>{comment.body}</p>
              <div className="comment-actions">
                <button
                  type="button"
                  className="result-link"
                  disabled={busy}
                  onClick={() =>
                    void run(
                      () => setManuscriptCommentResolved(comment.id, !comment.resolvedAt),
                      comment.resolvedAt ? "Yorum yeniden açıldı." : "Yorum çözüldü olarak işaretlendi.",
                    )
                  }
                >
                  {comment.resolvedAt ? "Yeniden aç" : "Çözüldü"}
                </button>
                {comment.isMine ? (
                  <button
                    type="button"
                    className="result-link"
                    disabled={busy}
                    onClick={() => {
                      /* Onay yoktu: yorum "Çözüldü" ile yan yana, düz bağlantı
                         görünümünde duruyor ve tek yanlış tıklamayla geri
                         alınamaz biçimde siliniyordu. */
                      if (!window.confirm("Bu yorumu silmek istediğinize emin misiniz? Yorum kalıcı olarak silinir, geri alınamaz.")) return;
                      void run(() => deleteManuscriptComment(comment.id), "Yorum silindi.");
                    }}
                  >
                    Sil
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : yuklemeHatasi ? (
        <p className="alert" data-tone="danger" role="alert">
          {yuklemeHatasi} Yorumlarınız yerinde duruyor; sayfayı yenileyin.
        </p>
      ) : comments !== null ? (
        <BosDurum
          kompakt
          ikon={MessageSquare}
          aciklama={
            open.length === 0 && resolvedCount > 0
              ? "Açık yorum kalmadı. Çözülenleri aşağıdan yeniden görebilirsiniz."
              : "Henüz yorum yok. Metinde bir yeri seçip yorum bırakırsanız, danışmanınız tam o cümleyi görür."
          }
        />
      ) : (
        /* Yükleniyor: eskiden hiçbir şey çizilmiyordu, bölüm boş görünüyordu. */
        <p className="muted text-sm" aria-busy="true">Yorumlar yükleniyor…</p>
      )}

      {resolvedCount > 0 ? (
        <button type="button" className="result-link" onClick={() => setShowResolved((value) => !value)}>
          {showResolved ? "Çözülenleri gizle" : `Çözülenleri göster (${resolvedCount})`}
        </button>
      ) : null}
    </section>
  );
}
