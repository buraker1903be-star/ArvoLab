import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getManuscript } from "@/app/actions/manuscript";
import { loadAppliedGuideline } from "@/lib/guideline-rules";
import { renderTiptapHtml } from "@/lib/tiptap-html";
import PrintActions from "./print-actions";

export const metadata: Metadata = { title: "Yazdır · ArvoLab", robots: { index: false } };

const clampCm = (value: unknown, fallback: number) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 10 ? number : fallback;
};

// Yazdırmaya hazır A4 görünümü: kılavuzun yazı tipi, boyutu, satır aralığı ve
// metnin kenar boşlukları; tarayıcının yazdır penceresinden "PDF olarak kaydet".
export default async function PrintManuscriptPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ auto?: string }>;
}) {
  const [{ id }, { auto }] = await Promise.all([params, searchParams]);
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("academic_projects")
    .select("id, title, guideline_id")
    .eq("id", id)
    .maybeSingle();
  if (!project) notFound();

  const [manuscript, guideline] = await Promise.all([getManuscript(id), loadAppliedGuideline(supabase, project.guideline_id)]);
  const { html, footnotes } = renderTiptapHtml(manuscript?.content);

  const margins = manuscript?.margins ?? guideline?.settings.margins ?? { top: 2.5, bottom: 2.5, left: 2.5, right: 2.5 };
  const m = {
    top: clampCm(margins.top, 2.5),
    right: clampCm(margins.right, 2.5),
    bottom: clampCm(margins.bottom, 2.5),
    left: clampCm(margins.left, 2.5),
  };
  const fontFamily = guideline?.settings.fontFamily ?? "Times New Roman";
  const fontSize = guideline?.settings.fontSizePt ?? 12;
  const lineSpacing = guideline?.settings.lineSpacing ?? 1.5;
  const showPageNumbers = manuscript?.showPageNumbers ?? true;
  const cover = manuscript?.coverPage ?? null;

  const pageRule = `@page { size: A4; margin: ${m.top}cm ${m.right}cm ${m.bottom}cm ${m.left}cm;${
    showPageNumbers ? " @bottom-center { content: counter(page); font-size: 10pt; }" : ""
  } }`;

  const sheetStyle = {
    "--print-font": `'${fontFamily}', 'Times New Roman', serif`,
    "--print-size": `${fontSize}pt`,
    "--print-line": String(lineSpacing),
    "--print-margin-top": `${m.top}cm`,
    "--print-margin-right": `${m.right}cm`,
    "--print-margin-bottom": `${m.bottom}cm`,
    "--print-margin-left": `${m.left}cm`,
  } as CSSProperties;

  return (
    <div className="print-page">
      <style>{pageRule}</style>
      <PrintActions backHref={`/dashboard/editor/${id}/write`} autoPrint={auto === "1"} />

      <article className="print-sheet" style={sheetStyle} aria-label={project.title}>
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

        {manuscript ? (
          <div className="print-body" dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <p>Bu çalışma için henüz kaydedilmiş bir metin yok.</p>
        )}

        {footnotes.length > 0 ? (
          <section className="print-footnotes">
            <h2>Dipnotlar</h2>
            <ol>
              {footnotes.map((text, index) => (
                <li key={index}>{text}</li>
              ))}
            </ol>
          </section>
        ) : null}
      </article>
    </div>
  );
}
