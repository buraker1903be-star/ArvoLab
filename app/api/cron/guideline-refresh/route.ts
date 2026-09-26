import { createAdminClient } from "@/lib/supabase/admin";
import { kosulluTara, kunyeYamasi, TARAYICI_SURUMU } from "@/lib/guideline-scan";
import {
  discoverGuidelinesForUniversity,
  getUniversitiesDueForGuidelineDiscovery,
} from "@/lib/guideline-discovery";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  /*
    ZAMAN BÜTÇESİ

    Uç noktanın sınırı 300 saniye. Enstitü alt alan adları taranmaya ve HTML
    sayfalardan gerçek belgeye inilmeye başlayınca üniversite başına süre
    belirgin şekilde arttı; sabit bir "günde 2 üniversite" sayısı artık
    hem yetersiz hem riskli. Süre aşılırsa istek ortada kesilir: o turda
    yapılan iş yazılmış olsa bile kalan kayıtlar hiç işlenmez ve yanıt
    kaybolur.

    Bu yüzden sayı değil SÜRE sınırlanıyor: yeni bir işe ancak bütçe
    yetiyorsa başlanır. Her üniversite kendi kaydını bitirince güncellediği
    için yarıda kesilme veri kaybı yaratmaz, yalnızca sıradakiler ertesi
    güne kalır.
  */
  const basladi = Date.now();
  const TOPLAM_BUTCE_MS = 270_000;
  const gecen = () => Date.now() - basladi;
  const kalan = () => TOPLAM_BUTCE_MS - gecen();

  /*
    Keşif bütçenin yarısını alır. Hepsini alsaydı, yeni üniversiteler
    bulunurken KAYITLI kılavuzların yeniden taranması hiç sıra alamaz ve
    kaynaktaki sürüm değişiklikleri fark edilmezdi.
  */
  const KESIF_BUTCE_MS = Math.floor(TOPLAM_BUTCE_MS * 0.55);
  /*
    Bir üniversitenin keşfi için ayrılan kaba üst süre. Üç düşüş oldu:
    alt alan adları üçerli paralel taranıyor, site haritası isteklerinin
    zaman aşımı 12 saniye, ve hiçbir şey bulamayan arama motoru yedeği
    (üniversite başına 60 saniyeye kadar) tamamen kaldırıldı.
  */
  const UNIVERSITE_MALIYETI_MS = 30_000;
  /** Bir kılavuzun yeniden taranması için ayrılan kaba üst süre. */
  const TARAMA_MALIYETI_MS = 25_000;

  const supabase = createAdminClient();
  let kesifDurduruldu = false;
  let taramaDurduruldu = false;
  const discoveryResults: Array<{
    university: string | null;
    status: "discovered" | "already_known" | "not_found" | "failed";
    /* Bir üniversitede birden çok enstitü kılavuzu bulunabilir. */
    count?: number;
    institutes?: string[];
    error?: string;
  }> = [];
  try {
    // Sayı cömert; gerçek sınırı bütçe koyuyor.
    const universities = await getUniversitiesDueForGuidelineDiscovery(12);
    for (const university of universities) {
      // Bitiremeyeceğimiz bir işe başlamak, yarıda kesilmek demektir.
      if (gecen() + UNIVERSITE_MALIYETI_MS > KESIF_BUTCE_MS) {
        kesifDurduruldu = true;
        break;
      }
      /*
        Bütçe kontrolü işe BAŞLAMADAN önce yapılıyor ama bir üniversitenin
        ne kadar süreceğini önceden bilemiyoruz: canlıda tek bir
        üniversitenin taraması 964 saniye sürdü (turun toplam bütçesi 300).
        O tur tamamen kaybedilirdi — kalan kayıtlar işlenmez, yanıt hiç
        dönmezdi.

        Bu yüzden her üniversiteye ayrı bir süre sınırı konuyor. Zaman
        aşımına uğrayan üniversitenin o ana kadar EKLEDİĞİ kılavuzlar
        yerinde kalır (keşif her kaydı bulduğunda yazıyor); yalnızca
        "bakıldı" damgası atılmadığı için sıradaki turda yeniden denenir.
      */
      const sonuc = await Promise.race([
        discoverGuidelinesForUniversity(university),
        new Promise<{ status: "failed"; error: string }>((coz) =>
          setTimeout(() => coz({ status: "failed", error: "Süre sınırı aşıldı; sonraki turda yeniden denenecek." }), UNIVERSITE_MALIYETI_MS),
        ),
      ]);
      discoveryResults.push({ university: university.name, ...sonuc });
    }
  } catch (discoveryError) {
    discoveryResults.push({
      university: null,
      status: "failed" as const,
      error: discoveryError instanceof Error ? discoveryError.message : "Keşif kuyruğu alınamadı.",
    });
  }

  const SUTUNLAR =
    "id, source_url, source_checksum, analysis_status, university_name, institute_name, extracted_rules, ai_analysis, source_etag, source_last_modified";
  const TUR_BASINA = 12;

  /*
    HİÇ TARANMAMIŞ kayıtlar öne alınır.

    Sıra yalnızca last_checked_at'e göreydi ve bu, yeni eklenen kayıtları en
    arkaya atıyordu: eklenme anı "şimdi" olduğu için sıraları en sonda
    oluyor, oysa kuralları bomboş ve hiçbir çalışmada kullanılamıyorlar.
    Eski kayıtlar ise zaten taranmış; onların turu bir gün gecikse bir şey
    kaybedilmez. Üstelik koşullu istek sayesinde değişmemiş bir kayıt
    neredeyse bedava (gövdesiz 304), yani öne almanın maliyeti de yok.

    Canlıda 25 kayıt tek seferde eklendiğinde ortaya çıktı.
  */
  const { data: taranmamis, error: taranmamisHatasi } = await supabase
    .from("thesis_guidelines")
    .select(SUTUNLAR)
    .not("source_url", "is", null)
    .eq("is_active", true)
    .or("extracted_rules.is.null,extracted_rules.eq.{}")
    .order("created_at", { ascending: true })
    .limit(TUR_BASINA);

  if (taranmamisHatasi) return Response.json({ error: taranmamisHatasi.message }, { status: 500 });

  const kalanYer = Math.max(0, TUR_BASINA - (taranmamis?.length ?? 0));
  const { data: eskiler, error } = kalanYer
    ? await supabase
        .from("thesis_guidelines")
        .select(SUTUNLAR)
        .not("source_url", "is", null)
        .eq("is_active", true)
        .order("last_checked_at", { ascending: true })
        .limit(kalanYer + TUR_BASINA)
    : { data: [], error: null };

  if (error) return Response.json({ error: error.message }, { status: 500 });

  // İki sorgu çakışabilir; aynı kayıt iki kez işlenmesin.
  const gorulen = new Set((taranmamis ?? []).map((kayit) => kayit.id));
  const guidelines = [
    ...(taranmamis ?? []),
    ...(eskiler ?? []).filter((kayit) => !gorulen.has(kayit.id)).slice(0, kalanYer),
  ];

  const results: Array<{ id: string; status: string; error?: string }> = [];
  for (const guideline of guidelines ?? []) {
    if (kalan() < TARAMA_MALIYETI_MS) {
      taramaDurduruldu = true;
      break;
    }
    try {
      /*
        Çıkarım sürümü eskiyse dosya değişmemiş olsa bile YENİDEN
        çıkarılması gerekir; koşullu istek 304 dönerse elimizde metin
        olmaz. O yüzden doğrulayıcılar yalnızca sürüm güncelken gönderilir.
      */
      const eskiSurumKontrol = Number((guideline.ai_analysis as { scannerVersion?: unknown } | null)?.scannerVersion ?? 0) < TARAYICI_SURUMU;
      const tarama = await kosulluTara(
        guideline.source_url!,
        eskiSurumKontrol ? undefined : { etag: guideline.source_etag, lastModified: guideline.source_last_modified },
      );

      if (tarama.degismedi) {
        /*
          Sunucu "değişmedi" dedi: hiçbir şey indirilmedi. Yalnızca bakım
          zamanı ilerletilir ki kuyrukta sıradakine geçilsin.
        */
        await supabase
          .from("thesis_guidelines")
          .update({ last_checked_at: new Date().toISOString() })
          .eq("id", guideline.id);
        results.push({ id: guideline.id, status: "not_modified" });
        continue;
      }

      const scan = tarama.sonuc;
      const previousChecksum = guideline.source_checksum;
      const changed = Boolean(previousChecksum && previousChecksum !== scan.sourceChecksum);
      const isApproved = guideline.analysis_status === "approved";
      const hasRules = Boolean(guideline.extracted_rules && Object.keys(guideline.extracted_rules).length > 0);
      /*
        Çıkarım kuralları düzeldiğinde eski kayıtlar da düzelsin: dosya
        değişmemiş olsa bile eski sürümle çıkarılmış kayıt yeniden işlenir.
        Onaylı kayıtlar bunun dışında (aşağıdaki ilk dal).
      */
      const eskiSurum = Number((guideline.ai_analysis as { scannerVersion?: unknown } | null)?.scannerVersion ?? 0);
      const surumEskimis = eskiSurum < TARAYICI_SURUMU;
      const citationStyle = scan.detectedCitationHint?.toLowerCase().replace(" ", "") ?? null;
      /*
        Ölçüt veritabanındaki tetikleyiciyle (set_thesis_guideline_ready)
        AYNI olmalı: buradaki değer yöneticinin gördüğü nota ve cron'un
        raporuna giriyor, rozeti ise tetikleyici veriyor. OCR koşulu
        20260926135648'de tetikleyiciye eklendi; burada eksik kalsaydı not
        "tek adım onay bekliyor" derken listede rozet çıkmazdı.
      */
      const readyForApproval =
        scan.confidence >= 0.9
        && scan.suggestedSections.length >= 4
        && Boolean(citationStyle)
        && !scan.ocrKullanildi;
      const detectedAt = new Date().toISOString();
      const analysis = {
        scannerVersion: TARAYICI_SURUMU,
        // OCR'lı metinden çıkarılan kurallar tek adım onaya girmez.
        ocrUsed: scan.ocrKullanildi,
        detectedCitationHint: scan.detectedCitationHint,
        citationMentions: scan.citationMentions,
        suggestedSections: scan.suggestedSections,
        suggestedRules: scan.suggestedRules,
        confidence: scan.confidence,
        warnings: scan.warnings,
        textPreview: scan.textPreview,
        fullTextLength: scan.fullTextLength,
        detectedAt,
        // Onaylı kılavuzun kaynağı değiştiyse yeni dosyanın imzası burada bekler;
        // source_checksum onaylı sürümü göstermeye devam eder (değişiklik kaybolmaz).
        pendingReview: isApproved && changed,
        pendingChecksum: isApproved && changed ? scan.sourceChecksum : null,
      };
      // İlk taramada imzası olmayan kayıtlara imza yazılır.
      const checksumPatch = previousChecksum ? {} : { source_checksum: scan.sourceChecksum };
      /*
        Doğrulayıcılar her turda tazelenir: sunucu dosyayı yeniden
        yayımladığında ETag değişir ve eski değeri saklamak, sonraki
        koşullu isteği işe yaramaz hâle getirirdi.
      */
      const dogrulayiciPatch = {
        source_etag: scan.sourceEtag,
        source_last_modified: scan.sourceLastModified,
      };

      let update: Record<string, unknown>;
      let status: string;
      if (isApproved) {
        /*
          Onaylı kurallar hiçbir zaman otomatik değişmez; müşterilerin
          editörü bozulmaz. Ama çıkarım kuralları düzeldiyse bu kayıt ESKİ
          ve muhtemelen yanlış bir çıkarımla onaylanmış demektir; sessizce
          bırakmak, bilinen bir hatayı saklamak olurdu. Değiştirmeden
          İŞARETLENİR, kararı yönetici verir.

          Canlıda gerçekleşti: atıf sistemi algılamasındaki hata yüzünden
          Gazi kılavuzu "Chicago" olarak onaylanmıştı (belgede APA 5,
          Chicago 1 kez geçiyor).
        */
        update = {
          ...checksumPatch,
          ...dogrulayiciPatch,
          source_content_type: scan.sourceContentType,
          last_checked_at: detectedAt,
          ai_analysis: { ...analysis, scannerOutdated: surumEskimis },
          ...(changed
            ? { review_notes: "Resmî kaynakta yeni sürüm algılandı; onaylı kurallar korunuyor, yönetici incelemesi bekliyor." }
            : surumEskimis
              ? { review_notes: `Bu kılavuz eski bir çıkarım sürümüyle onaylandı (v${eskiSurum || 1} → v${TARAYICI_SURUMU}). Onaylı kurallar korunuyor; onayı geri alıp yeniden tarayın.` }
              : {}),
        };
        status = changed ? "new_version_pending" : surumEskimis ? "approved_with_old_scanner" : "unchanged";
      } else if (changed || !hasRules || surumEskimis) {
        // Onay bekleyen kayıt: yalnızca dosya değiştiyse ya da henüz kural yoksa öneriler yazılır.
        update = {
          source_checksum: scan.sourceChecksum,
          ...dogrulayiciPatch,
          // Sürüm, yürürlük tarihi, sayfa sınırı: yalnızca bulunanlar yazılır.
          ...kunyeYamasi(scan),
          source_content_type: scan.sourceContentType,
          last_checked_at: detectedAt,
          ai_analysis: analysis,
          analysis_status: "needs_review",
          extracted_rules: scan.suggestedRules,
          required_sections: scan.suggestedSections,
          ...(citationStyle ? { citation_style: citationStyle } : {}),
          reviewed_by: null,
          reviewed_at: null,
          review_notes: readyForApproval
            ? `Kurallar otomatik dolduruldu (güven: %${Math.round(scan.confidence * 100)}); tek adım onay bekliyor.`
            : `Otomatik çıkarım inceleme gerektiriyor (güven: %${Math.round(scan.confidence * 100)}).`,
        };
        status = surumEskimis && !changed && hasRules
          ? "rescanned_new_scanner"
          : readyForApproval
            ? "ready_for_approval"
            : "needs_review";
      } else {
        // Onay bekleyen, dosyası değişmemiş: yöneticinin yaptığı düzenlemeler ezilmez.
        update = { ...checksumPatch, ...dogrulayiciPatch, source_content_type: scan.sourceContentType, last_checked_at: detectedAt, ai_analysis: analysis };
        status = "awaiting_review";
      }

      const { error: updateError } = await supabase.from("thesis_guidelines").update(update).eq("id", guideline.id);

      if (updateError) throw updateError;
      results.push({ id: guideline.id, status });
    } catch (scanError) {
      const message = scanError instanceof Error ? scanError.message : "Tarama başarısız.";
      await supabase
        .from("thesis_guidelines")
        .update({
          review_notes: `Son otomatik kontrol başarısız: ${message}`.slice(0, 1000),
          last_checked_at: new Date().toISOString(),
        })
        .eq("id", guideline.id);
      results.push({ id: guideline.id, status: "failed", error: message });
    }
  }

  return Response.json({
    discovered: discoveryResults.filter((item) => item.status === "discovered").length,
    discoveryResults,
    checked: results.length,
    results,
    /*
      Bütçe yüzünden durulduysa görünür olsun: kuyruk ilerlemiyorsa sebebi
      sessiz kalmamalı. Kalan işler ertesi gün sıradan devam eder.
    */
    sureSaniye: Math.round(gecen() / 1000),
    kesifDurduruldu,
    taramaDurduruldu,
  });
}
