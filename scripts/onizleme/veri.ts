/*
  Önizlemenin örnek verisi (sahte-istemci.ts). Gerçek bir öğrencinin
  tezine benzer: Dokuz Eylül'de bir bitirme tezi, ~6.000 sözcüklük
  müsvedde (tests/fixtures/tez-enflasyon-issizlik.json), birkaç kaynak ve
  bir kaynakça denetimi. Kişisel veri yok; adlar uydurma.
*/
import tez from "@/tests/fixtures/tez-enflasyon-issizlik.json";
import { kunyeleriAyristir } from "@/lib/atif/kunye";
import { kunyeAnahtari } from "@/lib/kaynak-pdf";

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
      /* plain_text: Kaynaklar'ın "metinde atıf" bilgisi buradan okunur (4.2). */
      plain_text: "Giriş\nKısa dönemde enflasyon ile işsizlik ters yönlüdür (Önder, 2009). Sınır testi yaklaşımı kullanılmıştır (Pesaran vd., 2001).\nKaynakça\nÖnder, A. Ö. (2009). Türkiye'de Phillips eğrisinin istikrarı.\n",
      project_id: PROJE, content: tez, word_count: 6172, updated_at: gunOnce(0), page_size: "A4",
      margin_top_cm: 2.5, margin_bottom_cm: 2.5, margin_left_cm: 3, margin_right_cm: 2.5,
    },
  ],
  literature_sources: [
    { id: "l1", project_id: PROJE, owner_id: KULLANICI, title: "Türkiye'de Phillips eğrisinin istikrarı", authors: "Önder, A. Ö.", year: "2009", status: "used", source_type: "article", created_at: gunOnce(10) },
    { id: "l2", project_id: PROJE, owner_id: KULLANICI, title: "Inflation and unemployment in emerging markets", authors: "Smith, J., & Brown, K.", year: "2019", status: "read", source_type: "article", created_at: gunOnce(8) },
    { id: "l3", project_id: PROJE, owner_id: KULLANICI, title: "ARDL sınır testi yaklaşımı", authors: "Pesaran, M. H., Shin, Y., & Smith, R. J.", year: "2001", status: "to_review", source_type: "article", doi_or_url: "https://doi.org/10.0000/ornek.2", created_at: gunOnce(3) },
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
  document_uploads: [
    {
      id: "d1", project_id: PROJE, project_title: "Türkiye'de Enflasyon ve İşsizlik", file_name: "tez-taslak-v3.pdf", status: "analyzed", error_message: null, created_at: gunOnce(2),
      analysis: { complianceScore: 88, referenceSectionFound: true, references: [], crossCheck: { citationsWithoutReference: [], referencesWithoutCitation: [] }, guidelineCompliance: null, kilavuz: null, sayfaSayisi: 42, metinUyarisi: null },
    },
  ],
  ai_feedback_requests: [
    {
      id: "f1", document_id: "d1", status: "completed", error_message: null, created_at: gunOnce(1),
      feedback_text: "- Giriş bölümünde araştırma sorusu açıkça yazılmamış; amaç paragrafının sonuna eklenebilir.\n- Yöntem bölümünde veri kaynağı ve dönem belirtilmiş, ancak değişkenlerin dönüşümü anlatılmamış.\n- Bulgular tablolarla destekleniyor; tablo başlıkları kılavuzdaki biçime uymuyor.\n- Sonuç bölümü bulguları tekrar ediyor; politika önerileri ayrı bir alt başlıkta toplanabilir.",
    },
  ],
  kaynak_pdfleri: [
    { id: "p1", project_id: PROJE, kunye_anahtari: kunyeAnahtari(ORNEK_KUNYELER[1]), kunye: ORNEK_KUNYELER[1], doi: "10.0000/ornek.2", durum: "indirildi", depo_yolu: "ornek.pdf", kaynak_adres: null, baslik_eslesti: true, bakildi: gunOnce(1) },
  ],
  manuscript_comments: [],
  manuscript_share_links: [],
  kanit_kayitlari: [
    { id: "i1", project_id: PROJE, created_at: gunOnce(3), iddia: "Türkiye'de kısa dönemde enflasyon ile işsizlik arasında ters yönlü ilişki vardır.", bolum: "Giriş", atif: "(Önder, 2009)", kaynak_id: "l1", kunye_durumu: "dogrulandi", erisim_durumu: "acik_erisim", incelenen_metin: "…", konum: "s. 12", alinti: "ters yönlü ilişki", destek_duzeyi: "dogrudan", degerlendiren: "kullanici", insan_incelemesi: "yapildi", celisen: null, eksik_kanit: null, kunye_kaynagi: null, kunye_bakildi: null, erisim_adresi: null, incelenen_kapsam: null, incelenen_surum: null, degerlendirildi: null, duzeltme: null, gerekce: null },
    { id: "i2", project_id: PROJE, created_at: gunOnce(2), iddia: "Sınır testi, değişkenlerin bütünleşme derecesinden bağımsız uygulanabilir.", bolum: "Yöntem", atif: "(Pesaran vd., 2001)", kaynak_id: "l3", kunye_durumu: "bakilmadi", erisim_durumu: "bilinmiyor", incelenen_metin: null, konum: null, alinti: null, destek_duzeyi: "degerlendirilmedi", degerlendiren: null, insan_incelemesi: "bekliyor", celisen: null, eksik_kanit: "Kaynaktan metin incelenmedi", kunye_kaynagi: null, kunye_bakildi: null, erisim_adresi: null, incelenen_kapsam: null, incelenen_surum: null, degerlendirildi: null, duzeltme: null, gerekce: null },
  ],
  calisma_takvimi: [],
  calisma_kilavuzu: [],
  thesis_guidelines: [],
  etik_kurul: [],
  /*
    DESTEK (Signature OS 4.4, 05.11.2026): her durumdan bir örnek. Eskiden
    iki tablo da boştu; Destek ekranı önizlemede yalnızca boş hâliyle
    görülebiliyordu, yazışma ve durum hapları hiç çizilmiyordu.
    ONIZLEME_BOS=1 boş hâli yine gösterir (sahte-istemci.ts BOS_TABLOLAR).
  */
  consultancy_requests: [
    { id: "u1", project_id: PROJE, project_title: "TÜRKİYE'DE ENFLASYON VE İŞSİZLİK İLİŞKİSİNİN EKONOMETRİK ANALİZİ (2000–2025)", requested_by: KULLANICI, request_type: "analysis", message: "ARDL sınır testinde gecikme uzunluğunu nasıl seçmeliyim? AIC ve SIC farklı sonuç veriyor.", status: "accepted", assigned_expert_id: "00000000-0000-4000-8000-0000000000e1", created_at: gunOnce(3) },
    { id: "u2", project_id: null, project_title: null, requested_by: KULLANICI, request_type: "editing", message: "Özet bölümünün İngilizce çevirisini kontrol eder misiniz?", status: "completed", assigned_expert_id: "00000000-0000-4000-8000-0000000000e1", created_at: gunOnce(18) },
  ],
  app_support_requests: [
    { id: "d1", requested_by: KULLANICI, subject: "Word çıktısında dipnotlar kayıyor", message: "Dışa aktarılan dosyada 3. bölümden sonra dipnot numaraları bir kayıyor.", category: "bug", priority: "high", status: "in_progress", created_at: gunOnce(2), admin_note: null, answered_at: null },
    { id: "d2", requested_by: KULLANICI, subject: "Fatura bilgisini güncelleme", message: "Fatura adresimi nereden değiştirebilirim?", category: "billing", priority: "normal", status: "open", created_at: gunOnce(0), admin_note: null, answered_at: null },
    { id: "d3", requested_by: KULLANICI, subject: "Kaynak içe aktarımı", message: "BibTeX dosyasındaki Türkçe karakterler bozuk geliyordu.", category: "other", priority: "low", status: "resolved", created_at: gunOnce(12), admin_note: null, answered_at: null },
  ],
  destek_mesajlari: [
    { id: "m1", uzman_talebi_id: "u1", destek_talebi_id: null, taraf: "uzman", yazan_adi: "Dr. Selin Aksoy", metin: "Merhaba Deniz, örneklem 26 yıllık olduğu için SIC'i öneririm; AIC küçük örneklemde fazla gecikme seçme eğiliminde. Seçtiğiniz gecikmeyle otokorelasyon testini de ekleyin.", created_at: gunOnce(2) },
    { id: "m2", uzman_talebi_id: "u1", destek_talebi_id: null, taraf: "talep_sahibi", yazan_adi: "Deniz Yıldız", metin: "Teşekkürler, SIC ile (1, 2) çıktı. Breusch-Godfrey sonucunu da ekledim.", created_at: gunOnce(1) },
    { id: "m3", uzman_talebi_id: "u1", destek_talebi_id: null, taraf: "uzman", yazan_adi: "Dr. Selin Aksoy", metin: "Güzel. Bulgular tablosuna testin p değerini yazmayı unutmayın.", created_at: gunOnce(0) },
    { id: "m4", uzman_talebi_id: null, destek_talebi_id: "d1", taraf: "destek", yazan_adi: "ArvoLab Destek", metin: "Bildiriminiz için teşekkürler. Sorunu yeniden ürettik; düzeltme bu hafta içinde yayında olacak.", created_at: gunOnce(1) },
    { id: "m5", uzman_talebi_id: null, destek_talebi_id: "d3", taraf: "destek", yazan_adi: "ArvoLab Destek", metin: "İçe aktarma artık UTF-8 dışındaki kodlamaları da tanıyor. Dosyanızı yeniden yükleyebilirsiniz.", created_at: gunOnce(11) },
  ],
  organizations: [],
};

export const ORNEK_RPC: Record<string, unknown> = {
  ai_kredi_durumum: { kullanilan_karakter: 182_000, limit_kredi: 500, aylik_kalan: 318, ek_bakiye: 0, bildirildi: true, ic_ekip: false, bireysel: true },
};
