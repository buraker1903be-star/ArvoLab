import { createAdminClient } from "@/lib/supabase/admin";
import { scanGuidelineUrl, TARAYICI_SURUMU, type GuidelineScanResult } from "@/lib/guideline-scan";
import { enstituTespitEt, fakulteVeyaBolumBelgesi } from "@/lib/enstitu-tespiti";
import { crawlUniversityAndInstitutes, resolveOfficialUniversityDomain } from "@/lib/official-guideline-crawl";

type University = { id: string; name: string };

type Candidate = {
  url: string;
  title: string;
};

/*
  Enstitü düzeyine geçince aday sayısı arttı: bir üniversitenin Sosyal,
  Fen ve Sağlık Bilimleri enstitüleri ayrı kılavuz yayımlar ve hepsi ayrı
  birer adaydır. Eskiden ilk bulunanda durulduğu için üniversite başına tek
  kayıt oluşuyordu.
*/
const MAX_CANDIDATES_PER_UNIVERSITY = 8;


function normalizeTurkish(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/İ/g, "I")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toUpperCase();
}

function universityTokens(name: string) {
  const ignored = new Set(["UNIVERSITESI", "UNIVERSITE", "T C", "VE"]);
  return normalizeTurkish(name)
    .split(" ")
    .filter((token) => token.length >= 3 && !ignored.has(token));
}

function belongsToUniversity(scan: GuidelineScanResult, universityName: string) {
  const preview = normalizeTurkish(scan.textPreview);
  const tokens = universityTokens(universityName);
  if (!tokens.length) return false;
  const matched = tokens.filter((token) => preview.includes(token));
  return matched.length >= Math.min(2, tokens.length);
}


/*
  ARAMA MOTORU YEDEĞİ KALDIRILDI

  Keşif, resmî sitede aday bulunamazsa Bing/Google/DuckDuckGo sonuç
  sayfalarını kazıyordu. Üç gerekçeyle kaldırıldı:

  1. Çalışmıyordu. Ölçüldü: Bing 118 KB'lık bir sayfa döndürüyor ama
     içinde tek bir .edu.tr bağlantısı yok (bot koruması), DuckDuckGo hiç
     yanıt vermiyor. Sıfır aday.
  2. Pahalıydı. Üç sağlayıcı × 20 saniye zaman aşımı, üniversite başına 60
     saniyeye kadar boşa harcanan süre — gece turunun zaman bütçesinden
     doğrudan çalıyordu.
  3. Sürdürülebilir değildi. Üçünün de kullanım koşullarına aykırı ve
     tarayıcı taklidi bir User-Agent kullanıyordu.

  Resmî tarama (site haritaları + ana sayfa + enstitü alt alan adları +
  HTML sayfadan belgeye inme) canlıda çalıştığı doğrulandı; gerçek kaynak
  budur. Bulunamayan üniversiteler için doğru çözüm, kılavuzun elle
  eklenmesidir — panelde "Yeni kılavuz" ile.
*/
async function discoverCandidates(universityName: string): Promise<Candidate[]> {
  const officialDomain = await resolveOfficialUniversityDomain(universityName).catch(() => null);
  if (!officialDomain) return [];
  // Ana alan adı + enstitü alt alan adları (sbe., fbe., …)
  const officialCandidates = await crawlUniversityAndInstitutes(officialDomain).catch(() => []);
  return officialCandidates.slice(0, MAX_CANDIDATES_PER_UNIVERSITY);
}

/**
 * Enstitüye karşılık gelen academic_units kaydı; yoksa null.
 *
 * Dizin (YÖK Atlas senkronu) henüz enstitü üretmiyor, bu yüzden çoğu
 * durumda null döner. Bağ kurulabildiğinde kılavuz eşleştirmesi
 * best_guideline_for üzerinden birim düzeyinde çalışır — adla eşleştirme
 * kaba bir tahmindir, kimlikle bağ kesindir.
 */
async function enstituBirimi(universityId: string, enstituAdi: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("academic_units")
    .select("id")
    .eq("university_id", universityId)
    .eq("unit_type", "enstitu")
    .ilike("name", enstituAdi)
    .maybeSingle();
  return data?.id ?? null;
}

function scanUpdate(scan: GuidelineScanResult, detectedAt: string) {
  const citationStyle = scan.detectedCitationHint?.toLowerCase().replace(" ", "") ?? null;
  return {
    source_checksum: scan.sourceChecksum,
    source_content_type: scan.sourceContentType,
    last_checked_at: detectedAt,
    analysis_status: "needs_review",
    extracted_rules: scan.suggestedRules,
    required_sections: scan.suggestedSections,
    ...(citationStyle ? { citation_style: citationStyle } : {}),
    ai_analysis: {
      detectedCitationHint: scan.detectedCitationHint,
      suggestedSections: scan.suggestedSections,
      suggestedRules: scan.suggestedRules,
      confidence: scan.confidence,
      warnings: scan.warnings,
      textPreview: scan.textPreview,
      fullTextLength: scan.fullTextLength,
      detectedAt,
      discoveredAutomatically: true,
      scannerVersion: TARAYICI_SURUMU,
    },
    review_notes: `Resmî .edu.tr kaynağından otomatik keşfedildi; kurallar kullanım öncesinde akademik inceleme bekliyor (güven: %${Math.round(scan.confidence * 100)}).`,
  };
}

export async function discoverGuidelinesForUniversity(university: University) {
  const admin = createAdminClient();
  const checkedAt = new Date().toISOString();
  try {
    const candidates = await discoverCandidates(university.name);

    /*
      Eskiden ilk uygun adayda return ediliyordu: üniversite başına en fazla
      TEK kılavuz kaydedilebiliyordu ve 30 gün boyunca yeniden bakılmıyordu.
      Oysa aynı üniversitenin Sosyal, Fen ve Sağlık Bilimleri enstitüleri
      ayrı kurallar koyar — atıf sistemi bile farklı olabilir. Artık bütün
      adaylar gezilir ve her ENSTİTÜ için ayrı kayıt açılır.
    */
    const eklenenEnstituler = new Set<string>();
    const bulunanlar: string[] = [];
    let zatenBilinen = 0;
    const atlananlar: string[] = [];

    for (const candidate of candidates) {
      try {
        const scan = await scanGuidelineUrl(candidate.url);
        if (!belongsToUniversity(scan, university.name)) continue;

        const enstitu = enstituTespitEt({
          metin: scan.textPreview,
          url: candidate.url,
          baslik: candidate.title,
        });

        /*
          Fakülte ya da bölüm belgesi enstitü kuralı değildir; üniversite
          geneline uygulanırsa yanlış olur. Canlıda "Tıp Fakültesi" ve
          "Arkeoloji Bölümü" kayıtları bu yüzden oluşmuştu.

          Eleme, enstitü TESPİT EDİLEMEDİYSE yapılır: enstitü belliyse belge
          zaten doğru düzeydedir. Ayrıca üniversite geneli kılavuzlar da
          (senato kararıyla çıkan, enstitüsüz olanlar) elenmemeli; onlarda
          "Fakültesi" sözcüğü örnek olarak geçebilir ama metinde
          "Enstitüsü" hiç geçmeyebilir.
        */
        if (!enstitu && fakulteVeyaBolumBelgesi({ metin: scan.textPreview, baslik: candidate.title })) {
          atlananlar.push("fakülte/bölüm belgesi");
          continue;
        }
        // Aynı turda aynı enstitü için ikinci bir aday kaydedilmez.
        const anahtar = enstitu?.ad ?? "__universite__";
        if (eklenenEnstituler.has(anahtar)) continue;

        const { data: duplicateByUrl } = await admin
          .from("thesis_guidelines")
          .select("id")
          .eq("source_url", candidate.url)
          .maybeSingle();
        const { data: duplicateByChecksum } = await admin
          .from("thesis_guidelines")
          .select("id")
          .eq("source_checksum", scan.sourceChecksum)
          .maybeSingle();
        if (duplicateByUrl ?? duplicateByChecksum) {
          zatenBilinen += 1;
          eklenenEnstituler.add(anahtar);
          continue;
        }

        /*
          Aynı enstitünün kılavuzu zaten kayıtlıysa (başka adresten) yenisi
          açılmaz: aynı kurallar iki kayıt hâlinde durursa hangisinin
          geçerli olduğu belirsizleşir.
        */
        if (enstitu) {
          const { data: ayniEnstitu } = await admin
            .from("thesis_guidelines")
            .select("id")
            .eq("university_id", university.id)
            .eq("institute_name", enstitu.ad)
            .maybeSingle();
          if (ayniEnstitu) {
            zatenBilinen += 1;
            eklenenEnstituler.add(anahtar);
            continue;
          }
        }

        const { error: insertError } = await admin.from("thesis_guidelines").insert({
          university_id: university.id,
          university_name: university.name,
          institute_name: enstitu?.ad ?? null,
          // Kimlikle bağ, adla eşleştirmenin önüne geçer (best_guideline_for).
          academic_unit_id: enstitu ? await enstituBirimi(university.id, enstitu.ad) : null,
          document_title: candidate.title || "Tez Yazım Kılavuzu",
          document_type: "guideline",
          source_url: candidate.url,
          is_active: true,
          ...scanUpdate(scan, checkedAt),
        });
        if (insertError) throw insertError;

        eklenenEnstituler.add(anahtar);
        bulunanlar.push(enstitu?.ad ?? "üniversite geneli");
      } catch (adayHatasi) {
        /*
          Eskiden boş catch vardı: ayrıştırma ve insert hataları izsiz
          kayboluyordu. Sıradaki adaya geçilir ama sebep kaydedilir.
        */
        atlananlar.push(adayHatasi instanceof Error ? adayHatasi.message : "aday okunamadı");
      }
    }

    if (bulunanlar.length) {
      await admin.from("universities").update({
        guideline_discovery_checked_at: checkedAt,
        guideline_discovery_status: "discovered",
        guideline_discovery_note: `${bulunanlar.length} kılavuz: ${bulunanlar.join(", ")}`.slice(0, 500),
      }).eq("id", university.id);
      return { status: "discovered" as const, count: bulunanlar.length, institutes: bulunanlar };
    }

    if (zatenBilinen) {
      await admin.from("universities").update({
        guideline_discovery_checked_at: checkedAt,
        guideline_discovery_status: "already_known",
        guideline_discovery_note: `${zatenBilinen} aday zaten kayıtlı.`,
      }).eq("id", university.id);
      return { status: "already_known" as const, count: zatenBilinen };
    }

    await admin.from("universities").update({
      guideline_discovery_checked_at: checkedAt,
      guideline_discovery_status: "not_found",
      guideline_discovery_note: `${candidates.length} resmî aday incelendi${atlananlar.length ? `; atlananlar: ${atlananlar.slice(0, 3).join(", ")}` : ""}.`.slice(0, 500),
    }).eq("id", university.id);
    return { status: "not_found" as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Kılavuz keşfi başarısız.";
    await admin.from("universities").update({
      guideline_discovery_checked_at: checkedAt,
      guideline_discovery_status: "failed",
      guideline_discovery_note: message.slice(0, 500),
    }).eq("id", university.id);
    return { status: "failed" as const, error: message };
  }
}

export async function getUniversitiesDueForGuidelineDiscovery(limit = 2) {
  const admin = createAdminClient();
  const retryBefore = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await admin
    .from("universities")
    .select("id, name")
    .or(`guideline_discovery_checked_at.is.null,guideline_discovery_checked_at.lt.${retryBefore}`)
    .order("guideline_discovery_checked_at", { ascending: true, nullsFirst: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as University[];
}
