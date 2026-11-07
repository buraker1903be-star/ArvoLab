"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import Dialog from "@/app/dashboard/_components/dialog";
import { createCitationSource, getLiteratureSources, lookupDoi, type LiteratureSource } from "@/app/actions/literature";
import { literaturAramasiYap, type AramaYaniti } from "@/app/actions/literatur-arama";
import { cumleSorgusu, kutuphanedenEslesenler } from "@/lib/cumle-kaynak";
import { doiAnahtari } from "@/lib/doi";
import { kaynakDoiAnahtari } from "@/lib/kaynak-ekleme";
import { showToast } from "@/app/dashboard/_components/toast-events";
import { useCeviri } from "@/app/_components/dil-saglayici";

/*
  CÜMLEYE KAYNAK BUL penceresi (03.11.2026). Kurallar lib/cumle-kaynak.ts'te.
  Önce öğrencinin kendi kütüphanesi (zaten okuduğu kaynaklar), sonra gerçek
  dizinler. Dizin kaydı "Ekle ve atıf yap" ile önce kütüphaneye girer —
  DOI'si varsa künye Crossref'ten tamamlanır (cilt, sayı, sayfa) — sonra
  editörün olağan atıf akışıyla (handleCite) imlece atıf olarak eklenir.

  "Bu kaynak cümlenizi destekliyor" DENMEZ: eşleşme başlıktaki ortak
  sözcüklerdir; pencere bunu söylüyor.
*/
export default function KaynakBulPenceresi({
  open,
  onClose,
  projectId,
  cumle,
  onCite,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  /** Pencere açılırken seçili metin ya da imlecin paragrafı. */
  cumle: string;
  onCite: (source: LiteratureSource) => void;
}) {
  const t = useCeviri();
  const [kutuphane, setKutuphane] = useState<LiteratureSource[] | null>(null);
  const [kutuphaneOkunamadi, setKutuphaneOkunamadi] = useState(false);
  // Pencere her cümle için yeniden kurulur (çağıranda key), ifade ilk değerden gelir.
  const [sorgu, setSorgu] = useState(() => cumleSorgusu(cumle));
  const [arama, setArama] = useState<AramaYaniti | null>(null);
  const [ariyor, setAriyor] = useState(false);
  const [ekleniyor, setEkleniyor] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let iptal = false;
    getLiteratureSources()
      .then((s) => {
        if (iptal) return;
        setKutuphaneOkunamadi(s.okunamadi);
        setKutuphane(s.okunamadi ? null : s.satirlar);
      })
      .catch(() => !iptal && setKutuphaneOkunamadi(true));
    return () => {
      iptal = true;
    };
  }, [open]);

  const eslesen = kutuphane ? kutuphanedenEslesenler(cumle, kutuphane) : [];

  const ara = async () => {
    if (sorgu.trim().length < 3 || ariyor) return;
    setAriyor(true);
    try {
      setArama(await literaturAramasiYap({ sorgu: sorgu.trim(), projectId, gunlukDisi: true }));
    } catch {
      setArama({ hata: t({ tr: "Dizinlere ulaşılamadı; bağlantınızı kontrol edin.", en: "Couldn't reach the indexes; check your connection." }) });
    } finally {
      setAriyor(false);
    }
  };

  const ekleVeAtifYap = async (kayit: NonNullable<AramaYaniti["kayitlar"]>[number]) => {
    /* Zaten kütüphanede: aynı kaynağı ikinci kez eklemek yerine var olana atıf. */
    /* Tek DOI kuralı (lib/doi.ts, A1): eskiden burada dördüncü bir yerel kural vardı ("doi:" öneki ve sondaki noktalamayı tanımıyordu). */
    const kayitDoisi = doiAnahtari(kayit.doi);
    const mevcut = kayit.listede
      ? kutuphane?.find((k) => (kayitDoisi && kaynakDoiAnahtari(k.doi_or_url) === kayitDoisi) || k.title.trim().toLocaleLowerCase("tr-TR") === kayit.baslik.trim().toLocaleLowerCase("tr-TR"))
      : undefined;
    if (mevcut) {
      onClose();
      onCite(mevcut);
      return;
    }
    setEkleniyor(kayit.kimlik);
    try {
      // DOI varsa künye Crossref'ten tam gelir; yoksa dizin kaydındaki bilgiyle (eksikler atıfta söylenir).
      const meta = kayit.doi ? (await lookupDoi(kayit.doi, projectId).catch(() => ({ metadata: undefined }))).metadata : undefined;
      const sonuc = await createCitationSource({
        title: meta?.title ?? kayit.baslik,
        authors: meta?.authors ?? (kayit.yazarlar.length ? kayit.yazarlar.join("; ") : null),
        year: meta?.year ?? (kayit.yil ? String(kayit.yil) : null),
        sourceType: meta?.sourceType ?? kayit.tur,
        doiOrUrl: kayit.doi ? `https://doi.org/${kayit.doi}` : kayit.url,
        containerTitle: meta?.containerTitle ?? kayit.dergi,
        volume: meta?.volume ?? null,
        issue: meta?.issue ?? null,
        pages: meta?.pages ?? null,
        publisher: meta?.publisher ?? null,
        publicationPlace: meta?.publicationPlace ?? null,
        projectId,
      });
      if (sonuc.error || !sonuc.source) {
        showToast("error", sonuc.error ?? t({ tr: "Kaynak eklenemedi.", en: "Couldn't add the source." }));
        return;
      }
      onClose();
      onCite(sonuc.source);
    } finally {
      setEkleniyor(null);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      kicker={t({ tr: "Cümleye kaynak bul", en: "Find a source for this sentence" })}
      title={cumle.length > 140 ? `${cumle.slice(0, 137)}…` : cumle || t({ tr: "Cümle seçilmedi", en: "No sentence selected" })}
      description={t({
        tr: "Önce kütüphanenizde, sonra OpenAlex ve Crossref'te arar; her sonuç gerçek bir kayıttır. Eşleşme başlıktaki ortak sözcüklere dayanır: kaynağın cümlenizi gerçekten desteklediğini okuyarak doğrulayın.",
        en: "Searches your library first, then OpenAlex and Crossref; every result is a real record. Matching is based on shared words in the title: confirm by reading that the source actually supports your sentence.",
      })}
    >
      <div className="stack-sm">
        <h3 className="pencere-kart-baslik">{t({ tr: "Kütüphanenizden", en: "From your library" })}</h3>
        {kutuphaneOkunamadi ? (
          <p className="muted text-sm">{t({ tr: "Kütüphaneniz okunamadı.", en: "Your library couldn't be read." })}</p>
        ) : kutuphane === null ? (
          <p className="muted text-sm">{t({ tr: "Yükleniyor…", en: "Loading…" })}</p>
        ) : eslesen.length ? (
          <ul className="bekleyen-kaynaklar">
            {eslesen.map((k) => (
              <li key={k.id}>
                <span>
                  <b>{k.title}</b>
                  <small>
                    {[k.authors, k.year].filter(Boolean).join(" · ")} — {t({ tr: "ortak:", en: "shared:" })} {k.ortak.join(", ")}
                  </small>
                </span>
                <button
                  type="button"
                  className="projects-filter-button button-compact"
                  onClick={() => {
                    onClose();
                    onCite(k);
                  }}
                >
                  {t({ tr: "Atıf ekle", en: "Cite" })}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted text-sm">{t({ tr: "Kütüphanenizde bu cümleye yakın bir kaynak yok.", en: "No source in your library is close to this sentence." })}</p>
        )}

        <h3 className="pencere-kart-baslik">{t({ tr: "Dizinlerde ara", en: "Search the indexes" })}</h3>
        <form
          className="doi-row"
          onSubmit={(e) => {
            e.preventDefault();
            void ara();
          }}
        >
          <input
            className="picker-search"
            value={sorgu}
            maxLength={300}
            onChange={(e) => setSorgu(e.target.value)}
            aria-label={t({ tr: "Arama ifadesi", en: "Search query" })}
          />
          <button type="submit" className="projects-primary-button button-compact" disabled={ariyor || sorgu.trim().length < 3}>
            <Search size={14} aria-hidden="true" /> {ariyor ? t({ tr: "Aranıyor…", en: "Searching…" }) : t({ tr: "Ara", en: "Search" })}
          </button>
        </form>
        <small className="muted">
          {t({
            tr: "İfade cümlenizden çıkarıldı; düzenleyebilirsiniz. Türkçe ifade İngilizce yayınları az bulur: anahtar kavramları İngilizce yazmayı deneyin.",
            en: "The query was taken from your sentence; you can edit it. Try writing the key concepts in English to reach more of the literature.",
          })}
        </small>
        {arama?.hata ? (
          <p className="tone-text text-sm" data-tone="danger">{arama.hata}</p>
        ) : arama?.kayitlar ? (
          arama.kayitlar.length ? (
            <ul className="bekleyen-kaynaklar">
              {arama.kayitlar.slice(0, 10).map((k) => (
                <li key={k.kimlik}>
                  <span>
                    <b>{k.baslik}</b>
                    <small>{[k.yazarlar.slice(0, 3).join(", "), k.yil, k.dergi].filter(Boolean).join(" · ")}</small>
                  </span>
                  <button
                    type="button"
                    className="projects-filter-button button-compact"
                    disabled={ekleniyor !== null}
                    onClick={() => void ekleVeAtifYap(k)}
                  >
                    {ekleniyor === k.kimlik ? t({ tr: "Ekleniyor…", en: "Adding…" }) : k.listede ? t({ tr: "Atıf ekle", en: "Cite" }) : t({ tr: "Ekle ve atıf yap", en: "Add and cite" })}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted text-sm">{t({ tr: "Sonuç çıkmadı; ifadeyi kısaltıp yeniden deneyin.", en: "No results; shorten the query and try again." })}</p>
          )
        ) : null}
        {arama?.ulasilamayan?.length ? (
          <small className="muted">{t({ tr: `Ulaşılamayan dizin: ${arama.ulasilamayan.join(", ")} — liste eksik olabilir.`, en: `Unreachable index: ${arama.ulasilamayan.join(", ")} — the list may be incomplete.` })}</small>
        ) : null}
      </div>
    </Dialog>
  );
}
