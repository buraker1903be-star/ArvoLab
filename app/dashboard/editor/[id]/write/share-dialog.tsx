"use client";

import { useEffect, useState } from "react";
import { Copy, Link2 } from "lucide-react";
import Dialog from "@/app/dashboard/_components/dialog";
import BosDurum from "@/app/dashboard/_components/bos-durum";
import { showToast } from "@/app/dashboard/_components/toast-events";
import { createShareLink, listShareLinks, revokeShareLink, type ShareLink } from "@/app/actions/share-links";
import { useCeviri, useTarihler } from "@/app/_components/dil-saglayici";
import type { Cevirici } from "@/lib/dil";

const DURATIONS = [7, 30, 90];

function linkStatus(link: ShareLink, t: Cevirici, formatDate: (value: string) => string): { text: string; active: boolean } {
  if (link.revokedAt) {
    const gun = formatDate(link.revokedAt);
    return { text: t({ tr: `İptal edildi · ${gun}`, en: `Revoked · ${gun}` }), active: false };
  }
  const bitis = formatDate(link.expiresAt);
  if (new Date(link.expiresAt).getTime() <= Date.now()) return { text: t({ tr: `Süresi doldu · ${bitis}`, en: `Expired · ${bitis}` }), active: false };
  return { text: t({ tr: `${bitis} tarihine kadar geçerli`, en: `Valid until ${bitis}` }), active: true };
}

// Danışmana salt okunur bağlantı: giriş gerektirmez, süreli ve iptal edilebilir. Bağlantı
// adresi yalnızca oluşturulduğu anda gösterilir (sunucuda saklanmaz).
export default function ShareDialog({ open, onClose, projectId }: { open: boolean; onClose: () => void; projectId: string }) {
  const t = useCeviri();
  const { tarih: formatDate } = useTarihler();
  const [links, setLinks] = useState<ShareLink[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [days, setDays] = useState(30);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      const result = await listShareLinks(projectId);
      if (cancelled) return;
      setLinks(result.links);
      setLoadError(result.error ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, projectId, reloadKey]);

  const close = () => {
    setCreated(null);
    setLinks(null);
    onClose();
  };

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      showToast("success", t({ tr: "Bağlantı panoya kopyalandı.", en: "Link copied to clipboard." }));
    } catch {
      showToast("error", t({ tr: "Kopyalanamadı; bağlantıyı seçip elle kopyalayın.", en: "Could not copy; select the link and copy it manually." }));
    }
  };

  const create = async () => {
    setBusy(true);
    try {
      const result = await createShareLink(projectId, { days, label });
      if (result.error || !result.url) {
        showToast("error", result.error ?? t({ tr: "Bağlantı oluşturulamadı.", en: "The link could not be created." }));
        return;
      }
      setCreated(result.url);
      setLabel("");
      setReloadKey((key) => key + 1);
      await copy(result.url);
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (link: ShareLink) => {
    const soru = link.label
      ? t({
          tr: `"${link.label}" bağlantısı iptal edilsin mi? Bağlantıyı açan kişi metni artık göremez.`,
          en: `Revoke the link "${link.label}"? Anyone opening it will no longer see the text.`,
        })
      : t({
          tr: "Bu bağlantı iptal edilsin mi? Bağlantıyı açan kişi metni artık göremez.",
          en: "Revoke this link? Anyone opening it will no longer see the text.",
        });
    if (!window.confirm(soru)) return;
    const result = await revokeShareLink(link.id);
    if (result.error) {
      showToast("error", result.error);
      return;
    }
    showToast("success", t({ tr: "Bağlantı iptal edildi.", en: "Link revoked." }));
    setReloadKey((key) => key + 1);
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      kicker={t({ tr: "Paylaş", en: "Share" })}
      title={t({ tr: "Danışmana salt okunur bağlantı", en: "Read-only link for your advisor" })}
      description={t({
        tr: "Bağlantıya sahip olan herkes giriş yapmadan metnin son kaydedilmiş hâlini baskı görünümünde okuyabilir; düzenleyemez. Süre dolunca ya da iptal edince bağlantı çalışmaz.",
        en: "Anyone with the link can read the last saved version of the text in print view without signing in; they cannot edit it. The link stops working when it expires or is revoked.",
      })}
    >
      <div className="stack">
        <form
          className="version-save"
          onSubmit={(event) => {
            event.preventDefault();
            void create();
          }}
        >
          <input
            className="picker-search"
            value={label}
            maxLength={120}
            onChange={(event) => setLabel(event.target.value)}
            placeholder={t({ tr: "Kime? (ör. Danışman Prof. Dr. …)", en: "For whom? (e.g. Advisor Prof. …)" })}
            aria-label={t({ tr: "Bağlantı adı", en: "Link name" })}
          />
          <select className="compact-select" value={days} onChange={(event) => setDays(Number(event.target.value))} aria-label={t({ tr: "Geçerlilik süresi", en: "Validity period" })}>
            {DURATIONS.map((gun) => (
              <option key={gun} value={gun}>
                {t({ tr: `${gun} gün`, en: `${gun} days` })}
              </option>
            ))}
          </select>
          <button type="submit" className="projects-primary-button" disabled={busy}>
            <Link2 size={15} aria-hidden="true" />
            {t({ tr: "Bağlantı oluştur", en: "Create link" })}
          </button>
        </form>

        {created ? (
          <div className="alert" data-tone="success" role="status">
            <p className="text-sm">
              {t({
                tr: "Bağlantı oluşturuldu ve kopyalandı. Güvenlik için bu adres yalnızca şimdi gösterilir; kaybederseniz yeni bağlantı oluşturun.",
                en: "Link created and copied. For security, this address is shown only now; if you lose it, create a new link.",
              })}
            </p>
            <div className="version-save">
              <input className="picker-search" value={created} readOnly aria-label={t({ tr: "Paylaşım bağlantısı", en: "Share link" })} onFocus={(event) => event.target.select()} />
              <button type="button" className="projects-filter-button" onClick={() => void copy(created)}>
                <Copy size={15} aria-hidden="true" />
                {t({ tr: "Kopyala", en: "Copy" })}
              </button>
            </div>
          </div>
        ) : null}

        {loadError ? <p className="alert" data-tone="danger" role="alert">{loadError}</p> : null}
        {links === null ? (
          <p className="muted text-sm" aria-busy="true">{t({ tr: "Bağlantılar yükleniyor…", en: "Loading links…" })}</p>
        ) : links.length === 0 ? (
          /* Eskiden yalnızca "Henüz paylaşım bağlantısı yok." yazan düz bir
             satırdı: aynı pencerenin diğer boş durumlarıyla hiç benzemiyor,
             kullanıcıya bağlantının ne işe yaradığını da söylemiyordu. */
          <BosDurum
            kompakt
            ikon={Link2}
            aciklama={t({
              tr: "Henüz paylaşım bağlantısı yok. Yukarıdan süre seçip oluşturduğunuz bağlantıyla danışmanınız çalışmanızı hesap açmadan okuyabilir.",
              en: "No share links yet. Choose a duration above and create a link so your advisor can read your work without an account.",
            })}
          />
        ) : (
          <ul className="picker-list">
            {links.map((link) => {
              const status = linkStatus(link, t, formatDate);
              return (
                <li key={link.id} className="picker-item">
                  <span className="picker-main">
                    <strong>{link.label ?? t({ tr: "Adsız bağlantı", en: "Untitled link" })}</strong>
                    <small>
                      {status.text} ·{" "}
                      {link.viewCount
                        ? t({ tr: `${link.viewCount} kez açıldı`, en: `opened ${link.viewCount} times` })
                        : t({ tr: "henüz açılmadı", en: "not opened yet" })}
                    </small>
                  </span>
                  {status.active ? (
                    <button type="button" className="projects-filter-button button-compact" onClick={() => void revoke(link)}>
                      {t({ tr: "İptal et", en: "Revoke" })}
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Dialog>
  );
}
