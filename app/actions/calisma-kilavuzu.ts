"use server";

import { revalidatePath } from "next/cache";
import { getAuthContext, SESSION_MISSING, type ActionResult } from "@/lib/auth-guards";
import { scanGuidelineBytes, scanGuidelineUrl, type GuidelineScanResult } from "@/lib/guideline-scan";
import { normalizeGuidelineEditorSettings } from "@/lib/guideline-editor-settings";
import {
  bicimOzeti,
  DOGRULAMA_MESAJI,
  formaDoldur,
  formuDogrula,
  kurallariKur,
  type DogrulamaFormu,
} from "@/lib/kilavuz-dogrulama";

/*
  ÖĞRENCİNİN KENDİ KILAVUZU (26.10.2026).

  Katalogda onaylı kılavuzu olmayan öğrenci kendi PDF'ini yüklüyor ya
  da adresini veriyor; kurallar çıkarımla doldurulup ONA onaylatılıyor.
  Kayıt kataloğa değil çalışmaya bağlı tabloya gidiyor
  (supabase/migrations/20261025222734).

  İKİ AYRI İŞLEM, bilerek. Tarama hiçbir şey YAZMIYOR; yazan işlem
  yalnızca öğrencinin onayladığı değerleri alıyor. Tek işlem olsaydı
  çıkarımın bulduğu her şey doğrulanmadan kurala dönerdi — yanlış bir
  kural sessizdir ve program "teslime hazır görünüyor" derken ona
  dayanır.
*/

/** Çalışmaya yazma yetkisi: sahip ya da atanan kişi (RLS ile aynı kural). */
async function calismayaYazabilir(projectId: string) {
  const ctx = await getAuthContext();
  if (!ctx) return { hata: SESSION_MISSING.error } as const;
  const { data, error } = await ctx.supabase
    .from("academic_projects")
    .select("id, owner_id, assignee_id, guideline_id")
    .eq("id", projectId)
    .maybeSingle();
  if (error) {
    console.error("[calisma-kilavuzu] çalışma okunamadı:", error.message);
    return { hata: "Çalışma okunamadı; tekrar deneyin." } as const;
  }
  if (!data) return { hata: "Çalışma bulunamadı." } as const;
  if (data.owner_id !== ctx.user.id && data.assignee_id !== ctx.user.id) {
    return { hata: "Bu çalışmaya kılavuz yükleyemezsiniz." } as const;
  }
  return { ctx, calisma: data } as const;
}

export interface TaramaSonucu {
  error?: string;
  /** Öğrenciye onaylatılacak alanlar. */
  form?: DogrulamaFormu;
  belgeBasligi?: string | null;
  /** Çıkarımın ham sonucu; kaydederken geri gönderiliyor. */
  ham?: GuidelineScanResult;
  /* Çıkarımın kendi uyarıları (OCR gürültüsü, düşük güven). Öğrenciye
     gösteriliyor: "bunu ben çıkardım, siz bakın" demenin yolu. */
  uyarilar?: string[];
  /*
    Onaylatılmayan ama UYGULANACAK biçim kuralları, okunur cümleler
    hâlinde. Düzenlenmiyor, söyleniyor: on alanlık bir form okunmadan
    "tamam"lanır ve doğrulama tiyatroya döner — ama sessizce uygulamak
    da öğrenciye metninin neden başkalaştığını açıklamaz.
  */
  bicim?: string[];
}

/**
 * Yüklenen dosyayı ya da verilen adresi tarar. HİÇBİR ŞEY YAZMAZ.
 *
 * Dosya tarayıcıdan depoya yüklenmiş oluyor; burada sunucu tarafında
 * okunuyor (document-upload.ts ile aynı kalıp).
 */
export async function kilavuzuTara(
  projectId: string,
  girdi: { depoYolu?: string | null; adres?: string | null },
): Promise<TaramaSonucu> {
  const izin = await calismayaYazabilir(projectId);
  if ("hata" in izin) return { error: izin.hata };
  const { ctx } = izin;

  try {
    let sonuc: GuidelineScanResult;
    if (girdi.depoYolu) {
      const { data: dosya, error } = await ctx.supabase.storage.from("project-files").download(girdi.depoYolu);
      if (error || !dosya) {
        console.error("[calisma-kilavuzu] dosya depodan okunamadı:", error?.message);
        return { error: "Yüklenen dosya okunamadı. Tekrar yükleyin." };
      }
      sonuc = await scanGuidelineBytes(dosya, dosya.type || "application/pdf", girdi.depoYolu);
    } else if (girdi.adres?.trim()) {
      sonuc = await scanGuidelineUrl(girdi.adres.trim());
    } else {
      return { error: "Kılavuz dosyası yükleyin ya da adresini girin." };
    }

    return {
      form: formaDoldur({
        citationStyle: sonuc.detectedCitationHint,
        requiredSections: sonuc.suggestedSections,
        minPages: sonuc.minPages,
        maxPages: sonuc.maxPages,
      }),
      belgeBasligi: sonuc.versionLabel,
      ham: sonuc,
      uyarilar: sonuc.warnings,
      bicim: bicimOzeti(normalizeGuidelineEditorSettings(sonuc.suggestedRules)),
    };
  } catch (err) {
    console.error("[calisma-kilavuzu] tarama başarısız:", err);
    const mesaj = err instanceof Error ? err.message : "Kılavuz okunamadı.";
    return { error: mesaj };
  }
}

/**
 * Öğrencinin ONAYLADIĞI değerleri çalışmaya yazar.
 *
 * Çıkarımın ham sonucu ayrıca saklanıyor: onay kuyruğunda yöneticinin
 * "neyi okumuş" diye bakabilmesi için.
 */
export async function kilavuzuKaydet(
  projectId: string,
  girdi: {
    form: DogrulamaFormu;
    belgeBasligi?: string | null;
    kaynakAdres?: string | null;
    depoYolu?: string | null;
    hamCikarim?: unknown;
  },
): Promise<ActionResult> {
  const izin = await calismayaYazabilir(projectId);
  if ("hata" in izin) return { error: izin.hata };
  const { ctx, calisma } = izin;

  /*
    Katalogda onaylı kılavuz varsa öğrencinin yüklediği uygulanmaz
    zaten (lib/guideline-rules.ts sırası). Yazmasına da izin
    vermiyoruz: uygulanmayacak bir kuralı kaydetmek, kullanıcıya
    yaptığı işin bir karşılığı varmış gibi göstermek olurdu.
  */
  if (calisma.guideline_id) {
    return { error: "Bu çalışmaya kurumunuzun onaylı kılavuzu bağlı; kendi kılavuzunuz uygulanmaz." };
  }

  const hatalar = formuDogrula(girdi.form);
  if (hatalar.length > 0) return { error: DOGRULAMA_MESAJI[hatalar[0]] };

  const kurallar = kurallariKur(girdi.form, {
    belgeBasligi: girdi.belgeBasligi,
    kaynakAdres: girdi.kaynakAdres,
    hamCikarim: girdi.hamCikarim,
  });

  const { error } = await ctx.supabase.from("calisma_kilavuzu").upsert(
    {
      project_id: projectId,
      kaynak_adres: girdi.kaynakAdres ?? null,
      depo_yolu: girdi.depoYolu ?? null,
      belge_basligi: girdi.belgeBasligi ?? null,
      kurallar,
      yukleyen: ctx.user.id,
      guncellendi: new Date().toISOString(),
    },
    { onConflict: "project_id" },
  );
  if (error) {
    console.error("[calisma-kilavuzu] kaydedilemedi:", error.message);
    return { error: "Kılavuz kaydedilemedi. Tekrar deneyin." };
  }

  /*
    ÇALIŞMANIN ATIF STİLİ DE AYNI OLUYOR.

    Kurallar IEEE derken çalışmanın kendi alanı APA 7'de kalsaydı
    sessiz bir uyuşmazlık doğardı: kaynakça denetimi ve atıf ekleme
    çalışmanın alanını okuyor, teslim kontrolü ise kılavuzun kuralını.
    Öğrenci zaten az önce bu stili ONAYLADI; iki yerde iki ayrı
    cevap olmasının savunulur bir gerekçesi yok.

    Katalog kılavuzu bağlıyken bu yol zaten kapalı (yukarıda
    reddediliyor), yani kılavuzun kuralını elle seçimle bozma riski
    doğmuyor.
  */
  const { error: stilHatasi } = await ctx.supabase
    .from("academic_projects")
    .update({ citation_style: girdi.form.atifStili })
    .eq("id", projectId);
  if (stilHatasi) {
    console.error("[calisma-kilavuzu] çalışmanın atıf stili güncellenemedi:", stilHatasi.message);
    return { error: "Kurallar kaydedildi ama çalışmanın atıf stili güncellenemedi; sayfayı yenileyip tekrar deneyin." };
  }

  revalidatePath(`/dashboard/editor/${projectId}`);
  revalidatePath(`/dashboard/editor/${projectId}/write`);
  return { success: true };
}

/*
  Öğrenci yüklediği kılavuzu kaldırır; çalışma kılavuzsuz kalır.

  FormData alıyor çünkü çağıran ActionForm: geri alınamaz işlemde onay
  penceresini (confirmMessage) ve hata/başarı bildirimini o yürütüyor.
  Eskiden imza (projectId: string) idi ve HİÇBİR YERDEN çağrılmıyordu —
  yani kuralları yanlış çıkarılmış bir kılavuzu yükleyen öğrencinin onu
  geri alma yolu yoktu.
*/
export async function kilavuzuKaldir(formData: FormData): Promise<ActionResult> {
  const projectId = String(formData.get("projectId") ?? "");
  if (!projectId) return { error: "Çalışma bulunamadı." };

  const izin = await calismayaYazabilir(projectId);
  if ("hata" in izin) return { error: izin.hata };

  /*
    Çalışmanın citation_style'ı BİLEREK geri alınmıyor. Kılavuz onu
    bir kez değiştirdi; metindeki atıflar ve kaynakça o sisteme göre
    yazılmış olabilir. Kılavuz kalkınca stili eski değerine döndürmek,
    öğrencinin yazdığı künyeleri sessizce "hatalı" gösterirdi.
  */
  const { error } = await izin.ctx.supabase.from("calisma_kilavuzu").delete().eq("project_id", projectId);
  if (error) {
    console.error("[calisma-kilavuzu] silinemedi:", error.message);
    return { error: "Kılavuz kaldırılamadı. Tekrar deneyin." };
  }
  revalidatePath(`/dashboard/editor/${projectId}`);
  revalidatePath(`/dashboard/editor/${projectId}/write`);
  return { success: true };
}
