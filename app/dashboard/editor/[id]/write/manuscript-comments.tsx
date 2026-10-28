"use client";

import { useEffect, useRef, useState } from "react";
import { Check, MessageSquare } from "lucide-react";
import { showToast } from "@/app/dashboard/_components/toast-events";
import BosDurum from "@/app/dashboard/_components/bos-durum";
import Dialog from "@/app/dashboard/_components/dialog";
import YanKutu from "./yan-kutu";
import {
  addManuscriptComment,
  deleteManuscriptComment,
  listManuscriptComments,
  setManuscriptCommentResolved,
  type ManuscriptComment,
} from "@/app/actions/manuscript-comments";
import { useCeviri, useDil, useTarihler } from "@/app/_components/dil-saglayici";
import { YEREL } from "@/lib/dil";

interface ManuscriptCommentsProps {
  projectId: string;
  /** Yorum yazılırken editörde seçili metin (alıntı olarak bağlanır) */
  getQuote: () => string;
  /** Alıntıya tıklayınca metinde o yeri bul */
  onFind: (quote: string) => void;
}

/** "Ayşe Yılmaz" → "AY"; yorumun kime ait olduğu listede bir bakışta görünsün. */
const basHarfler = (ad: string, yerel: string) =>
  ad.trim().split(/\s+/).slice(0, 2).map((parca) => parca[0]?.toLocaleUpperCase(yerel) ?? "").join("") || "?";

// Danışman/uzman ile müşteri arasında metne bağlı notlar.
export default function ManuscriptComments({ projectId, getQuote, onFind }: ManuscriptCommentsProps) {
  const t = useCeviri();
  const dil = useDil();
  /* Eskiden toLocaleString("tr-TR") dilimsizdi: tarayıcının saatiyle yazıyordu. Ortak biçim Türkiye/kullanıcı dilimine sabit. */
  const { tarihSaat: formatTime } = useTarihler();
  const [comments, setComments] = useState<ManuscriptComment[] | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const [acik, setAcik] = useState(false);
  /*
    Okuma hatası ayrı tutulur. Eskiden result.error hiç okunmuyordu:
    yorumlar yüklenemediğinde "Henüz yorum yok." yazıyordu ve danışmanın
    düzeltme notları sessizce kaybolmuş gibi görünüyordu — kullanıcı
    düzeltmeleri yapmadan teslim edebilirdi.
  */
  /* true: hata metni sunucudan gelmedi (ağ hatası); ortak metin çizimde seçiliyor. */
  const [yuklemeHatasi, setYuklemeHatasi] = useState<string | true | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      /* Ağ hatasında sunucu eylemi fırlatıyor; yakalanmazsa kutu sonsuza
         dek "yükleniyor" diyordu. */
      try {
        const result = await listManuscriptComments(projectId);
        if (cancelled) return;
        setYuklemeHatasi(result.error ?? null);
        setComments(result.comments);
      } catch {
        if (!cancelled) setYuklemeHatasi(true);
      }
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
    const zamanlayici = window.setTimeout(() => setYeniler(new Set(gelenler)), 0);
    const temizlik = window.setTimeout(() => setYeniler(new Set()), 6000);
    return () => {
      clearTimeout(zamanlayici);
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
      showToast("success", t({ tr: "Yorum eklendi.", en: "Comment added." }));
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

  /*
    Sağ panelde küçük kutu, yorumlar pencerede (26.10.2026). Pencere
    kapalıyken de bileşen yaşıyor (Dialog içeriği kaldırmıyor): dakikalık
    yenileme sürüyor, yeni yorum gelince kutu vurgulanıyor.
  */
  return (
    <>
    <YanKutu
      ikon={MessageSquare}
      baslik={t({ tr: "Yorumlar", en: "Comments" })}
      deger={comments === null ? (yuklemeHatasi ? "—" : "…") : open.length}
      alt={
        comments === null
          ? yuklemeHatasi
            ? t({ tr: "okunamadı", en: "could not be read" })
            : t({ tr: "yükleniyor", en: "loading" })
          : open.length
            ? t({ tr: "açık yorum", en: "open comments" })
            : t({ tr: "açık yorum yok", en: "no open comments" })
      }
      ton={open.length ? "warning" : undefined}
      vurgu={yeniler.size > 0}
      onClick={() => setAcik(true)}
    />
    <Dialog
      open={acik}
      onClose={() => setAcik(false)}
      kicker={t({ tr: "Danışmanla yazışma", en: "Advisor conversation" })}
      title={t({ tr: "Yorumlar", en: "Comments" })}
      description={t({
        tr: "Metinde bir yeri seçip yorum yazarsanız yorum o cümleye bağlanır; alıntıya basınca metinde o yer açılır.",
        en: "If you select a passage and write a comment, the comment is attached to that sentence; click the quote to open that spot in the text.",
      })}
    >
    <div className="yorum-penceresi">

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
          placeholder={t({
            tr: "Not ya da soru yazın; metinde seçili bir yer varsa ona bağlanır.",
            en: "Write a note or question; if text is selected, it is attached to it.",
          })}
          aria-label={t({ tr: "Yorum", en: "Comment" })}
        />
        <button type="submit" className="projects-filter-button outline-action" disabled={busy || !body.trim()}>
          {t({ tr: "Yorum ekle", en: "Add comment" })}
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
                  <span className="comment-avatar" aria-hidden="true">
                    {basHarfler(
                      comment.isMine ? t({ tr: "Siz", en: "You" }) : (comment.authorName ?? t({ tr: "Ekip üyesi", en: "Team member" })),
                      YEREL[dil]
                    )}
                  </span>
                  {comment.isMine ? t({ tr: "Siz", en: "You" }) : (comment.authorName ?? t({ tr: "Ekip üyesi", en: "Team member" }))}
                  {comment.resolvedAt ? (
                    <span className="comment-resolved" title={t({ tr: "Çözüldü", en: "Resolved" })}>
                      <Check size={12} aria-hidden="true" />
                      {t({ tr: "Çözüldü", en: "Resolved" })}
                    </span>
                  ) : null}
                </span>
                <span>{formatTime(comment.createdAt)}</span>
              </div>
              {comment.quote ? (
                <button
                  type="button"
                  className="comment-quote"
                  onClick={() => {
                    setAcik(false);
                    onFind(comment.quote!);
                  }}
                  title={t({ tr: "Metinde göster", en: "Show in text" })}
                >
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
                      comment.resolvedAt
                        ? t({ tr: "Yorum yeniden açıldı.", en: "Comment reopened." })
                        : t({ tr: "Yorum çözüldü olarak işaretlendi.", en: "Comment marked as resolved." }),
                    )
                  }
                >
                  {comment.resolvedAt ? t({ tr: "Yeniden aç", en: "Reopen" }) : t({ tr: "Çözüldü", en: "Resolve" })}
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
                      if (
                        !window.confirm(
                          t({
                            tr: "Bu yorumu silmek istediğinize emin misiniz? Yorum kalıcı olarak silinir, geri alınamaz.",
                            en: "Are you sure you want to delete this comment? It will be permanently deleted and cannot be undone.",
                          })
                        )
                      )
                        return;
                      void run(() => deleteManuscriptComment(comment.id), t({ tr: "Yorum silindi.", en: "Comment deleted." }));
                    }}
                  >
                    {t({ tr: "Sil", en: "Delete" })}
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : yuklemeHatasi ? (
        <p className="alert" data-tone="danger" role="alert">
          {yuklemeHatasi === true ? t({ tr: "Yorumlar şu an okunamadı.", en: "Comments could not be read right now." }) : yuklemeHatasi}{" "}
          {t({ tr: "Yorumlarınız yerinde duruyor; sayfayı yenileyin.", en: "Your comments are safe; refresh the page." })}
        </p>
      ) : comments !== null ? (
        <BosDurum
          kompakt
          ikon={MessageSquare}
          aciklama={
            open.length === 0 && resolvedCount > 0
              ? t({
                  tr: "Açık yorum kalmadı. Çözülenleri aşağıdan yeniden görebilirsiniz.",
                  en: "No open comments left. You can view resolved ones again below.",
                })
              : t({
                  tr: "Henüz yorum yok. Metinde bir yeri seçip yorum bırakırsanız, danışmanınız tam o cümleyi görür.",
                  en: "No comments yet. If you select a passage and leave a comment, your advisor sees exactly that sentence.",
                })
          }
        />
      ) : (
        /* Yükleniyor: eskiden hiçbir şey çizilmiyordu, bölüm boş görünüyordu. */
        <p className="muted text-sm" aria-busy="true">{t({ tr: "Yorumlar yükleniyor…", en: "Loading comments…" })}</p>
      )}

      {resolvedCount > 0 ? (
        <button type="button" className="result-link" onClick={() => setShowResolved((value) => !value)}>
          {showResolved
            ? t({ tr: "Çözülenleri gizle", en: "Hide resolved" })
            : t({ tr: `Çözülenleri göster (${resolvedCount})`, en: `Show resolved (${resolvedCount})` })}
        </button>
      ) : null}
    </div>
    </Dialog>
    </>
  );
}
