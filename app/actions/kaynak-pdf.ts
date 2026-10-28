"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getAuthContext, oturumYokMesaji } from "@/lib/auth-guards";
import { isSubscriptionBlocked, abonelikKapaliMesaji } from "@/lib/access";
import { varsayilanGetir } from "@/lib/kanit/dizin";
import { guvenliIndir } from "@/lib/guvenli-indir";
import { extractTextFromBuffer } from "@/lib/document-extract";
import {
  PDF_EN_FAZLA_BAYT,
  aranacakMi,
  baslikPdfteGeciyor,
  kaynakRaporu,
  kunyeAnahtari,
  paketDosyalari,
  pdfAdaylari,
  pdfMi,
  type DogrulamaDurumu,
  type KaynakPdfSatiri,
  type PdfDurumu,
} from "@/lib/kaynak-pdf";

/*
  KAYNAK PDF'LERİ (kaynak_pdfleri, migration 20261026110024).

  "PDF'leri bul" her künye için açık erişimli PDF'i arar, indirir, ilk
  baytlarından gerçekten PDF olduğunu doğrular ve çalışmanın klasörüne
  koyar. Bulunamayanı öğrenci yükler. Yetki RLS'te ve depolama
  politikasında (calisma_klasoru); buradaki denetim anlaşılır mesaj için.

  Bir çağrıda en fazla PARTI künye: her biri dış sunuculara gidiyor ve
  indirme sürüyor; uzun kaynakçayı istemci parça parça gönderiyor, ilerleme
  ekranda görünüyor.
*/

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PARTI = 3;
/*
  Bir çağrının süre bütçesi. Sayfanın maxDuration'ı 60 sn; yavaş bir
  arşiv sunucusu partinin tamamını yemesin. Bütçe dolunca kalan künyelere
  bu çağrıda bakılmaz (satır dönmez, "henüz bakılmadı" kalır); öğrenci
  düğmeye yeniden basınca yalnızca onlar sorulur.
*/
const SURE_BUTCESI_MS = 40_000;
const KOVA = "project-files";

const SECIM = "id, kunye_anahtari, kunye, doi, durum, depo_yolu, kaynak_adres, baslik_eslesti, bakildi";

/* Depodaki ad: künyenin özeti + zaman. Okunur ad ZIP'te künyeden kurulur
   (lib/kaynak-pdf.ts, pdfDosyaAdi); burada çakışmamak yeter. */
const depoYolu = (projectId: string, anahtar: string) =>
  `${projectId}/kaynak-pdf/${createHash("sha1").update(anahtar).digest("hex").slice(0, 16)}-${Date.now()}.pdf`;

const yenile = () => revalidatePath("/dashboard/editor");

/** Çalışmanın bütün PDF kayıtları (sınırsız: ZIP de buradan kuruluyor). */
export async function kaynakPdfleri(projectId: string): Promise<KaynakPdfSatiri[]> {
  if (!UUID.test(projectId)) return [];
  const ctx = await getAuthContext();
  if (!ctx) return [];
  const { data, error } = await ctx.supabase.from("kaynak_pdfleri").select(SECIM).eq("project_id", projectId);
  if (error) {
    console.error("[kaynak-pdf] okunamadı:", error.message);
    return [];
  }
  return (data ?? []) as KaynakPdfSatiri[];
}

type Kunye = { kunye: string; doi?: string | null; dogrulama?: DogrulamaDurumu | null };

/**
 * Künyelerin açık erişimli PDF'lerini arar ve indirir (en fazla PARTI).
 * Öğrencinin yüklediği PDF'in üzerine yazmaz.
 */
export async function kaynakPdfleriniBul(
  projectId: string,
  kunyeler: Kunye[],
): Promise<{ error?: string; satirlar?: KaynakPdfSatiri[] }> {
  const ctx = await getAuthContext();
  if (!ctx) return { error: await oturumYokMesaji() };
  // Dış sunuculara gidiyor ve depolamaya yazıyor: kapı burada da.
  if (await isSubscriptionBlocked()) return { error: (await abonelikKapaliMesaji()) };
  if (!UUID.test(projectId)) return { error: "Çalışma bulunamadı." };
  const { supabase, user } = ctx;

  const parti = kunyeler.slice(0, PARTI).filter((k) => typeof k?.kunye === "string" && k.kunye.trim());
  const anahtarlar = parti.map((k) => kunyeAnahtari(k.kunye)).filter(Boolean);
  const { data: mevcut, error: okumaHatasi } = await supabase
    .from("kaynak_pdfleri")
    .select("kunye_anahtari, durum, depo_yolu")
    .eq("project_id", projectId)
    .in("kunye_anahtari", anahtarlar);
  if (okumaHatasi) {
    console.error("[kaynak-pdf] okunamadı:", okumaHatasi.message);
    return { error: "PDF kayıtları okunamadı; tekrar deneyin." };
  }
  const yuklenmis = new Set((mevcut ?? []).filter((m) => m.durum === "yuklendi").map((m) => m.kunye_anahtari));
  const eskiYol = new Map((mevcut ?? []).map((m) => [m.kunye_anahtari, m.depo_yolu as string | null]));

  const satirlar: KaynakPdfSatiri[] = [];
  const butceSonu = Date.now() + SURE_BUTCESI_MS;
  for (const k of parti) {
    if (Date.now() > butceSonu) break;
    const anahtar = kunyeAnahtari(k.kunye);
    if (!anahtar || yuklenmis.has(anahtar)) continue;
    const doi = k.doi?.trim().slice(0, 300) || null;
    const kayit = {
      project_id: projectId,
      olusturan: user.id,
      kunye_anahtari: anahtar,
      kunye: k.kunye.trim().slice(0, 2000),
      doi,
      bakildi: new Date().toISOString(),
      baslik_eslesti: null as boolean | null,
    };

    let durum: PdfDurumu;
    let yol: string | null = null;
    let kaynakAdres: string | null = null;

    if (k.dogrulama === "not_found") {
      durum = "kayit_yok";
    } else if (!aranacakMi(k.dogrulama ?? null, doi)) {
      durum = "bulunamadi";
    } else {
      // DOI'nin açık erişim konumları OpenAlex'ten; ağ hatası "bulunamadı" sayılmaz.
      let adaylar: string[] = [];
      let dizinHatasi = false;
      try {
        const yanit = await varsayilanGetir(`https://api.openalex.org/works/doi:${encodeURIComponent(doi!)}`);
        if (yanit.durum >= 200 && yanit.durum < 300) adaylar = pdfAdaylari(yanit.veri);
        else if (yanit.durum !== 404) dizinHatasi = true;
      } catch {
        dizinHatasi = true;
      }

      durum = adaylar.length ? "erisilemedi" : dizinHatasi ? "erisilemedi" : "bulunamadi";
      for (const aday of adaylar) {
        if (Date.now() > butceSonu) break;
        try {
          const indirilen = await guvenliIndir(aday, PDF_EN_FAZLA_BAYT);
          // Yayınevinin giriş sayfası ya da "erişiminiz yok" HTML'i PDF değil.
          if (!pdfMi(indirilen.bayt)) continue;
          const hedef = depoYolu(projectId, anahtar);
          const { error: yuklemeHatasi } = await supabase.storage
            .from(KOVA)
            .upload(hedef, indirilen.bayt, { contentType: "application/pdf", upsert: false });
          if (yuklemeHatasi) {
            console.error("[kaynak-pdf] depoya yazılamadı:", yuklemeHatasi.message);
            continue;
          }
          durum = "indirildi";
          yol = hedef;
          kaynakAdres = indirilen.sonAdres;
          break;
        } catch (hata) {
          console.warn("[kaynak-pdf] indirilemedi:", aday, hata instanceof Error ? hata.message : hata);
          kaynakAdres = aday;
        }
      }
    }

    const { data, error } = await supabase
      .from("kaynak_pdfleri")
      .upsert({ ...kayit, durum, depo_yolu: yol, kaynak_adres: kaynakAdres }, { onConflict: "project_id,kunye_anahtari" })
      .select(SECIM)
      .single();
    if (error) {
      console.error("[kaynak-pdf] kaydedilemedi:", error.message);
      return { error: error.code === "42501" ? "Bu çalışmaya yazma yetkiniz yok." : "PDF durumu kaydedilemedi; tekrar deneyin." };
    }
    satirlar.push(data as KaynakPdfSatiri);
    // Yeniden bakıldıysa önceki indirme artık kullanılmıyor.
    const eski = eskiYol.get(anahtar);
    if (eski && eski !== yol) await supabase.storage.from(KOVA).remove([eski]);
  }

  yenile();
  return { satirlar };
}

/**
 * Öğrencinin yüklediği PDF. Dosya tarayıcıdan çalışmanın klasörüne
 * yüklenmiş oluyor; burada gerçekten PDF mi ve künyenin başlığını taşıyor
 * mu bakılıyor. PDF değilse dosya silinir, kayıt yazılmaz.
 */
export async function kaynakPdfiYuklendi(
  projectId: string,
  girdi: { kunye: string; doi?: string | null; depoYolu: string },
): Promise<{ error?: string; satir?: KaynakPdfSatiri }> {
  const ctx = await getAuthContext();
  if (!ctx) return { error: await oturumYokMesaji() };
  if (await isSubscriptionBlocked()) return { error: (await abonelikKapaliMesaji()) };
  if (!UUID.test(projectId) || !girdi.depoYolu.startsWith(`${projectId}/kaynak-pdf/`)) return { error: "Dosya yolu geçersiz." };
  const { supabase, user } = ctx;

  const { data: dosya, error: indirmeHatasi } = await supabase.storage.from(KOVA).download(girdi.depoYolu);
  if (indirmeHatasi || !dosya) {
    console.error("[kaynak-pdf] yüklenen dosya okunamadı:", indirmeHatasi?.message);
    return { error: "Yüklenen dosya okunamadı; tekrar deneyin." };
  }
  const bayt = new Uint8Array(await dosya.arrayBuffer());
  if (!pdfMi(bayt)) {
    await supabase.storage.from(KOVA).remove([girdi.depoYolu]);
    return { error: "Dosya PDF değil. Kaynağın PDF'ini yükleyin." };
  }

  /* Başlık eşleşmesi bir uyarı, engel değil: taranmış PDF'ten metin
     çıkmayabilir, başlık kapakta resim olabilir. */
  let baslikEslesti: boolean | null = null;
  try {
    const metin = await extractTextFromBuffer(Buffer.from(bayt), "pdf");
    baslikEslesti = metin.trim() ? baslikPdfteGeciyor(girdi.kunye, metin) : null;
  } catch {
    baslikEslesti = null;
  }

  const anahtar = kunyeAnahtari(girdi.kunye);
  const { data: eski } = await supabase
    .from("kaynak_pdfleri")
    .select("depo_yolu")
    .eq("project_id", projectId)
    .eq("kunye_anahtari", anahtar)
    .maybeSingle();

  const { data, error } = await supabase
    .from("kaynak_pdfleri")
    .upsert(
      {
        project_id: projectId,
        olusturan: user.id,
        kunye_anahtari: anahtar,
        kunye: girdi.kunye.trim().slice(0, 2000),
        doi: girdi.doi?.trim().slice(0, 300) || null,
        durum: "yuklendi",
        depo_yolu: girdi.depoYolu,
        kaynak_adres: null,
        baslik_eslesti: baslikEslesti,
        bakildi: new Date().toISOString(),
      },
      { onConflict: "project_id,kunye_anahtari" },
    )
    .select(SECIM)
    .single();
  if (error) {
    console.error("[kaynak-pdf] kaydedilemedi:", error.message);
    return { error: error.code === "42501" ? "Bu çalışmaya yazma yetkiniz yok." : "Kaydedilemedi; tekrar deneyin." };
  }
  // Eski dosya (önceki indirme ya da yükleme) artık kullanılmıyor.
  if (eski?.depo_yolu && eski.depo_yolu !== girdi.depoYolu) await supabase.storage.from(KOVA).remove([eski.depo_yolu]);

  yenile();
  return { satir: data as KaynakPdfSatiri };
}

/**
 * Teslim paketinin (ZIP) içeriği: kaynak PDF'lerinin ZIP'teki adları ve
 * kısa ömürlü indirme bağlantıları, kaynak raporu. ZIP tarayıcıda
 * kuruluyor: PDF'ler sunucunun tek yanıt sınırını (~4,5 MB) hızla aşar.
 *
 * Veriyi dışarı çıkardığı için abonelik kapısı var (Word dışa aktarımıyla
 * aynı). Çalışmayı görebilen (öğrenci, atanan uzman, kurumun gözetim
 * rolleri) paketi indirebiliyor: okuma RLS'te, PDF'ler çalışmanın
 * klasöründe (depolama politikası calisma_klasoru).
 */
export async function teslimPaketi(
  projectId: string,
): Promise<{ error?: string; baslik?: string; dosyalar?: { ad: string; url: string }[]; rapor?: string }> {
  const ctx = await getAuthContext();
  if (!ctx) return { error: await oturumYokMesaji() };
  if (await isSubscriptionBlocked()) return { error: (await abonelikKapaliMesaji()) };
  if (!UUID.test(projectId)) return { error: "Çalışma bulunamadı." };
  const { supabase } = ctx;

  const [{ data: calisma, error: calismaHatasi }, { data: satirlar, error: satirHatasi }] = await Promise.all([
    supabase.from("academic_projects").select("title").eq("id", projectId).maybeSingle(),
    supabase.from("kaynak_pdfleri").select(SECIM).eq("project_id", projectId),
  ]);
  if (calismaHatasi || satirHatasi) {
    console.error("[teslim-paketi] okunamadı:", calismaHatasi?.message ?? satirHatasi?.message);
    return { error: "Paket hazırlanamadı; tekrar deneyin." };
  }
  if (!calisma) return { error: "Çalışma bulunamadı." };

  const paket = paketDosyalari((satirlar ?? []) as KaynakPdfSatiri[]);
  const dosyali = paket.filter((d) => d.ad && d.satir.depo_yolu);
  let dosyalar: { ad: string; url: string }[] = [];
  if (dosyali.length) {
    const { data: imzali, error } = await supabase.storage
      .from(KOVA)
      .createSignedUrls(dosyali.map((d) => d.satir.depo_yolu!), 600);
    if (error) {
      console.error("[teslim-paketi] bağlantılar alınamadı:", error.message);
      return { error: "Kaynak PDF'lerine ulaşılamadı; tekrar deneyin." };
    }
    dosyalar = dosyali
      .map((d, i) => ({ ad: d.ad!, url: imzali?.[i]?.signedUrl ?? "" }))
      .filter((d) => d.url);
  }

  const tarih = new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", dateStyle: "long", timeStyle: "short" }).format(new Date());
  return { baslik: calisma.title, dosyalar, rapor: kaynakRaporu(calisma.title, paket, tarih) };
}
