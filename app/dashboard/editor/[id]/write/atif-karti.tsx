"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { FileText, Quote, ShieldCheck, Sparkles, Target, X, SearchCheck } from "lucide-react";
import { acilacakPdf, kaynakDurumlari, kaynakKaydiAdresi, type DurumSatiri, type PdfEslesmesi } from "@/lib/kaynak-durumu";
import { useCeviri } from "@/app/_components/dil-saglayici";
import type { KunyeDurumOzeti } from "@/app/actions/kaynak-pdf";
import type { LiteratureSource } from "@/app/actions/literature";
import type { AtifIsabeti } from "@/lib/atif-karti";

/*
  ATIF KARTI VE SEÇİM İŞLEMLERİ (19.11.2026; K3-A, onaylı 2. tur tasarımı,
  madde 2 ve 5). İki AYRI etkileşim durumu, aynı anda açılmaz:
    A. Seçim işlemleri: metin seçiliyken (Arvo AI'a sor, Dayanak bul, Atıf ekle).
    B. Atıf kartı: düz metin atfa tıklanınca.
  İkisi de kâğıdın DIŞINDA, satırın hizasında; yer yoksa satırın altında
  (lib/atif-karti.ts kartKonumu). Okunan cümle örtülmez.

  GÜVEN DURUMLARI AYRI (madde 5; lib/kanit/durum.ts ile aynı ayrım):
    Künye — kanıt matrisindeki gerçek dizin denetimi (Crossref/OpenAlex),
    PDF — açılabilir bir dosya var mı (K2 bağı ya da tek DOI eşleşmesi),
    Alıntı — bu oturumda PDF metnine karşı doğrulanıp eklenmiş pasaj.
  Üçü ayrı kontroldür; hiçbiri iddianın desteklendiği anlamına gelmez.

  20.11.2026 (M9): durumların kuralı lib/kaynak-durumu.ts'e taşındı
  (Kaynaklar aracı ve Kaynaklar sayfası da oradan okuyor). Eskiden kart
  DOI'si tutan BAĞLANMAMIŞ bir PDF'i de "Açılabilir" diye onay tonunda
  gösteriyordu; şimdi "DOI ile eşleşti" uyarı tonunda, aynı DOI'deki
  birden çok PDF de "belirsiz" diye yazılıyor ve açılmıyor. Kart önce
  üç durumu tek satırda özetler; açıklamalar "Ayrıntılar"da. "Kaynak
  kaydı" artık o kaydın kendisine gidiyor (?kaynak=), listeye değil.

  "Dayanağa git" YALNIZCA ilgili PDF için doğrulanmış sayfa ve metin
  bilgisi varsa çıkar. Bu bilgi bu sürümde KALICI DEĞİL (K3-ek onaylı
  değil): PDF panelinden doğrulanmış alıntıyla atıf eklendiği oturumda
  bellekte tutulur; sayfa yenilenince yalnızca "PDF'i aç" kalır.
*/

export type DogrulanmisPasaj = { kaynakId: string; pdfId: string; sayfa: number; metin: string };

export type AtifKartiDurumu = {
  isabet: AtifIsabeti;
  adaylar: string[];
  secilen: string | null;
  konum: { yan: "sag" | "alt"; x: number; y: number };
};


export function AtifKarti({
  durum,
  projectId,
  kaynaklar,
  pdfBul,
  kunye,
  pasajlar,
  yukleniyor,
  onSec,
  onKapat,
  onPdfAc,
  onDayanagaGit,
  onKaynaklariAc,
}: {
  durum: AtifKartiDurumu;
  projectId: string;
  kaynaklar: LiteratureSource[];
  pdfBul: (kaynak: LiteratureSource) => PdfEslesmesi;
  kunye: Map<string, KunyeDurumOzeti>;
  pasajlar: DogrulanmisPasaj[];
  yukleniyor: boolean;
  onSec: (kaynakId: string) => void;
  onKapat: () => void;
  onPdfAc: (pdfId: string) => void;
  onDayanagaGit: (pasaj: DogrulanmisPasaj) => void;
  onKaynaklariAc: () => void;
}) {
  const t = useCeviri();
  const kartRef = useRef<HTMLElement>(null);
  /* Konum DOM API'siyle (TSX'te satır içi stil yok). */
  useEffect(() => {
    kartRef.current?.style.setProperty("--kart-x", `${durum.konum.x}px`);
    kartRef.current?.style.setProperty("--kart-y", `${durum.konum.y}px`);
  }, [durum.konum.x, durum.konum.y]);

  const kaynak = durum.secilen ? kaynaklar.find((k) => k.id === durum.secilen) ?? null : null;
  const eslesme: PdfEslesmesi = kaynak ? pdfBul(kaynak) : { tur: "yok" };
  const pdf = acilacakPdf(eslesme);
  const kunyeDurumu = kaynak ? kunye.get(kaynak.id) ?? null : null;
  const kaynakPasajlari = kaynak ? pasajlar.filter((p) => p.kaynakId === kaynak.id && (!pdf || p.pdfId === pdf.id)) : [];
  const durumlar = kaynak ? kaynakDurumlari({ kunye: kunyeDurumu, pdf: eslesme, alintiSayfasi: kaynakPasajlari[0]?.sayfa ?? null }) : [];

  return (
    <aside
      ref={kartRef}
      className="atif-karti"
      data-yan={durum.konum.yan}
      role="dialog"
      aria-label={t({ tr: "Atıf kartı", en: "Citation card" })}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onKapat();
        }
      }}
    >
      <header className="atif-karti-bas">
        <span className="atif-karti-atif">
          <Quote size={14} aria-hidden="true" /> {durum.isabet.metin}
        </span>
        <button type="button" className="yazim-ikon" onClick={onKapat} aria-label={t({ tr: "Kartı kapat", en: "Close card" })}>
          <X size={14} aria-hidden="true" />
        </button>
      </header>

      {yukleniyor ? (
        <p className="atif-karti-not" role="status">{t({ tr: "Kaynaklarla eşleştiriliyor…", en: "Matching with sources…" })}</p>
      ) : durum.adaylar.length === 0 ? (
        <>
          <p className="atif-karti-not">
            {durum.isabet.tur === "numara"
              ? t({
                  tr: "Bu numara belgedeki kaynakçada bir girdiyle ya da çalışmanın kaynaklarından biriyle eşleşmedi.",
                  en: "This number didn't match an entry in the document's reference list or one of the work's sources.",
                })
              : t({
                  tr: "Bu atıf çalışmanın kaynaklarından biriyle eşleşmedi (yazar soyadı ve yıl). Hiçbir kaynak ya da pasaj seçilmedi.",
                  en: "This citation didn't match one of the work's sources (author surname and year). No source or passage was selected.",
                })}
          </p>
          <div className="atif-karti-eylem">
            <button type="button" className="projects-filter-button button-compact" onClick={onKaynaklariAc}>
              {t({ tr: "Kaynakları aç", en: "Open sources" })}
            </button>
          </div>
        </>
      ) : !kaynak ? (
        <fieldset className="atif-karti-adaylar">
          <legend>{t({ tr: "Birden çok kaynak eşleşti. Hangisi?", en: "Several sources match. Which one?" })}</legend>
          {durum.adaylar.map((id) => {
            const k = kaynaklar.find((x) => x.id === id);
            return k ? (
              <button key={id} type="button" className="atif-karti-aday" onClick={() => onSec(id)}>
                <b>{[k.authors, k.year ? `(${k.year})` : null].filter(Boolean).join(" ")}</b>
                <span>{k.title}</span>
              </button>
            ) : null;
          })}
        </fieldset>
      ) : (
        <>
          <p className="atif-karti-kaynak">
            <b>{[kaynak.authors, kaynak.year ? `(${kaynak.year})` : null].filter(Boolean).join(" ")}</b>
            <span>{kaynak.title}</span>
          </p>
          {/* Kısa özet: üç durum tek satırda; ayrıntı ikinci adımda. Belirsiz olan hiçbir zaman onay tonunda değil. */}
          <ul className="atif-karti-ozet" aria-label={t({ tr: "Kaynağın durumu", en: "Source status" })}>
            {durumlar.map((d) => (
              <li key={d.anahtar}>
                <span className="guven-cip" data-tur={cipTuru(d)}>
                  <DurumSimgesi d={d} /> {t(d.kisa)}
                </span>
              </li>
            ))}
          </ul>
          <details className="atif-karti-ayrinti">
            <summary>{t({ tr: "Ayrıntılar", en: "Details" })}</summary>
            <dl className="atif-karti-durumlar">
              {durumlar.map((d) => (
                <div key={d.anahtar}>
                  <dt>{t(d.ad)}</dt>
                  <dd>{t(d.aciklama)}</dd>
                </div>
              ))}
            </dl>
          </details>
          <p className="atif-karti-uyari">
            {t({
              tr: "Üçü ayrı kontroldür; hiçbiri iddianın desteklendiği anlamına gelmez.",
              en: "These are three separate checks; none of them means the claim is supported.",
            })}
          </p>
          <div className="atif-karti-eylem">
            {kaynakPasajlari.length ? (
              kaynakPasajlari.slice(0, 3).map((p, i) => (
                <button key={`${p.pdfId}-${p.sayfa}-${i}`} type="button" className="projects-primary-button button-compact" onClick={() => onDayanagaGit(p)}>
                  <Target size={14} aria-hidden="true" /> {t({ tr: `Dayanağa git · s. ${p.sayfa}`, en: `Go to support · p. ${p.sayfa}` })}
                </button>
              ))
            ) : pdf ? (
              <button type="button" className="projects-primary-button button-compact" onClick={() => onPdfAc(pdf.id)}>
                <FileText size={14} aria-hidden="true" /> {t({ tr: "PDF'i aç", en: "Open PDF" })}
              </button>
            ) : null}
            <Link href={kaynakKaydiAdresi(projectId, kaynak.id)} className="projects-filter-button button-compact">
              {t({ tr: "Kaynak kaydı", en: "Source record" })}
            </Link>
          </div>
        </>
      )}
    </aside>
  );
}

const cipTuru = (d: DurumSatiri) =>
  d.ton === "uyari" ? "uyari" : d.ton === "notr" ? "notr" : d.anahtar === "kayit" ? "kunye" : d.anahtar === "pdf" ? "erisim" : "alinti";

function DurumSimgesi({ d }: { d: DurumSatiri }) {
  if (d.anahtar === "kayit") return <ShieldCheck size={12} aria-hidden="true" />;
  if (d.anahtar === "pdf") return <FileText size={12} aria-hidden="true" />;
  return <Quote size={12} aria-hidden="true" />;
}

export function SecimIslemleri({
  konum,
  onAi,
  onDayanak,
  onAtif,
}: {
  konum: { yan: "sag" | "alt"; x: number; y: number };
  onAi: () => void;
  onDayanak: () => void;
  onAtif: () => void;
}) {
  const t = useCeviri();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.style.setProperty("--kart-x", `${konum.x}px`);
    ref.current?.style.setProperty("--kart-y", `${konum.y}px`);
  }, [konum.x, konum.y]);
  /* Düğmeye basmak seçimi düşürmesin: odak editörde kalır, işlem seçimi okur. */
  const tut = (e: React.MouseEvent) => e.preventDefault();
  return (
    <div ref={ref} className="secim-islemleri" data-yan={konum.yan} role="toolbar" aria-label={t({ tr: "Seçim işlemleri", en: "Selection actions" })}>
      <button type="button" onMouseDown={tut} onClick={onAi}>
        <Sparkles size={14} aria-hidden="true" /> {t({ tr: "Arvo AI'a sor", en: "Ask Arvo AI" })}
      </button>
      <button type="button" onMouseDown={tut} onClick={onDayanak}>
        <SearchCheck size={14} aria-hidden="true" /> {t({ tr: "Dayanak bul", en: "Find support" })}
      </button>
      <button type="button" onMouseDown={tut} onClick={onAtif}>
        <Quote size={14} aria-hidden="true" /> {t({ tr: "Atıf ekle", en: "Cite" })}
      </button>
    </div>
  );
}
