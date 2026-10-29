"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Download, FileUp } from "lucide-react";
import { doiIleEkle, kaynaklariIceAktar, type DoiSonucu } from "@/app/actions/kaynak-aktarim";
import type { LiteratureSource } from "@/app/actions/literature";
import {
  bibtexYaz,
  DOI_TOPLU_EN_COK,
  doiAyikla,
  ICE_AKTARMA_EN_COK,
  kaynakAnahtarlari,
  kaynakcaMetni,
  kaynakDosyasiOku,
  risYaz,
  type KaynakTaslagi,
} from "@/lib/kaynak-aktarim";
import type { CitationStyle } from "@/lib/citation-format";
import { showToast } from "../_components/toast-events";
import { useCeviri, useDil } from "@/app/_components/dil-saglayici";
import { YEREL, type Dil, type Metin } from "@/lib/dil";

/*
  KAYNAK EKLEME VE DIŞA AKTARMA ARAÇLARI (27.10.2026): Kaynaklar
  sayfasındaki "İçe aktar" ve "Dışa aktar" pencerelerinin içi. Ayrıştırma
  ve biçimleme lib/kaynak-aktarim.ts'te (saf, testli); bu bileşen yalnızca
  dosyayı okuyor, önizlemeyi gösteriyor ve sunucu işlemini çağırıyor.
*/

/** Zotero/Mendeley dosyası ve DOI listesiyle ekleme. */
export function IceAktarma({ projectId, mevcut }: { projectId: string; mevcut: LiteratureSource[] }) {
  const router = useRouter();
  const t = useCeviri();
  const dil = useDil();
  const [dosya, setDosya] = useState<{ ad: string; bicim: string; kayitlar: KaynakTaslagi[] } | null>(null);
  const [dosyaHatasi, setDosyaHatasi] = useState<string | null>(null);
  const [doiMetni, setDoiMetni] = useState("");
  const [doiSonuclari, setDoiSonuclari] = useState<DoiSonucu[] | null>(null);
  const [bekliyor, basla] = useTransition();

  // Sunucuyla aynı kural (app/actions/kaynak-aktarim.ts): DOI ya da başlık+yıl eşleşmesi tekrardır.
  const mevcutAnahtarlar = new Set(mevcut.flatMap((k) => kaynakAnahtarlari(k)));
  const yeni: KaynakTaslagi[] = [];
  for (const k of dosya?.kayitlar ?? []) {
    const anahtarlari = kaynakAnahtarlari(k);
    if (anahtarlari.some((a) => mevcutAnahtarlar.has(a))) continue;
    anahtarlari.forEach((a) => mevcutAnahtarlar.add(a));
    yeni.push(k);
  }
  const doilar = doiAyikla(doiMetni);

  const dosyaSecildi = async (f: File | undefined) => {
    setDosya(null);
    setDosyaHatasi(null);
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) return setDosyaHatasi(t({ tr: "Dosya 5 MB sınırını aşıyor; kütüphaneyi bölerek aktarın.", en: "The file exceeds the 5 MB limit; split your library and import it in parts." }));
    const okunan = kaynakDosyasiOku(f.name, await f.text());
    if (!okunan.bicim) return setDosyaHatasi(t({ tr: "Dosya RIS ya da BibTeX biçiminde değil. Zotero/Mendeley'de “Dışa aktar” ile .ris ya da .bib seçin.", en: "The file isn't in RIS or BibTeX format. In Zotero/Mendeley, use “Export” and choose .ris or .bib." }));
    if (!okunan.kayitlar.length) return setDosyaHatasi(t({ tr: "Dosyada başlığı olan kaynak bulunamadı.", en: "No sources with a title were found in the file." }));
    setDosya({ ad: f.name, bicim: okunan.bicim === "ris" ? "RIS" : "BibTeX", kayitlar: okunan.kayitlar });
  };

  const dosyayiEkle = () =>
    basla(async () => {
      if (!dosya) return;
      const r = await kaynaklariIceAktar(projectId, dosya.kayitlar.slice(0, ICE_AKTARMA_EN_COK));
      if (r.error) return showToast("error", r.error);
      showToast(
        "success",
        t({
          tr: `${r.eklenen} kaynak eklendi${r.atlanan ? `; ${r.atlanan} kaynak zaten listenizde olduğu için atlandı` : ""}.`,
          en: `${r.eklenen} ${r.eklenen === 1 ? "source" : "sources"} added${r.atlanan ? `; ${r.atlanan} skipped because they're already in your list` : ""}.`,
        }),
      );
      setDosya(null);
      router.refresh();
    });

  const doileriEkle = () =>
    basla(async () => {
      const r = await doiIleEkle(projectId, doilar);
      if (r.error) return showToast("error", r.error);
      setDoiSonuclari(r.sonuclar ?? []);
      const eklenen = (r.sonuclar ?? []).filter((s) => s.durum === "eklendi").length;
      if (eklenen) {
        showToast("success", t({ tr: `${eklenen} kaynak eklendi.`, en: `${eklenen} ${eklenen === 1 ? "source" : "sources"} added.` }));
        router.refresh();
      }
    });

  const DURUM_ADI: Record<DoiSonucu["durum"], Metin> = {
    eklendi: { tr: "eklendi", en: "added" },
    vardi: { tr: "zaten listede", en: "already in your list" },
    bulunamadi: { tr: "Crossref'te bulunamadı", en: "not found in Crossref" },
    hata: { tr: "şu an alınamadı, yeniden deneyin", en: "couldn't be fetched right now, try again" },
  };

  return (
    <div className="pencere-iki-kart">
      <section className="pencere-kart">
        <h3 className="pencere-kart-baslik">{t({ tr: "Zotero, Mendeley, EndNote dosyası", en: "Zotero, Mendeley, EndNote file" })}</h3>
        {dil === "en" ? (
          <p className="hint">
            Select your sources in the program, use <b>Export</b> to get an <b>RIS (.ris)</b> or <b>BibTeX (.bib)</b> file, and
            upload it here. Google Scholar&apos;s “BibTeX” output works too. The same DOI, or the same title and year, isn&apos;t added twice.
          </p>
        ) : (
          <p className="hint">
            Programda kaynaklarınızı seçip <b>Dışa aktar</b> ile <b>RIS (.ris)</b> ya da <b>BibTeX (.bib)</b> dosyası alın ve
            buraya yükleyin. Google Scholar&apos;ın “BibTeX” çıktısı da olur. Aynı DOI ya da aynı başlık ve yıl ikinci kez eklenmez.
          </p>
        )}
        <label className="dropzone">
          <FileUp size={22} aria-hidden="true" />
          <span>{dosya ? dosya.ad : t({ tr: "RIS ya da BibTeX dosyası seçin", en: "Choose an RIS or BibTeX file" })}</span>
          <input type="file" accept=".ris,.bib,.bibtex,.txt" hidden onChange={(e) => { void dosyaSecildi(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
        {dosyaHatasi ? <p className="alert" data-tone="danger" role="alert">{dosyaHatasi}</p> : null}
        {dosya ? (
          <>
            <p className="text-sm">
              {t({ tr: `${dosya.bicim} dosyasında ${dosya.kayitlar.length} kaynak · `, en: `${dosya.kayitlar.length} ${dosya.kayitlar.length === 1 ? "source" : "sources"} in the ${dosya.bicim} file · ` })}
              <b>{t({ tr: `${yeni.length} yeni`, en: `${yeni.length} new` })}</b>
              {dosya.kayitlar.length - yeni.length
                ? t({
                    tr: ` · ${dosya.kayitlar.length - yeni.length} zaten listenizde ya da dosyada tekrar`,
                    en: ` · ${dosya.kayitlar.length - yeni.length} already in your list or duplicated in the file`,
                  })
                : ""}
              {dosya.kayitlar.length > ICE_AKTARMA_EN_COK ? t({ tr: ` · ilk ${ICE_AKTARMA_EN_COK} aktarılır`, en: ` · the first ${ICE_AKTARMA_EN_COK} will be imported` }) : ""}
            </p>
            <ul className="secim-listesi kaynak-onizleme">
              {yeni.slice(0, 8).map((k, i) => (
                <li key={i}>
                  <b>{k.title}</b>
                  <small>{[k.authors, k.year, k.containerTitle].filter(Boolean).join(" · ")}</small>
                </li>
              ))}
              {yeni.length > 8 ? <li><small>{t({ tr: `… ve ${yeni.length - 8} kaynak daha`, en: `… and ${yeni.length - 8} more` })}</small></li> : null}
            </ul>
            <button type="button" className="projects-primary-button" disabled={bekliyor || !yeni.length} onClick={dosyayiEkle}>
              {yeni.length
                ? t({ tr: `${yeni.length} kaynağı ekle`, en: `Add ${yeni.length} ${yeni.length === 1 ? "source" : "sources"}` })
                : t({ tr: "Eklenecek yeni kaynak yok", en: "No new sources to add" })}
            </button>
          </>
        ) : null}
      </section>
      <section className="pencere-kart">
        <h3 className="pencere-kart-baslik">{t({ tr: "DOI ile ekle", en: "Add by DOI" })}</h3>
        <p className="hint">
          {t({
            tr: `Bir ya da daha çok DOI yapıştırın (her satıra bir tane, bağlantı biçimi de olur). Künye Crossref'ten gelir; en çok ${DOI_TOPLU_EN_COK} DOI.`,
            en: `Paste one or more DOIs (one per line; link format works too). Reference details come from Crossref; at most ${DOI_TOPLU_EN_COK} DOIs.`,
          })}
        </p>
        <textarea rows={6} value={doiMetni} onChange={(e) => { setDoiMetni(e.target.value); setDoiSonuclari(null); }} placeholder={"10.1037/0003-066X.59.1.29\nhttps://doi.org/10.15390/EB.2021.9876"} aria-label={t({ tr: "DOI listesi", en: "DOI list" })} />
        <button type="button" className="projects-primary-button" disabled={bekliyor || !doilar.length} onClick={doileriEkle}>
          {bekliyor
            ? t({ tr: "Ekleniyor…", en: "Adding…" })
            : doilar.length
              ? t({ tr: `${doilar.length} DOI'yi ekle`, en: `Add ${doilar.length} ${doilar.length === 1 ? "DOI" : "DOIs"}` })
              : t({ tr: "DOI bulunamadı", en: "No DOI found" })}
        </button>
        {doiSonuclari ? (
          <ul className="secim-listesi">
            {doiSonuclari.map((s) => (
              <li key={s.doi}>
                <b>{s.baslik ?? s.doi}</b>
                <small data-tone={s.durum === "eklendi" ? "success" : s.durum === "vardi" ? undefined : "warning"} className="tone-text">
                  {s.doi} · {t(DURUM_ADI[s.durum])}
                </small>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}

type Kapsam = "used" | "okunan" | "hepsi";

/** RIS/BibTeX indirme ve seçili stilde kaynakça kopyalama. */
export function DisaAktarma({ kaynaklar, stil, stilAdi, calismaAdi, dil }: { kaynaklar: LiteratureSource[]; stil: CitationStyle; stilAdi: string; calismaAdi: string; dil: Dil }) {
  const t = useCeviri();
  const sayilar = {
    used: kaynaklar.filter((k) => k.status === "used").length,
    okunan: kaynaklar.filter((k) => k.status !== "to_review").length,
    hepsi: kaynaklar.length,
  };
  /* Kaynakçaya girecekler varsayılan olarak metinde kullanılanlar; yoksa hepsi. */
  const [kapsam, setKapsam] = useState<Kapsam>(sayilar.used ? "used" : "hepsi");
  const secili = kaynaklar.filter((k) => (kapsam === "used" ? k.status === "used" : kapsam === "okunan" ? k.status !== "to_review" : true));
  /*
    Künyenin DİLİ (lib/citation-format: "n.d.", "pp.", "Accessed")
    ÇALIŞMANIN dili (lib/belge-dili.ts), arayüzün değil. Eskiden arayüz
    dili kullanılıyordu: İngilizce arayüzle Türkçe makale yazan öğrencinin
    editörü "t.y."/"vd." eklerken kopyalanan kaynakçada "n.d."/"Accessed"
    çıkıyordu. Erişim tarihi de aynı dilde: Türkçede "28.10.2026",
    İngilizcede APA'nın yazdığı biçim ("October 28, 2026").
  */
  const bugun = new Date().toLocaleDateString(YEREL[dil], {
    timeZone: "Europe/Istanbul",
    ...(dil === "en" ? { day: "numeric", month: "long", year: "numeric" } : { day: "2-digit", month: "2-digit", year: "numeric" }),
  });
  const kaynakca = kaynakcaMetni(secili, stil, { erisimTarihi: bugun }, dil);
  const dosyaAdi = calismaAdi.normalize("NFD").replace(/ı/g, "i").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || t({ tr: "kaynaklar", en: "sources" });

  const indir = (icerik: string, uzanti: string, tur: string) => {
    const url = URL.createObjectURL(new Blob([icerik], { type: `${tur};charset=utf-8` }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${dosyaAdi}.${uzanti}`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const kopyala = async () => {
    try {
      /* HTML de veriliyor: Word'e yapıştırınca italikler korunur. */
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([kaynakca.html], { type: "text/html" }),
            "text/plain": new Blob([kaynakca.metin], { type: "text/plain" }),
          }),
        ]);
      } else await navigator.clipboard.writeText(kaynakca.metin);
      showToast("success", t({ tr: `${secili.length} künye kopyalandı (${stilAdi}).`, en: `${secili.length} ${secili.length === 1 ? "reference" : "references"} copied (${stilAdi}).` }));
    } catch {
      showToast("error", t({ tr: "Panoya kopyalanamadı; aşağıdaki metni seçip elle kopyalayın.", en: "Couldn't copy to the clipboard; select the text below and copy it manually." }));
    }
  };

  return (
    <div className="kaynak-disa-aktar">
      <label>
        <span>{t({ tr: "Hangi kaynaklar?", en: "Which sources?" })}</span>
        <select value={kapsam} onChange={(e) => setKapsam(e.target.value as Kapsam)}>
          <option value="used">{t({ tr: "Metinde kullanılanlar", en: "Cited in the text" })} ({sayilar.used})</option>
          <option value="okunan">{t({ tr: "Okunanlar ve metindekiler", en: "Read and cited" })} ({sayilar.okunan})</option>
          <option value="hepsi">{t({ tr: "Hepsi", en: "All" })} ({sayilar.hepsi})</option>
        </select>
      </label>
      <div className="cluster">
        <button type="button" className="projects-primary-button button-compact" disabled={!secili.length} onClick={kopyala}>
          <Copy size={14} aria-hidden="true" /> {t({ tr: "Kaynakçayı kopyala", en: "Copy reference list" })} ({stilAdi})
        </button>
        <button type="button" className="projects-filter-button button-compact" disabled={!secili.length} onClick={() => indir(risYaz(secili), "ris", "application/x-research-info-systems")}>
          <Download size={14} aria-hidden="true" /> {t({ tr: "RIS indir", en: "Download RIS" })}
        </button>
        <button type="button" className="projects-filter-button button-compact" disabled={!secili.length} onClick={() => indir(bibtexYaz(secili), "bib", "application/x-bibtex")}>
          <Download size={14} aria-hidden="true" /> {t({ tr: "BibTeX indir", en: "Download BibTeX" })}
        </button>
      </div>
      <p className="hint">
        {t({
          tr: `Kaynakça çalışmanızın atıf stilinde (${stilAdi}) ve stilin sırasıyla; italikler Word'e yapıştırınca korunur. RIS ve BibTeX dosyasını Zotero, Mendeley ya da EndNote'a “İçe aktar” ile alabilirsiniz.`,
          en: `The reference list is in your work's citation style (${stilAdi}) and in that style's order; italics are kept when you paste into Word. You can bring the RIS and BibTeX files into Zotero, Mendeley or EndNote with “Import”.`,
        })}
      </p>
      {secili.length ? (
        <div className="kaynakca-onizleme">
          {kaynakca.satirlar.map((parcalar, i) => (
            <p key={i}>{parcalar.map((x, j) => (x.italic ? <i key={j}>{x.text}</i> : <span key={j}>{x.text}</span>))}</p>
          ))}
        </div>
      ) : (
        <p className="gb-bos">{t({ tr: "Bu kapsamda kaynak yok.", en: "No sources in this selection." })}</p>
      )}
    </div>
  );
}
