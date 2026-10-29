"use server";

import { listeBasarili, listeOkunamadi, type ListeSonucu } from "@/lib/liste-sonucu";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { buildShingles, computeSimilarity } from "@/lib/similarity-check";
import { isSubscriptionBlocked, abonelikKapaliMesaji } from "@/lib/access";
import { oturumYokMesaji } from "@/lib/auth-guards";
import { ceviri } from "@/lib/dil-sunucu";

export interface OriginalityMatch {
  documentId: string;
  fileName: string;
  similarity: number;
  sampleOverlap: string | null;
}

export interface OriginalityCheckResult {
  error?: string;
  overallSimilarity?: number;
  comparedDocumentCount?: number;
  matches?: OriginalityMatch[];
}

// Bu tarama, kullanıcının ERİŞİM YETKİSİ OLDUĞU belge havuzuyla
// sınırlıdır (RLS tarafından belirlenir): normal kullanıcılar
// yalnızca kendi belgeleriyle, denetim rolündeki kullanıcılar ise
// kurumdaki tüm belgelerle karşılaştırma yapabilir. Turnitin'in
// dünya çapındaki veritabanının yerini TUTMAZ.
export async function runOriginalityCheck(documentId: string): Promise<OriginalityCheckResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: await oturumYokMesaji() };
  }
  /* Abonelik kapısı: Özgünlük denetimi ücretli bir özellik; paneldeki kapı yalnızca
     ekranı kapatır, işlem doğrudan çağrılabilir. */
  if (await isSubscriptionBlocked()) return { error: (await abonelikKapaliMesaji()) };
  const t = await ceviri();

  const { data: targetDoc, error: targetError } = await supabase
    .from("document_uploads")
    .select("id, file_name, extracted_text")
    .eq("id", documentId)
    .single();

  if (targetError || !targetDoc?.extracted_text) {
    return { error: t({ tr: "Belge metni bulunamadı. Önce belgeyi yükleyip analiz ettirin.", en: "No document text was found. Upload the document and have it analyzed first." }) };
  }

  /*
    Erişilebilir analiz edilmiş belgeler (RLS süzer), EN YENİDEN ESKİYE,
    100'lük sayfalarla en fazla HAVUZ_TAVANI belge. Eskiden sırasız tek bir
    .limit(200) vardı: kurumunda 200'den fazla belge gören Kontrolör için
    rastgele bir alt küme karşılaştırılıyor, gerçek bir örtüşme "anlamlı
    eşleşme yok" diye raporlanabiliyor ve aynı tarama iki kez farklı sonuç
    verebiliyordu. Karşılaştırılan sayı ekranda yazdığı için tavan da
    görünür kalıyor. Metinler sayfa sayfa işlenip bırakılıyor: hepsini
    birden belleğe almak büyük kurumda sunucu işlevini taşırır.
  */
  const targetShingles = buildShingles(targetDoc.extracted_text);
  const SAYFA = 100;
  const HAVUZ_TAVANI = 1000;
  let karsilastirilan = 0;
  let adaylar: OriginalityMatch[] = [];
  for (let bas = 0; bas < HAVUZ_TAVANI; bas += SAYFA) {
    const { data: sayfa, error: candidatesError } = await supabase
      .from("document_uploads")
      .select("id, file_name, extracted_text")
      .eq("status", "analyzed")
      .not("extracted_text", "is", null)
      .neq("id", documentId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(bas, bas + SAYFA - 1);

    if (candidatesError) {
      console.error(candidatesError);
      return { error: t({ tr: "Karşılaştırma havuzu getirilirken hata oluştu.", en: "An error occurred while loading the comparison pool." }) };
    }
    for (const c of sayfa ?? []) {
      const result = computeSimilarity(targetShingles, buildShingles(c.extracted_text ?? ""));
      // yalnızca anlamlı örtüşmeleri tut
      if (result.score >= 10) {
        adaylar.push({ documentId: c.id, fileName: c.file_name, similarity: result.score, sampleOverlap: result.sampleOverlap });
      }
    }
    karsilastirilan += sayfa?.length ?? 0;
    adaylar = adaylar.sort((a, b) => b.similarity - a.similarity).slice(0, 10);
    if ((sayfa?.length ?? 0) < SAYFA) break;
  }
  const matches = adaylar;

  const overallSimilarity = matches.length > 0 ? matches[0].similarity : 0;

  const { error: insertError } = await supabase.from("originality_checks").insert({
    document_id: documentId,
    requested_by: user.id,
    overall_similarity: overallSimilarity,
    compared_document_count: karsilastirilan,
    matches,
  });

  if (insertError) {
    console.error(insertError);
    return { error: t({ tr: "Sonuç kaydedilirken bir hata oluştu.", en: "An error occurred while saving the result." }) };
  }

  revalidatePath("/dashboard/documents");
  return {
    overallSimilarity,
    comparedDocumentCount: karsilastirilan,
    matches,
  };
}

export interface OriginalityCheckRecord {
  id: string;
  document_id: string;
  overall_similarity: number;
  compared_document_count: number;
  matches: OriginalityMatch[];
  created_at: string;
}

/*
  Eskiden okuma hatasında boş dizi dönüyordu; belgeler ekranı da boş diziyi
  "hiç taranmamış" sayıp yeniden tarama düğmesini gösteriyordu. Yapılmış bir
  orijinallik taramasının sonucunu gizlemek, kullanıcının belgesini temiz
  sanmasına yol açabilirdi — burada "bilinmeyen" en pahalı yanlıştır.
*/
export async function getOriginalityChecksForDocument(documentId: string): Promise<ListeSonucu<OriginalityCheckRecord>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("originality_checks")
    .select("id, document_id, overall_similarity, compared_document_count, matches, created_at")
    .eq("document_id", documentId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    console.error(error);
    return listeOkunamadi();
  }
  return listeBasarili(data);
}
