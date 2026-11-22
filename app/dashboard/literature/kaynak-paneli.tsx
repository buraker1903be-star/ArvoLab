"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  ExternalLink,
  FileText,
  FileUp,
  Link2,
  Loader2,
  Maximize2,
  Minimize2,
  Paperclip,
  X,
} from "lucide-react";
import ActionForm from "../action-form";
import { KunyeAlanlari } from "./kaynak-parcalari";
import KaynakDuzeltme from "./kaynak-duzeltme";
import KaynakNotlari from "./kaynak-notlari";
import { updateLiteratureSource, type LiteratureSource } from "@/app/actions/literature";
import { kaynakPdfiYuklendi, pdfKaynaginiBagla } from "@/app/actions/kaynak-pdf";
import { createClient } from "@/lib/supabase/client";
import { yuklemeYolu } from "@/lib/kaynak-pdf-yolu";
import { PDF_EN_FAZLA_BAYT } from "@/lib/kaynak-pdf";
import { editorPdfAdresi, type PdfEslesmesi } from "@/lib/kaynak-durumu";
import { eksikAlanlar } from "@/lib/citation-format";
import { htmlVarliklariniCoz } from "@/lib/html-varlik";
import { showToast } from "../_components/toast-events";
import { useCeviri, useDil } from "@/app/_components/dil-saglayici";
import type { Metin } from "@/lib/dil";

/*
  KAYNAK PANELİ (22.11.2026, Kaynaklar araştırma alanı).

  Listede seçilen kaynağın TEK paneli: PDF'i, künyesi ve notu aynı
  yerde. Panel bileşeni çağıran tarafta `key={kaynak.id}` ile çiziliyor
  (kaynak-alani.tsx): kaynak değişince her şey sıfırdan kurulur, böylece
  önceki kaynağın PDF'i, künyesi ya da notu yeni başlığın altında bir an
  bile görünmez.

  PDF: editörün GERÇEK görüntüleyicisi yeniden kullanılıyor
  (editor/[id]/write/pdf-goruntuleyici.tsx — pdf.js). Sahte bir önizleme
  ya da tarayıcının kendi eklentisine bırakılmış bir <iframe> değil:
  sayfa geçişi, yakınlaştırma, PDF içinde arama ve metin seçimi aynen
  çalışır. Baytlar /api/kaynak-pdf/<id>'den, oturum ve RLS denetimli
  gelir. Görüntüleyici yalnızca SEÇİLİ kaynağın PDF'i için kurulur;
  listedeki PDF'ler peşinen indirilmez.

  PDF durumları ayrı ayrı ele alınıyor: bağlı dosya yok (yükleme eylemi),
  DOI'si tutan ama bağlanmamış dosya (öğrenci onaylar), aynı DOI'de
  birden çok aday (BELİRSİZ — yanlış makaleyi açmaktansa açmıyoruz),
  yükleniyor ve açılamadı (görüntüleyicinin kendi durumları).

  Künye: alanlar ve düzenleme formu mevcut bileşenlerden
  (kaynak-parcalari.tsx, updateLiteratureSource). Dizinden gelen
  öneriler yine yalnızca ONAYLA uygulanır (kaynak-duzeltme.tsx); eksik
  alan açıkça "—" ile gösterilir, uydurulmaz.
*/

const PdfGoruntuleyici = dynamic(() => import("../editor/[id]/write/pdf-goruntuleyici"), { ssr: false });

type Sekme = "pdf" | "kunye" | "notlar";

const ALAN_ADLARI: { anahtar: keyof LiteratureSource; ad: Metin }[] = [
  { anahtar: "authors", ad: { tr: "Yazar(lar)", en: "Author(s)" } },
  { anahtar: "year", ad: { tr: "Yıl", en: "Year" } },
  { anahtar: "container_title", ad: { tr: "Dergi / kitap", en: "Journal / book" } },
  { anahtar: "volume", ad: { tr: "Cilt", en: "Volume" } },
  { anahtar: "issue", ad: { tr: "Sayı", en: "Issue" } },
  { anahtar: "pages", ad: { tr: "Sayfalar", en: "Pages" } },
  { anahtar: "publisher", ad: { tr: "Yayınevi", en: "Publisher" } },
  { anahtar: "publication_place", ad: { tr: "Basım yeri", en: "Place of publication" } },
];

export const kaynakBaglantisi = (deger: string | null | undefined) => {
  const temiz = deger?.trim();
  if (!temiz) return null;
  const doi = temiz.match(/10\.\d{4,9}\/\S+/);
  if (doi && !/^https?:/i.test(temiz)) return `https://doi.org/${doi[0]}`;
  return /^https?:\/\//i.test(temiz) ? temiz : null;
};

export default function KaynakPaneli({
  kaynak,
  projectId,
  eslesme,
  sekme,
  onSekme,
  onKapat,
  genis,
  onGenis,
  onDegisti,
  onNotTaslagi,
}: {
  kaynak: LiteratureSource;
  /** Kaynağın bağlı olduğu çalışma; PDF yükleme ve editörde açma buna bağlı. */
  projectId: string | null;
  eslesme: PdfEslesmesi | null;
  sekme: Sekme;
  onSekme: (s: Sekme) => void;
  onKapat: () => void;
  genis: boolean;
  onGenis: (g: boolean) => void;
  /** Kayıt değişti: liste tazelensin. */
  onDegisti: () => void;
  /** Kaydedilmemiş not metni (null: temiz); geçişlerde sorulabilsin diye yukarı bildirilir. */
  onNotTaslagi: (metin: string | null) => void;
}) {
  const t = useCeviri();
  const dil = useDil();
  const dosyaRef = useRef<HTMLInputElement>(null);
  /*
    Dar ekran: panel listenin yerini alıyor (CSS 1100 px) ve PDF araç
    çubuğu kompakt kipte çiziliyor. Ölçü JS'te de gerekiyor çünkü
    görüntüleyicinin kipi bir PROP; CSS ile araçları gizlemek onları
    klavyeden de erişilemez kılardı.
  */
  const [dar, setDar] = useState(false);
  useEffect(() => {
    const sorgu = window.matchMedia("(max-width: 1100px)");
    const uygula = () => setDar(sorgu.matches);
    uygula();
    sorgu.addEventListener("change", uygula);
    return () => sorgu.removeEventListener("change", uygula);
  }, []);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [duzenle, setDuzenle] = useState(false);

  const pdf = eslesme && (eslesme.tur === "bagli" || eslesme.tur === "doi") ? eslesme.pdf : null;
  const adres = kaynakBaglantisi(kaynak.doi_or_url);
  const doiMi = /10\.\d{4,9}\//.test(kaynak.doi_or_url ?? "");
  const eksik = eksikAlanlar(kaynak, dil);

  /*
    Kendi PDF'ini yükle: mevcut akışın aynısı (Kaynakça penceresindeki
    kaynak-pdf-satiri.tsx) — dosya öğrencinin KENDİ istemcisiyle çalışma
    klasörüne konur, sonra sunucu satırı yazar. Buradaki tek fark,
    yüklenen dosyanın hemen bu KAYNAĞA bağlanması: panel zaten tek bir
    kaynağa bakıyor, "hangi künyeye ait" sorusu sorulmuyor.
  */
  const pdfYukle = async (dosya: File) => {
    if (!projectId) return;
    if (dosya.size > PDF_EN_FAZLA_BAYT) {
      showToast("error", t({ tr: "PDF 20 MB'tan büyük olamaz.", en: "The PDF can't be larger than 20 MB." }));
      return;
    }
    setYukleniyor(true);
    try {
      const yol = yuklemeYolu(projectId, dosya.name);
      const { error } = await createClient().storage.from("project-files").upload(yol, dosya, { contentType: "application/pdf", upsert: false });
      if (error) {
        showToast("error", t({ tr: "PDF yüklenemedi; tekrar deneyin.", en: "Couldn't upload the PDF; please try again." }));
        return;
      }
      const sonuc = await kaynakPdfiYuklendi(projectId, { kunye: kaynak.title, doi: kaynak.doi_or_url, depoYolu: yol });
      if (sonuc.error || !sonuc.satir) {
        showToast("error", sonuc.error ?? t({ tr: "PDF kaydedilemedi; tekrar deneyin.", en: "Couldn't save the PDF; please try again." }));
        return;
      }
      /* Yüklenen dosya hemen BU kaynağa bağlanır: panel tek bir kayda bakıyor. */
      await pdfKaynaginiBagla({ projectId, pdfId: sonuc.satir.id, kaynakId: kaynak.id }).catch(() => undefined);
      showToast("success", t({ tr: "PDF bu kaynağa bağlandı.", en: "The PDF is now linked to this source." }));
      onDegisti();
    } finally {
      setYukleniyor(false);
    }
  };

  /* Bağlanmamış ama DOI'si tutan dosyayı öğrenci onaylar: sistem kendiliğinden bağlamaz. */
  const dosyayiBagla = async () => {
    if (!projectId || !pdf) return;
    setYukleniyor(true);
    const sonuc = await pdfKaynaginiBagla({ projectId, pdfId: pdf.id, kaynakId: kaynak.id }).catch(() => ({ hata: t({ tr: "Bağlanamadı.", en: "Couldn't link." }) }));
    setYukleniyor(false);
    if ("hata" in sonuc) return showToast("error", sonuc.hata);
    showToast("success", t({ tr: "PDF bu kaynağa bağlandı.", en: "The PDF is now linked to this source." }));
    onDegisti();
  };

  const SEKMELER: { kod: Sekme; ad: Metin }[] = [
    { kod: "pdf", ad: { tr: "PDF", en: "PDF" } },
    { kod: "kunye", ad: { tr: "Künye", en: "Reference" } },
    { kod: "notlar", ad: { tr: "Notlar", en: "Notes" } },
  ];

  return (
    <div className="kaynak-panel-govde">
      {/*
        BAŞLIK. Geniş ekranda panelin ne olduğunu söyleyen genel başlık,
        altında kaynağın adı. DAR ekranda (22.11.2026) yer kazanmak için
        tek satır: doğrudan KAYNAĞIN ADI — "Kaynak önizlemesi" zaten
        apaçık, ad ise hangi kayda bakıldığını söyleyen asıl bilgi.
        Kapatma düğmesi de dar ekranda çizilmiyor: "Kaynaklara dön" ile
        aynı işi yapıyordu, iki ayrı dönüş kontrolü kafa karıştırıyordu.
      */}
      <header className="kaynak-panel-bas">
        {/*
          Dar ekranda dönüş BAŞLIK SATIRINDA (22.11.2026): ayrı bir satır
          olarak ~50 px yer kaplıyor ve PDF'e kalan yüksekliği yiyordu.
          Geniş ekranda gizli; orada dönüş sağdaki "×".
        */}
        <button type="button" className="kaynak-panel-geri" onClick={onKapat}>
          <ArrowLeft size={16} aria-hidden="true" />
          <span>{t({ tr: "Kaynaklar", en: "Sources" })}</span>
        </button>
        <span className="kaynak-panel-simge" aria-hidden="true">
          <FileText size={16} />
        </span>
        <h2 title={htmlVarliklariniCoz(kaynak.title)}>
          <span className="kaynak-panel-genel">{t({ tr: "Kaynak önizlemesi", en: "Source preview" })}</span>
          <span className="kaynak-panel-kisa">{htmlVarliklariniCoz(kaynak.title)}</span>
        </h2>
        <button
          type="button"
          className="yazim-ikon kaynak-panel-boy"
          onClick={() => onGenis(!genis)}
          aria-pressed={genis}
          aria-label={genis ? t({ tr: "Paneli daralt", en: "Collapse panel" }) : t({ tr: "Paneli genişlet", en: "Expand panel" })}
          title={genis ? t({ tr: "Paneli daralt", en: "Collapse panel" }) : t({ tr: "Paneli genişlet", en: "Expand panel" })}
        >
          {genis ? <Minimize2 size={16} aria-hidden="true" /> : <Maximize2 size={16} aria-hidden="true" />}
        </button>
        <button type="button" className="yazim-ikon kaynak-panel-kapat" onClick={onKapat} aria-label={t({ tr: "Paneli kapat", en: "Close panel" })} title={t({ tr: "Paneli kapat", en: "Close panel" })}>
          <X size={16} aria-hidden="true" />
        </button>
      </header>

      <p className="kaynak-panel-ad" title={htmlVarliklariniCoz(kaynak.title)}>
        {htmlVarliklariniCoz(kaynak.title)}
      </p>

      <nav className="kaynak-panel-sekmeler" aria-label={t({ tr: "Kaynak ayrıntıları", en: "Source details" })}>
        {SEKMELER.map((s) => (
          <button key={s.kod} type="button" aria-current={sekme === s.kod ? "page" : undefined} onClick={() => onSekme(s.kod)}>
            {t(s.ad)}
          </button>
        ))}
      </nav>

      <div className="kaynak-panel-ic">
        {sekme === "pdf" ? (
          pdf ? (
            /* Gerçek görüntüleyici; `key` ile PDF değişince sıfırdan kurulur. */
            <PdfGoruntuleyici key={pdf.id} pdfId={pdf.id} onSecim={() => undefined} kompakt={dar} />
          ) : (
            <div className="kaynak-panel-bos">
              <Paperclip size={20} aria-hidden="true" />
              {eslesme?.tur === "belirsiz" ? (
                <>
                  <p>
                    {t({
                      tr: `Bu DOI'yle eşleşen ${eslesme.adaylar.length} dosya var; hangisinin bu kaynak olduğu belli değil. Yanlış makaleyi açmamak için hiçbiri açılmıyor.`,
                      en: `${eslesme.adaylar.length} files match this DOI, and it isn't clear which one is this source. To avoid opening the wrong paper, none is opened.`,
                    })}
                  </p>
                  {projectId ? (
                    <Link href={editorPdfAdresi(projectId, eslesme.adaylar[0].id)} className="projects-filter-button button-compact">
                      <BookOpen size={14} aria-hidden="true" /> {t({ tr: "Dosyaları editörde incele", en: "Review the files in the editor" })}
                    </Link>
                  ) : null}
                </>
              ) : (
                <p>
                  {t({
                    tr: "Bu kaynağa bağlı bir PDF yok. Kendi dosyanızı yükleyin; yüklediğiniz PDF yalnızca bu kaynağa bağlanır.",
                    en: "No PDF is linked to this source. Upload your own file; it will be linked to this source only.",
                  })}
                </p>
              )}
              {projectId ? (
                <>
                  <input
                    ref={dosyaRef}
                    type="file"
                    accept="application/pdf,.pdf"
                    hidden
                    onChange={(e) => {
                      const d = e.target.files?.[0];
                      e.target.value = "";
                      if (d) void pdfYukle(d);
                    }}
                  />
                  <button type="button" className="projects-primary-button button-compact" disabled={yukleniyor} onClick={() => dosyaRef.current?.click()}>
                    {yukleniyor ? <Loader2 size={14} className="spin" aria-hidden="true" /> : <FileUp size={14} aria-hidden="true" />}
                    {yukleniyor ? t({ tr: "Yükleniyor…", en: "Uploading…" }) : t({ tr: "PDF yükle", en: "Upload a PDF" })}
                  </button>
                </>
              ) : (
                <p className="hint">
                  {t({
                    tr: "Bu kaynak bir çalışmaya bağlı değil; PDF yüklemek için önce bir çalışmaya bağlayın.",
                    en: "This source isn't linked to a work; link it to a work first to upload a PDF.",
                  })}
                </p>
              )}
            </div>
          )
        ) : null}

        {sekme === "kunye" ? (
          <div className="kaynak-panel-kunye">
            {eksik.length ? (
              <p className="kaynak-eksik">
                {t({ tr: "Kaynakça için eksik:", en: "Missing for the reference list:" })} {eksik.join(", ")}
              </p>
            ) : null}
            <dl className="kaynak-kunye-liste">
              {ALAN_ADLARI.map(({ anahtar, ad }) => {
                const deger = kaynak[anahtar];
                const yazi = typeof deger === "string" ? htmlVarliklariniCoz(deger).trim() : "";
                return (
                  <div key={String(anahtar)}>
                    <dt>{t(ad)}</dt>
                    {/* Bilinmeyen bilgi UYDURULMAZ: boş alan "—" ile açıkça boş görünür. */}
                    <dd data-bos={yazi ? undefined : "true"}>{yazi || "—"}</dd>
                  </div>
                );
              })}
            </dl>
            <div className="kaynak-panel-eylem">
              {adres ? (
                <a href={adres} className="projects-filter-button button-compact" target="_blank" rel="noreferrer noopener">
                  <Link2 size={14} aria-hidden="true" /> {doiMi ? "DOI" : t({ tr: "Yayın bağlantısı", en: "Publication link" })}
                  <ExternalLink size={12} aria-hidden="true" />
                </a>
              ) : null}
              <button type="button" className="projects-filter-button button-compact" aria-expanded={duzenle} onClick={() => setDuzenle((d) => !d)}>
                {duzenle ? t({ tr: "Düzenlemeyi kapat", en: "Close editing" }) : t({ tr: "Künyeyi düzenle", en: "Edit reference" })}
              </button>
              {/* Dizin önerisi: alanlar yalnızca öğrenci işaretlerse yazılır. */}
              {doiMi ? <KaynakDuzeltme kaynakId={kaynak.id} baslik={kaynak.title} /> : null}
            </div>
            {duzenle ? (
              <ActionForm
                className="project-form-grid mt-sm"
                action={updateLiteratureSource.bind(null, kaynak.id)}
                successMessage={t({ tr: "Künye güncellendi.", en: "Reference updated." })}
              >
                <KunyeAlanlari kaynak={kaynak} />
                {/* Not ayrı sekmede kaydediliyor; burada taşınmıyor ki iki yol birbirini ezmesin. */}
                <input type="hidden" name="notes" value={kaynak.notes ?? ""} />
                <div className="project-form-actions project-form-full">
                  <button type="submit" className="projects-primary-button button-compact">
                    {t({ tr: "Kaydet", en: "Save" })}
                  </button>
                </div>
              </ActionForm>
            ) : null}
          </div>
        ) : null}

        {/* Not sekmesi kapalıyken de MONTAJLI kalıyor: sekme değiştirmek yazılanı atmasın. */}
        <div className="kaynak-panel-not-yuva" hidden={sekme !== "notlar"}>
          <KaynakNotlari kaynakId={kaynak.id} baslangic={kaynak.notes ?? ""} onKaydedildi={onDegisti} onTaslak={onNotTaslagi} />
        </div>
      </div>

      <footer className="kaynak-panel-alt">
        <span className="kaynak-panel-alt-durum" data-ton={pdf ? "tamam" : "notr"}>
          <Paperclip size={13} aria-hidden="true" />
          {pdf
            ? eslesme?.tur === "bagli"
              ? t({ tr: "PDF bağlı", en: "PDF linked" })
              : t({ tr: "PDF DOI ile eşleşti", en: "PDF matched by DOI" })
            : t({ tr: "PDF yok", en: "No PDF" })}
        </span>
        {/* DOI ile eşleşen ama bağlanmamış dosya: bağlamak öğrencinin onayıdır. */}
        {pdf && eslesme?.tur === "doi" && projectId ? (
          <button type="button" className="link-button" disabled={yukleniyor} onClick={() => void dosyayiBagla()}>
            {t({ tr: "Bu kaynağa bağla", en: "Link to this source" })}
          </button>
        ) : null}
        {pdf && projectId ? (
          <Link href={editorPdfAdresi(projectId, pdf.id)} className="link-button">
            <BookOpen size={13} aria-hidden="true" /> {t({ tr: "Editörde aç", en: "Open in the editor" })}
          </Link>
        ) : null}
        {adres ? (
          <a href={adres} className="link-button" target="_blank" rel="noreferrer noopener">
            {doiMi ? "DOI" : t({ tr: "Bağlantı", en: "Link" })} <ExternalLink size={12} aria-hidden="true" />
          </a>
        ) : null}
      </footer>
    </div>
  );
}
