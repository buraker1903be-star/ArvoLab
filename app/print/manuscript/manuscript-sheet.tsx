import type { PrintSheet } from "@/lib/print-sheet";
import { ceviriciKur, YEREL, type Dil } from "@/lib/dil";

// A4 baskı görünümü: kapak, metin ve dipnotlar (yazdırma ve paylaşım sayfaları ortak kullanır).
// `dil` BELGENİN dili (lib/belge-dili.ts): kapaktaki "Danışman", içindekiler ve
// dipnot başlıkları çalışmanın parçası, Word çıktısıyla aynı dilde olmalı.
export default function ManuscriptSheet({ title, sheet, dil = "tr" }: { title: string; sheet: PrintSheet; dil?: Dil }) {
  const { cover } = sheet;
  const t = ceviriciKur(dil);
  const buyuk = (metin: string) => metin.toLocaleUpperCase(YEREL[dil]);
  return (
    <>
      {/* Sayfalama çalışınca bu kural kaldırılır; sayfa kuralını Paged.js uygular (sayfali-baski.tsx). */}
      <style id="sayfa-kurali">{sheet.pageRule}</style>
      <article className="print-sheet" style={sheet.style} aria-label={title} data-chapter-case={sheet.chapterCase}>
        {cover ? (
          <section className="print-cover">
            <div className="print-cover-block">
              {cover.university ? <strong>{buyuk(cover.university)}</strong> : null}
              {cover.institute ? <strong>{buyuk(cover.institute)}</strong> : null}
              {cover.department ? <span>{buyuk(cover.department)}</span> : null}
              {cover.program ? <span>{cover.program}</span> : null}
            </div>
            <div className="print-cover-block">
              <strong className="print-cover-title">{buyuk(cover.title)}</strong>
            </div>
            <div className="print-cover-block">
              <strong>{cover.authorName}</strong>
              <span>{cover.degreeType}</span>
              {cover.advisorName ? <span>{t({ tr: "Danışman", en: "Advisor" })}: {cover.advisorName}</span> : null}
            </div>
            <div className="print-cover-block">
              <strong>{[cover.city, cover.year].filter(Boolean).join(", ")}</strong>
            </div>
          </section>
        ) : null}

        {sheet.toc && sheet.toc.length ? (
          <section className="print-toc" aria-label={t({ tr: "İçindekiler", en: "Table of contents" })}>
            <h2>{t({ tr: "İÇİNDEKİLER", en: "TABLE OF CONTENTS" })}</h2>
            <ol>
              {sheet.toc.map((satir, i) => (
                <li key={i} data-level={satir.level}>
                  {/* Bağlantı başlığa gider; sayfalı baskıda sayfa numarası buradan sayılır (target-counter). */}
                  <a href={`#bas-${i}`} data-toc-index={i} data-baslik={satir.text}>
                    {satir.numara ? <span className="print-toc-no">{satir.numara}</span> : null}
                    <span className="print-toc-metin">{satir.text}</span>
                    {/* Word'ün içindekiler satırındaki noktalı çizgi; numara ondan sonra (target-counter). */}
                    <span className="print-toc-noktalar" aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {sheet.hasText ? (
          <div className="print-body" dangerouslySetInnerHTML={{ __html: sheet.html }} />
        ) : (
          <p>{t({ tr: "Bu çalışma için henüz kaydedilmiş bir metin yok.", en: "There is no saved text for this work yet." })}</p>
        )}

        {sheet.footnotes.length > 0 ? (
          <section className="print-footnotes">
            <h2>{t({ tr: "Dipnotlar", en: "Footnotes" })}</h2>
            <ol>
              {sheet.footnotes.map((text, index) => (
                <li key={index}>{text}</li>
              ))}
            </ol>
          </section>
        ) : null}
      </article>
    </>
  );
}
