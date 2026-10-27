import type { PrintSheet } from "@/lib/print-sheet";

// A4 baskı görünümü: kapak, metin ve dipnotlar (yazdırma ve paylaşım sayfaları ortak kullanır).
export default function ManuscriptSheet({ title, sheet }: { title: string; sheet: PrintSheet }) {
  const { cover } = sheet;
  return (
    <>
      {/* Sayfalama çalışınca bu kural kaldırılır; sayfa kuralını Paged.js uygular (sayfali-baski.tsx). */}
      <style id="sayfa-kurali">{sheet.pageRule}</style>
      <article className="print-sheet" style={sheet.style} aria-label={title} data-chapter-case={sheet.chapterCase}>
        {cover ? (
          <section className="print-cover">
            <div className="print-cover-block">
              {cover.university ? <strong>{cover.university.toLocaleUpperCase("tr-TR")}</strong> : null}
              {cover.institute ? <strong>{cover.institute.toLocaleUpperCase("tr-TR")}</strong> : null}
              {cover.department ? <span>{cover.department.toLocaleUpperCase("tr-TR")}</span> : null}
              {cover.program ? <span>{cover.program}</span> : null}
            </div>
            <div className="print-cover-block">
              <strong className="print-cover-title">{cover.title.toLocaleUpperCase("tr-TR")}</strong>
            </div>
            <div className="print-cover-block">
              <strong>{cover.authorName}</strong>
              <span>{cover.degreeType}</span>
              {cover.advisorName ? <span>Danışman: {cover.advisorName}</span> : null}
            </div>
            <div className="print-cover-block">
              <strong>{[cover.city, cover.year].filter(Boolean).join(", ")}</strong>
            </div>
          </section>
        ) : null}

        {sheet.toc && sheet.toc.length ? (
          <section className="print-toc" aria-label="İçindekiler">
            <h2>İÇİNDEKİLER</h2>
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
          <p>Bu çalışma için henüz kaydedilmiş bir metin yok.</p>
        )}

        {sheet.footnotes.length > 0 ? (
          <section className="print-footnotes">
            <h2>Dipnotlar</h2>
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
