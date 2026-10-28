"use server";

import { revalidatePath } from "next/cache";
import { getAuthContext, oturumYokMesaji, type ActionResult } from "@/lib/auth-guards";
import { isSubscriptionBlocked, abonelikKapaliMesaji } from "@/lib/access";
import { ornekKalibi } from "@/lib/atif/tyk";
import { scanGuidelineBytes, scanGuidelineUrl, taramaUyarisiCevir, type GuidelineScanResult } from "@/lib/guideline-scan";
import { aktifDil, ceviri } from "@/lib/dil-sunucu";
import { normalizeGuidelineEditorSettings } from "@/lib/guideline-editor-settings";
import {
  bicimOzeti,
  dogrulamaMesaji,
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
  if (!ctx) return { hata: (await oturumYokMesaji()) } as const;
  const t = await ceviri();
  const { data, error } = await ctx.supabase
    .from("academic_projects")
    .select("id, owner_id, assignee_id, guideline_id")
    .eq("id", projectId)
    .maybeSingle();
  if (error) {
    console.error("[calisma-kilavuzu] çalışma okunamadı:", error.message);
    return { hata: t({ tr: "Çalışma okunamadı; tekrar deneyin.", en: "The work could not be read; try again." }) } as const;
  }
  if (!data) return { hata: t({ tr: "Çalışma bulunamadı.", en: "Work not found." }) } as const;
  if (data.owner_id !== ctx.user.id && data.assignee_id !== ctx.user.id) {
    return { hata: t({ tr: "Bu çalışmaya kılavuz yükleyemezsiniz.", en: "You can't upload a guideline to this work." }) } as const;
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
  /* Ağır çözümleme (PDF, OCR, dış adresten indirme): abonelik kapısı.
     Eskiden yoktu; işlem doğrudan çağrılıp OCR tetiklenebiliyordu. */
  if (await isSubscriptionBlocked()) return { error: (await abonelikKapaliMesaji()) };
  const t = await ceviri();
  const dil = await aktifDil();
  /*
    Yol tarayıcıdan geliyor: yalnızca kullanıcının kendi klasörü. Depo
    politikası gözetim rollerine bütün kovayı açtığı için, bu denetim
    olmadan başkasının dosyası taratılıp içeriği okunabilirdi
    (document-upload.ts'teki denetimin eşi).
  */
  if (girdi.depoYolu && (!girdi.depoYolu.startsWith(`${ctx.user.id}/`) || girdi.depoYolu.includes(".."))) {
    return { error: t({ tr: "Geçersiz dosya yolu.", en: "Invalid file path." }) };
  }

  try {
    let sonuc: GuidelineScanResult;
    if (girdi.depoYolu) {
      const { data: dosya, error } = await ctx.supabase.storage.from("project-files").download(girdi.depoYolu);
      if (error || !dosya) {
        console.error("[calisma-kilavuzu] dosya depodan okunamadı:", error?.message);
        return { error: t({ tr: "Yüklenen dosya okunamadı. Tekrar yükleyin.", en: "The uploaded file could not be read. Upload it again." }) };
      }
      sonuc = await scanGuidelineBytes(dosya, dosya.type || "application/pdf", girdi.depoYolu);
    } else if (girdi.adres?.trim()) {
      sonuc = await scanGuidelineUrl(girdi.adres.trim());
    } else {
      return { error: t({ tr: "Kılavuz dosyası yükleyin ya da adresini girin.", en: "Upload a guideline file or enter its address." }) };
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
      /* Çıkarımın uyarıları Türkçe üretiliyor (lib/guideline-scan.ts); ekranda kullanıcının dilinde. */
      uyarilar: sonuc.warnings.map((uyari) => taramaUyarisiCevir(uyari, dil)),
      bicim: bicimOzeti(normalizeGuidelineEditorSettings(sonuc.suggestedRules), dil),
    };
  } catch (err) {
    console.error("[calisma-kilavuzu] tarama başarısız:", err);
    const mesaj = err instanceof Error ? taramaUyarisiCevir(err.message, dil) : t({ tr: "Kılavuz okunamadı.", en: "The guideline could not be read." });
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
  // Yeni kural yazıyor: abonelik kapısı (lib/access.ts).
  if (await isSubscriptionBlocked()) return { error: (await abonelikKapaliMesaji()) };
  const t = await ceviri();
  const dil = await aktifDil();

  /*
    Katalogda onaylı kılavuz varsa öğrencinin yüklediği uygulanmaz
    zaten (lib/guideline-rules.ts sırası). Yazmasına da izin
    vermiyoruz: uygulanmayacak bir kuralı kaydetmek, kullanıcıya
    yaptığı işin bir karşılığı varmış gibi göstermek olurdu.
  */
  if (calisma.guideline_id) {
    return {
      error: t({
        tr: "Bu çalışmaya kurumunuzun onaylı kılavuzu bağlı; kendi kılavuzunuz uygulanmaz.",
        en: "Your institution's approved guideline is linked to this work; your own guideline is not applied.",
      }),
    };
  }

  const hatalar = formuDogrula(girdi.form);
  if (hatalar.length > 0) return { error: dogrulamaMesaji(hatalar[0], dil) };

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
    return { error: t({ tr: "Kılavuz kaydedilemedi. Tekrar deneyin.", en: "The guideline could not be saved. Try again." }) };
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
    return {
      error: t({
        tr: "Kurallar kaydedildi ama çalışmanın atıf stili güncellenemedi; sayfayı yenileyip tekrar deneyin.",
        en: "The rules were saved, but the work's citation style could not be updated; refresh the page and try again.",
      }),
    };
  }

  revalidatePath(`/dashboard/editor/${projectId}`);
  revalidatePath("/dashboard/editor");
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
  const t = await ceviri();
  const projectId = String(formData.get("projectId") ?? "");
  if (!projectId) return { error: t({ tr: "Çalışma bulunamadı.", en: "Work not found." }) };

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
    return { error: t({ tr: "Kılavuz kaldırılamadı. Tekrar deneyin.", en: "The guideline could not be removed. Try again." }) };
  }
  revalidatePath(`/dashboard/editor/${projectId}`);
  revalidatePath("/dashboard/editor");
  revalidatePath(`/dashboard/editor/${projectId}/write`);
  return { success: true };
}

/**
 * Kılavuzun örnek atıfı (academic_projects.ornek_atif). Kaynakça denetimi
 * atıfları bunun noktalamasına göre denetliyor, editör atıfı buna göre
 * yazıyor. Boş gönderilirse silinir. Yetki RLS'te (çalışmayı güncelleyebilen).
 */
export async function ornekAtifKaydet(projectId: string, ornek: string): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { error: await oturumYokMesaji() };
  const t = await ceviri();
  const temiz = ornek.replace(/\s+/g, " ").trim().slice(0, 300);
  if (temiz && !ornekKalibi(temiz)) {
    return {
      error: t({
        tr: "Örnekte parantez içinde yazar ve yıl olan bir atıf bulunamadı. Örn. (Yılmaz, 2020: 14)",
        en: "No citation with an author and year in parentheses was found in the example. E.g. (Smith, 2020: 14)",
      }),
    };
  }
  const { data, error } = await ctx.supabase
    .from("academic_projects")
    .update({ ornek_atif: temiz || null })
    .eq("id", projectId)
    .select("id");
  if (error) {
    console.error("[örnek atıf] kaydedilemedi:", error.message);
    return { error: t({ tr: "Kaydedilemedi; tekrar deneyin.", en: "Could not save; try again." }) };
  }
  // RLS yetkisiz güncellemeyi sessizce sıfır satıra çeviriyor; başarı sanılmasın.
  if (!data?.length) return { error: t({ tr: "Bu çalışmayı güncelleme yetkiniz yok.", en: "You don't have permission to update this work." }) };
  revalidatePath("/dashboard/editor");
  revalidatePath(`/dashboard/editor/${projectId}`);
  revalidatePath(`/dashboard/editor/${projectId}/write`);
  return {};
}
