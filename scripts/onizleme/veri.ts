/*
  Önizlemenin örnek verisi (sahte-istemci.ts). Gerçek bir öğrencinin
  tezine benzer: Dokuz Eylül'de bir bitirme tezi, ~6.000 sözcüklük
  müsvedde (tests/fixtures/tez-enflasyon-issizlik.json), birkaç kaynak ve
  bir kaynakça denetimi. Kişisel veri yok; adlar uydurma.
*/
import tez from "@/tests/fixtures/tez-enflasyon-issizlik.json";

const KULLANICI = "00000000-0000-4000-8000-0000000000a1";
const PROJE = "00000000-0000-4000-8000-0000000000b1";
const PROJE2 = "00000000-0000-4000-8000-0000000000b2";
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
  citation_checks: [{ id: "c1", project_id: PROJE, compliance_score: 94, created_at: new Date(Date.now() - 17 * 60_000).toISOString() }],
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
