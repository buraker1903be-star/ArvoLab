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
  kaynakAnahtari,
  kaynakcaMetni,
  kaynakDosyasiOku,
  risYaz,
  type KaynakTaslagi,
} from "@/lib/kaynak-aktarim";
import type { CitationStyle } from "@/lib/citation-format";
import { showToast } from "../_components/toast-events";

/*
  KAYNAK EKLEME VE DIŞA AKTARMA ARAÇLARI (27.10.2026): Kaynaklar
  sayfasındaki "İçe aktar" ve "Dışa aktar" pencerelerinin içi. Ayrıştırma
  ve biçimleme lib/kaynak-aktarim.ts'te (saf, testli); bu bileşen yalnızca
  dosyayı okuyor, önizlemeyi gösteriyor ve sunucu işlemini çağırıyor.
*/

/** Zotero/Mendeley dosyası ve DOI listesiyle ekleme. */
export function IceAktarma({ projectId, mevcut }: { projectId: string; mevcut: LiteratureSource[] }) {
  const router = useRouter();
  const [dosya, setDosya] = useState<{ ad: string; bicim: string; kayitlar: KaynakTaslagi[] } | null>(null);
  const [dosyaHatasi, setDosyaHatasi] = useState<string | null>(null);
  const [doiMetni, setDoiMetni] = useState("");
  const [doiSonuclari, setDoiSonuclari] = useState<DoiSonucu[] | null>(null);
  const [bekliyor, basla] = useTransition();

  const mevcutAnahtarlar = new Set(mevcut.map((k) => kaynakAnahtari(k)));
  const yeni = dosya ? dosya.kayitlar.filter((k, i, hepsi) => {
    const a = kaynakAnahtari(k);
    return !mevcutAnahtarlar.has(a) && hepsi.findIndex((x) => kaynakAnahtari(x) === a) === i;
  }) : [];
  const doilar = doiAyikla(doiMetni);

  const dosyaSecildi = async (f: File | undefined) => {
    setDosya(null);
    setDosyaHatasi(null);
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) return setDosyaHatasi("Dosya 5 MB sınırını aşıyor; kütüphaneyi bölerek aktarın.");
    const okunan = kaynakDosyasiOku(f.name, await f.text());
    if (!okunan.bicim) return setDosyaHatasi("Dosya RIS ya da BibTeX biçiminde değil. Zotero/Mendeley'de “Dışa aktar” ile .ris ya da .bib seçin.");
    if (!okunan.kayitlar.length) return setDosyaHatasi("Dosyada başlığı olan kaynak bulunamadı.");
    setDosya({ ad: f.name, bicim: okunan.bicim === "ris" ? "RIS" : "BibTeX", kayitlar: okunan.kayitlar });
  };

  const dosyayiEkle = () =>
    basla(async () => {
      if (!dosya) return;
      const r = await kaynaklariIceAktar(projectId, dosya.kayitlar.slice(0, ICE_AKTARMA_EN_COK));
      if (r.error) return showToast("error", r.error);
      showToast("success", `${r.eklenen} kaynak eklendi${r.atlanan ? `; ${r.atlanan} kaynak zaten listenizde olduğu için atlandı` : ""}.`);
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
        showToast("success", `${eklenen} kaynak eklendi.`);
        router.refresh();
      }
    });

  const DURUM_ADI: Record<DoiSonucu["durum"], string> = {
    eklendi: "eklendi",
    vardi: "zaten listede",
    bulunamadi: "Crossref'te bulunamadı",
    hata: "şu an alınamadı, yeniden deneyin",
  };

  return (
    <div className="pencere-iki-kart">
      <section className="pencere-kart">
        <h3 className="pencere-kart-baslik">Zotero, Mendeley, EndNote dosyası</h3>
        <p className="hint">
          Programda kaynaklarınızı seçip <b>Dışa aktar</b> ile <b>RIS (.ris)</b> ya da <b>BibTeX (.bib)</b> dosyası alın ve
          buraya yükleyin. Google Scholar&apos;ın “BibTeX” çıktısı da olur. Aynı DOI ya da aynı başlık ve yıl ikinci kez eklenmez.
        </p>
        <label className="dropzone">
          <FileUp size={22} aria-hidden="true" />
          <span>{dosya ? dosya.ad : "RIS ya da BibTeX dosyası seçin"}</span>
          <input type="file" accept=".ris,.bib,.bibtex,.txt" hidden onChange={(e) => { void dosyaSecildi(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
        {dosyaHatasi ? <p className="alert" data-tone="danger" role="alert">{dosyaHatasi}</p> : null}
        {dosya ? (
          <>
            <p className="text-sm">
              {dosya.bicim} dosyasında {dosya.kayitlar.length} kaynak · <b>{yeni.length} yeni</b>
              {dosya.kayitlar.length - yeni.length ? ` · ${dosya.kayitlar.length - yeni.length} zaten listenizde ya da dosyada tekrar` : ""}
              {dosya.kayitlar.length > ICE_AKTARMA_EN_COK ? ` · ilk ${ICE_AKTARMA_EN_COK} aktarılır` : ""}
            </p>
            <ul className="secim-listesi kaynak-onizleme">
              {yeni.slice(0, 8).map((k, i) => (
                <li key={i}>
                  <b>{k.title}</b>
                  <small>{[k.authors, k.year, k.containerTitle].filter(Boolean).join(" · ")}</small>
                </li>
              ))}
              {yeni.length > 8 ? <li><small>… ve {yeni.length - 8} kaynak daha</small></li> : null}
            </ul>
            <button type="button" className="projects-primary-button" disabled={bekliyor || !yeni.length} onClick={dosyayiEkle}>
              {yeni.length ? `${yeni.length} kaynağı ekle` : "Eklenecek yeni kaynak yok"}
            </button>
          </>
        ) : null}
      </section>
      <section className="pencere-kart">
        <h3 className="pencere-kart-baslik">DOI ile ekle</h3>
        <p className="hint">
          Bir ya da daha çok DOI yapıştırın (her satıra bir tane, bağlantı biçimi de olur). Künye Crossref&apos;ten gelir; en
          çok {DOI_TOPLU_EN_COK} DOI.
        </p>
        <textarea rows={6} value={doiMetni} onChange={(e) => { setDoiMetni(e.target.value); setDoiSonuclari(null); }} placeholder={"10.1037/0003-066X.59.1.29\nhttps://doi.org/10.15390/EB.2021.9876"} aria-label="DOI listesi" />
        <button type="button" className="projects-primary-button" disabled={bekliyor || !doilar.length} onClick={doileriEkle}>
          {bekliyor ? "Ekleniyor…" : doilar.length ? `${doilar.length} DOI'yi ekle` : "DOI bulunamadı"}
        </button>
        {doiSonuclari ? (
          <ul className="secim-listesi">
            {doiSonuclari.map((s) => (
              <li key={s.doi}>
                <b>{s.baslik ?? s.doi}</b>
                <small data-tone={s.durum === "eklendi" ? "success" : s.durum === "vardi" ? undefined : "warning"} className="tone-text">
                  {s.doi} · {DURUM_ADI[s.durum]}
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
export function DisaAktarma({ kaynaklar, stil, stilAdi, calismaAdi }: { kaynaklar: LiteratureSource[]; stil: CitationStyle; stilAdi: string; calismaAdi: string }) {
  const sayilar = {
    used: kaynaklar.filter((k) => k.status === "used").length,
    okunan: kaynaklar.filter((k) => k.status !== "to_review").length,
    hepsi: kaynaklar.length,
  };
  /* Kaynakçaya girecekler varsayılan olarak metinde kullanılanlar; yoksa hepsi. */
  const [kapsam, setKapsam] = useState<Kapsam>(sayilar.used ? "used" : "hepsi");
  const secili = kaynaklar.filter((k) => (kapsam === "used" ? k.status === "used" : kapsam === "okunan" ? k.status !== "to_review" : true));
  const bugun = new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul" }).format(new Date());
  const kaynakca = kaynakcaMetni(secili, stil, { erisimTarihi: bugun });
  const dosyaAdi = calismaAdi.normalize("NFD").replace(/ı/g, "i").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "kaynaklar";

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
      showToast("success", `${secili.length} künye kopyalandı (${stilAdi}).`);
    } catch {
      showToast("error", "Panoya kopyalanamadı; aşağıdaki metni seçip elle kopyalayın.");
    }
  };

  return (
    <div className="kaynak-disa-aktar">
      <label>
        <span>Hangi kaynaklar?</span>
        <select value={kapsam} onChange={(e) => setKapsam(e.target.value as Kapsam)}>
          <option value="used">Metinde kullanılanlar ({sayilar.used})</option>
          <option value="okunan">Okunanlar ve metindekiler ({sayilar.okunan})</option>
          <option value="hepsi">Hepsi ({sayilar.hepsi})</option>
        </select>
      </label>
      <div className="cluster">
        <button type="button" className="projects-primary-button button-compact" disabled={!secili.length} onClick={kopyala}>
          <Copy size={14} aria-hidden="true" /> Kaynakçayı kopyala ({stilAdi})
        </button>
        <button type="button" className="projects-filter-button button-compact" disabled={!secili.length} onClick={() => indir(risYaz(secili), "ris", "application/x-research-info-systems")}>
          <Download size={14} aria-hidden="true" /> RIS indir
        </button>
        <button type="button" className="projects-filter-button button-compact" disabled={!secili.length} onClick={() => indir(bibtexYaz(secili), "bib", "application/x-bibtex")}>
          <Download size={14} aria-hidden="true" /> BibTeX indir
        </button>
      </div>
      <p className="hint">
        Kaynakça çalışmanızın atıf stilinde ({stilAdi}) ve stilin sırasıyla; italikler Word&apos;e yapıştırınca korunur. RIS ve
        BibTeX dosyasını Zotero, Mendeley ya da EndNote&apos;a “İçe aktar” ile alabilirsiniz.
      </p>
      {secili.length ? (
        <div className="kaynakca-onizleme">
          {kaynakca.satirlar.map((parcalar, i) => (
            <p key={i}>{parcalar.map((x, j) => (x.italic ? <i key={j}>{x.text}</i> : <span key={j}>{x.text}</span>))}</p>
          ))}
        </div>
      ) : (
        <p className="gb-bos">Bu kapsamda kaynak yok.</p>
      )}
    </div>
  );
}
