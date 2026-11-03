/*
  Önizlemenin örnek verisi (sahte-istemci.ts). Gerçek bir öğrencinin
  tezine benzer: Dokuz Eylül'de bir bitirme tezi, ~6.000 sözcüklük
  müsvedde (tests/fixtures/tez-enflasyon-issizlik.json), birkaç kaynak ve
  bir kaynakça denetimi. Kişisel veri yok; adlar uydurma.
*/
import tez from "@/tests/fixtures/tez-enflasyon-issizlik.json";
import { kunyeleriAyristir } from "@/lib/atif/kunye";

const KULLANICI = "00000000-0000-4000-8000-0000000000a1";
const PROJE = "00000000-0000-4000-8000-0000000000b1";
const PROJE2 = "00000000-0000-4000-8000-0000000000b2";
const ORNEK_KUNYELER = [
  "Önder, A. Ö. (2009). Türkiye'de Phillips eğrisinin istikrarı. İktisat İşletme ve Finans, 24(280), 9-27.",
  "Pesaran, M. H., Shin, Y., & Smith, R. J. (2001). Bounds testing approaches to the analysis of level relationships. Journal of Applied Econometrics, 16(3), 289-326.",
  "Smith, J., & Brown, K. (2019). Inflation and unemployment in emerging markets. Economic Review, 12(2), 45-60.",
  "Kaya, M. (2021). Enflasyon ve işsizlik ilişkisi üzerine bir inceleme",
];
const gunOnce = (g: number) => new Date(Date.now() - g * 86_400_000).toISOString();

export const ORNEK_KULLANICI = { id: KULLANICI, email: "ogrenci@ornek.edu.tr", user_metadata: { full_name: "Deniz Yıldız" } };

export const ORNEK: Record<string, Record<string, unknown>[]> = {
  profiles: [{ id: KULLANICI, full_name: "Deniz Yıldız", role: "client", organization_id: null, silme_talebi_at: null, email: "ogrenci@ornek.edu.tr" }],
  academic_projects: [
    {
      id: PROJE, owner_id: KULLANICI, organization_id: null, assignee_id: null, guideline_id: null,
      title: "TÜRKİYE'DE ENFLASYON VE İŞSİZLİK İLİŞKİSİNİN EKONOMETRİK ANALİZİ (2000–2025)",
      project_type: "thesis", university: "Dokuz Eylül Üniversitesi", institute: "Sosyal Bilimler Enstitüsü", department: "Ekonometri",
      citation_style: "apa7", research_method: "quantitative", assignee_name: null, due_date: new Date(Date.now() + 41 * 86_400_000).toISOString().slice(0, 10),
      priority: "normal", status: "writing", notes: null, progress: 55, controller_approved_by: null, controller_approved_at: null,
      created_at: gunOnce(40), updated_at: gunOnce(0),
    },
    {
      id: PROJE2, owner_id: KULLANICI, organization_id: null, assignee_id: null, guideline_id: null,
      title: "Öğrenci öğretmen farkı", project_type: "article", university: null, institute: null, department: null,
      citation_style: "apa7", research_method: null, assignee_name: null, due_date: null, priority: "normal", status: "new",
      notes: null, progress: 0, controller_approved_by: null, controller_approved_at: null, created_at: gunOnce(60), updated_at: gunOnce(20),
    },
  ],
  project_manuscripts: [
    {
      project_id: PROJE, content: tez, word_count: 6172, updated_at: gunOnce(0), page_size: "A4",
      margin_top_cm: 2.5, margin_bottom_cm: 2.5, margin_left_cm: 3, margin_right_cm: 2.5,
    },
  ],
  literature_sources: [
    { id: "l1", project_id: PROJE, owner_id: KULLANICI, title: "Türkiye'de Phillips eğrisinin istikrarı", authors: "Önder, A. Ö.", year: "2009", status: "used", source_type: "article", created_at: gunOnce(10) },
    { id: "l2", project_id: PROJE, owner_id: KULLANICI, title: "Inflation and unemployment in emerging markets", authors: "Smith, J., & Brown, K.", year: "2019", status: "read", source_type: "article", created_at: gunOnce(8) },
    { id: "l3", project_id: PROJE, owner_id: KULLANICI, title: "ARDL sınır testi yaklaşımı", authors: "Pesaran, M. H., Shin, Y., & Smith, R. J.", year: "2001", status: "to_review", source_type: "article", created_at: gunOnce(3) },
  ],
  citation_checks: [
    {
      id: "c1",
      project_id: PROJE,
      compliance_score: 94,
      created_at: new Date(Date.now() - 17 * 60_000).toISOString(),
      parsed_references: kunyeleriAyristir(ORNEK_KUNYELER, "apa7"),
      in_text_citations: [{ raw: "(Önder, 2009)" }, { raw: "(Pesaran vd., 2001)" }, { raw: "(Yılmaz, 2018)" }],
      academic_projects: { citation_style: "apa7" },
      cross_check: {
        citationsWithoutReference: [{ raw: "(Yılmaz, 2018)" }],
        referencesWithoutCitation: [{ raw: ORNEK_KUNYELER[2] }],
        academicVerification: [
          { reference: ORNEK_KUNYELER[0], status: "verified", googleScholarUrl: "https://scholar.google.com/", matches: [], bestMatch: { provider: "crossref", title: "Türkiye'de Phillips eğrisinin istikrarı", year: 2009, doi: "10.0000/ornek.1", authors: ["A. Ö. Önder"], venue: "İktisat İşletme ve Finans", url: "https://doi.org/10.0000/ornek.1", citedByCount: 12, confidence: 0.96 } },
          { reference: ORNEK_KUNYELER[1], status: "verified", googleScholarUrl: "https://scholar.google.com/", matches: [], bestMatch: { provider: "openalex", title: "Bounds testing approaches to the analysis of level relationships", year: 2001, doi: "10.0000/ornek.2", authors: ["M. H. Pesaran"], venue: "Journal of Applied Econometrics", url: "https://doi.org/10.0000/ornek.2", citedByCount: 9000, confidence: 0.98 } },
          { reference: ORNEK_KUNYELER[2], status: "possible_match", googleScholarUrl: "https://scholar.google.com/", matches: [], bestMatch: { provider: "crossref", title: "Inflation and unemployment in emerging markets", year: 2019, doi: null, authors: ["J. Smith"], venue: null, url: "https://example.org/", citedByCount: null, confidence: 0.71 } },
          { reference: ORNEK_KUNYELER[3], status: "not_found", googleScholarUrl: "https://scholar.google.com/", matches: [], bestMatch: null },
        ],
        verificationSummary: { verified: 2, possible: 1, notFound: 1, insufficientData: 0 },
        tyk: null,
        ornekAtif: null,
      },
    },
  ],
  manuscript_comments: [],
  manuscript_share_links: [],
  kanit_kayitlari: [],
  calisma_takvimi: [],
  calisma_kilavuzu: [],
  thesis_guidelines: [],
  etik_kurul: [],
  consultancy_requests: [],
  app_support_requests: [],
  organizations: [],
};

export const ORNEK_RPC: Record<string, unknown> = {
  ai_kredi_durumum: { kullanilan_karakter: 182_000, limit_kredi: 500, aylik_kalan: 318, ek_bakiye: 0, bildirildi: true, ic_ekip: false, bireysel: true },
};
