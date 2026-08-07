import { createHash } from "node:crypto";
import { PDFParse } from "pdf-parse";

const CANDIDATE_SECTIONS = [
  "Özet", "Abstract", "Giriş", "Problem Durumu", "Araştırmanın Amacı",
  "Araştırmanın Önemi", "Yöntem", "Gereç ve Yöntem", "Evren ve Örneklem",
  "Veri Toplama", "Bulgular", "Tartışma", "Sonuç", "Sonuç ve Öneriler",
  "Kaynakça", "Ekler", "Özgeçmiş",
];

export interface GuidelineRuleExtraction {
  documentTitle: string | null;
  universityName: string | null;
  academicUnitName: string | null;
  versionLabel: string | null;
  publicationDate: string | null;
  citationStyle: "apa7" | "vancouver" | "chicago" | "ieee" | "other" | "unknown";
  requiredSections: string[];
  pageLayout: {
    pageSize: string | null;
    marginsCm: { top: number | null; right: number | null; bottom: number | null; left: number | null };
  };
  typography: {
    fontFamily: string | null;
    bodyFontSizePt: number | null;
    lineSpacing: number | null;
    paragraphFirstLineCm: number | null;
  };
  headingRules: string[];
  tableRules: string[];
  figureRules: string[];
  paginationRules: string[];
  bindingAndSubmissionRules: string[];
  unresolvedItems: string[];
  evidenceNotes: string[];
}

export interface GuidelineScanResult {
  textPreview: string;
  fullTextLength: number;
  suggestedSections: string[];
  detectedCitationHint: string | null;
  sourceChecksum: string;
  sourceContentType: string;
  aiModel: string | null;
  aiExtraction: GuidelineRuleExtraction | null;
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function responseOutputText(payload: unknown): string {
  const body = payload as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> };
  if (body.output_text) return body.output_text;
  return body.output?.flatMap((item) => item.content ?? []).map((item) => item.text ?? "").join("") ?? "";
}

async function extractRulesWithOpenAI(text: string): Promise<{ model: string; extraction: GuidelineRuleExtraction } | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.OPENAI_GUIDELINE_MODEL || "gpt-5-mini";
  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["documentTitle", "universityName", "academicUnitName", "versionLabel", "publicationDate", "citationStyle", "requiredSections", "pageLayout", "typography", "headingRules", "tableRules", "figureRules", "paginationRules", "bindingAndSubmissionRules", "unresolvedItems", "evidenceNotes"],
    properties: {
      documentTitle: { type: ["string", "null"] },
      universityName: { type: ["string", "null"] },
      academicUnitName: { type: ["string", "null"] },
      versionLabel: { type: ["string", "null"] },
      publicationDate: { type: ["string", "null"] },
      citationStyle: { type: "string", enum: ["apa7", "vancouver", "chicago", "ieee", "other", "unknown"] },
      requiredSections: { type: "array", items: { type: "string" } },
      pageLayout: {
        type: "object", additionalProperties: false, required: ["pageSize", "marginsCm"],
        properties: {
          pageSize: { type: ["string", "null"] },
          marginsCm: {
            type: "object", additionalProperties: false, required: ["top", "right", "bottom", "left"],
            properties: { top: { type: ["number", "null"] }, right: { type: ["number", "null"] }, bottom: { type: ["number", "null"] }, left: { type: ["number", "null"] } }
          }
        }
      },
      typography: {
        type: "object", additionalProperties: false, required: ["fontFamily", "bodyFontSizePt", "lineSpacing", "paragraphFirstLineCm"],
        properties: { fontFamily: { type: ["string", "null"] }, bodyFontSizePt: { type: ["number", "null"] }, lineSpacing: { type: ["number", "null"] }, paragraphFirstLineCm: { type: ["number", "null"] } }
      },
      headingRules: { type: "array", items: { type: "string" } },
      tableRules: { type: "array", items: { type: "string" } },
      figureRules: { type: "array", items: { type: "string" } },
      paginationRules: { type: "array", items: { type: "string" } },
      bindingAndSubmissionRules: { type: "array", items: { type: "string" } },
      unresolvedItems: { type: "array", items: { type: "string" } },
      evidenceNotes: { type: "array", items: { type: "string" } }
    }
  };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      input: [
        { role: "system", content: "Resmî tez yazım kılavuzundan yalnızca açıkça desteklenen biçimsel kuralları çıkar. Tahmin etme. Belirsiz noktaları unresolvedItems alanına yaz. Türkçe yanıt ver." },
        { role: "user", content: text.slice(0, 100000) }
      ],
      text: { format: { type: "json_schema", name: "thesis_guideline_rules", strict: true, schema } }
    })
  });

  if (!response.ok) throw new Error(`OpenAI kılavuz analizi başarısız (HTTP ${response.status}).`);
  const payload = await response.json();
  const output = responseOutputText(payload);
  if (!output) throw new Error("OpenAI yapılandırılmış çıktı üretmedi.");
  return { model, extraction: JSON.parse(output) as GuidelineRuleExtraction };
}

export async function scanGuidelineUrl(url: string): Promise<GuidelineScanResult> {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (ArvoLab Kılavuz Tarayıcı)" } });
  if (!res.ok) throw new Error(`Kaynak alınamadı (HTTP ${res.status}).`);

  const contentType = res.headers.get("content-type") ?? "";
  let text: string;
  if (contentType.includes("pdf") || url.toLowerCase().endsWith(".pdf")) {
    const parser = new PDFParse({ data: Buffer.from(await res.arrayBuffer()) });
    try { text = (await parser.getText()).text; } finally { await parser.destroy(); }
  } else {
    text = stripHtml(await res.text());
  }

  const suggestedSections = CANDIDATE_SECTIONS.filter((section) =>
    new RegExp(`(^|\\n)\\s*\\d*[.)]?\\s*${section}(?![\\p{L}\\p{N}])`, "iu").test(text)
  );
  const citationHint = /apa\s*7|apa7/i.test(text) ? "APA 7" : /vancouver/i.test(text) ? "Vancouver" : /chicago/i.test(text) ? "Chicago" : /ieee/i.test(text) ? "IEEE" : null;
  const ai = await extractRulesWithOpenAI(text);

  return {
    textPreview: text.slice(0, 4000),
    fullTextLength: text.length,
    suggestedSections,
    detectedCitationHint: citationHint,
    sourceChecksum: createHash("sha256").update(text).digest("hex"),
    sourceContentType: contentType || "unknown",
    aiModel: ai?.model ?? null,
    aiExtraction: ai?.extraction ?? null,
  };
}
