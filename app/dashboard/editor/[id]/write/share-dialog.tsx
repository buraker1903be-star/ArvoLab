"use client";

import { useEffect, useState } from "react";
import { Copy, Link2 } from "lucide-react";
import Dialog from "@/app/dashboard/_components/dialog";
import { showToast } from "@/app/dashboard/_components/toast-events";
import { createShareLink, listShareLinks, revokeShareLink, type ShareLink } from "@/app/actions/share-links";

const DURATIONS = [
  { days: 7, label: "7 gün" },
  { days: 30, label: "30 gün" },
  { days: 90, label: "90 gün" },
];

const formatDate = (value: string) => new Date(value).toLocaleDateString("tr-TR", { dateStyle: "medium" });

function linkStatus(link: ShareLink): { text: string; active: boolean } {
  if (link.revokedAt) return { text: `İptal edildi · ${formatDate(link.revokedAt)}`, active: false };
  if (new Date(link.expiresAt).getTime() <= Date.now()) return { text: `Süresi doldu · ${formatDate(link.expiresAt)}`, active: false };
  return { text: `${formatDate(link.expiresAt)} tarihine kadar geçerli`, active: true };
}

// Danışmana salt okunur bağlantı: giriş gerektirmez, süreli ve iptal edilebilir. Bağlantı
// adresi yalnızca oluşturulduğu anda gösterilir (sunucuda saklanmaz).
export default function ShareDialog({ open, onClose, projectId }: { open: boolean; onClose: () => void; projectId: string }) {
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
      showToast("success", "Bağlantı panoya kopyalandı.");
    } catch {
      showToast("error", "Kopyalanamadı; bağlantıyı seçip elle kopyalayın.");
    }
  };

  const create = async () => {
    setBusy(true);
    try {
      const result = await createShareLink(projectId, { days, label });
      if (result.error || !result.url) {
        showToast("error", result.error ?? "Bağlantı oluşturulamadı.");
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
    if (!window.confirm(`${link.label ? `"${link.label}" bağlantısı` : "Bu bağlantı"} iptal edilsin mi? Bağlantıyı açan kişi metni artık göremez.`)) return;
    const result = await revokeShareLink(link.id);
    if (result.error) {
      showToast("error", result.error);
      return;
    }
    showToast("success", "Bağlantı iptal edildi.");
    setReloadKey((key) => key + 1);
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      kicker="Paylaş"
      title="Danışmana salt okunur bağlantı"
      description="Bağlantıya sahip olan herkes giriş yapmadan metnin son kaydedilmiş hâlini baskı görünümünde okuyabilir; düzenleyemez. Süre dolunca ya da iptal edince bağlantı çalışmaz."
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
            placeholder="Kime? (ör. Danışman Prof. Dr. …)"
            aria-label="Bağlantı adı"
          />
          <select className="compact-select" value={days} onChange={(event) => setDays(Number(event.target.value))} aria-label="Geçerlilik süresi">
            {DURATIONS.map((duration) => (
              <option key={duration.days} value={duration.days}>
                {duration.label}
              </option>
            ))}
          </select>
          <button type="submit" className="projects-primary-button" disabled={busy}>
            <Link2 size={15} aria-hidden="true" />
            Bağlantı oluştur
          </button>
        </form>

        {created ? (
          <div className="alert" data-tone="success" role="status">
            <p className="text-sm">Bağlantı oluşturuldu ve kopyalandı. Güvenlik için bu adres yalnızca şimdi gösterilir; kaybederseniz yeni bağlantı oluşturun.</p>
            <div className="version-save">
              <input className="picker-search" value={created} readOnly aria-label="Paylaşım bağlantısı" onFocus={(event) => event.target.select()} />
              <button type="button" className="projects-filter-button" onClick={() => void copy(created)}>
                <Copy size={15} aria-hidden="true" />
                Kopyala
              </button>
            </div>
          </div>
        ) : null}

        {loadError ? <p className="alert" data-tone="danger" role="alert">{loadError}</p> : null}
        {links === null ? (
          <p className="muted text-sm" aria-busy="true">Bağlantılar yükleniyor…</p>
        ) : links.length === 0 ? (
          <p className="muted text-sm">Henüz paylaşım bağlantısı yok.</p>
        ) : (
          <ul className="picker-list">
            {links.map((link) => {
              const status = linkStatus(link);
              return (
                <li key={link.id} className="picker-item">
                  <span className="picker-main">
                    <strong>{link.label ?? "Adsız bağlantı"}</strong>
                    <small>
                      {status.text} · {link.viewCount ? `${link.viewCount} kez açıldı` : "henüz açılmadı"}
                    </small>
                  </span>
                  {status.active ? (
                    <button type="button" className="projects-filter-button button-compact" onClick={() => void revoke(link)}>
                      İptal et
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
