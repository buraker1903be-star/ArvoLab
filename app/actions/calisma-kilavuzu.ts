"use server";

import { revalidatePath } from "next/cache";
import { createHmac } from "node:crypto";
import { taramaDogrula, taramaImzala } from "@/lib/imzali-tarama";
import { getAuthContext, oturumYokMesaji, type ActionResult } from "@/lib/auth-guards";
import { isSubscriptionBlocked, abonelikKapaliMesaji } from "@/lib/access";
import { ornekKalibi } from "@/lib/atif/tyk";
import { scanGuidelineBytesMetinli, scanGuidelineUrlMetinli, taramaUyarisiCevir, type GuidelineScanResult } from "@/lib/guideline-scan";
import { asistanHakkiVar, asistanKapisi } from "@/lib/ai/erisim";
import { asistanKaydet } from "@/lib/ai/kayit";
import { butceyeTakildi, sor } from "@/lib/ai/saglayici";
import { ALAN_ADI, cozulenUyarilariAyikla, kilavuzIstemi, kilavuzOkumasiniCozumle, kurallariBirlestir, redMi, type KilavuzOkumasi } from "@/lib/ai/kilavuz-kurallari";
import type { AtifSistemi } from "@/lib/atif-sistemi";
import { aktifDil, ceviri } from "@/lib/dil-sunucu";
import { normalizeGuidelineEditorSettings } from "@/lib/guideline-editor-settings";
import {
  bicimOzeti,
  dogrulamaMesaji,
  formaDoldur,
  formuDogrula,
  kurallariKur,
  kilavuzAdi,
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

/** İmzalı belirtecin taşıdığı: tarama sonucu ve kaynağı. */
type ImzaliTarama = { ham: GuidelineScanResult; belgeBasligi: string | null; kaynakAdres: string | null; depoYolu: string | null };

/*
  İmza anahtarı Supabase'in gizli anahtarından TÜRETİLİYOR (ayrı bir sır
  eklenmedi: o anahtar sunucuda her zaman var ve dışarı çıkmıyor). Amaç
  etiketiyle ayrıldığı için başka bir imzayla karışmaz. Anahtar yoksa
  boş dize: imza yine kurulur ama yalnızca aynı yapılandırmada doğrulanır
  — yerel geliştirmede kayıt çalışmaya devam etsin.
*/
const taramaAnahtari = () =>
  createHmac("sha256", process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").update("arvolab:kilavuz-taramasi").digest("hex");
const taramaKapsami = (kullaniciId: string, projectId: string) => `${kullaniciId}:${projectId}`;

export interface TaramaSonucu {
  error?: string;
  /** Öğrenciye onaylatılacak alanlar. */
  form?: DogrulamaFormu;
  /*
    Tarama sonucu, kılavuzun adı ve kaynağı — sunucuda İMZALI ve süreli
    (lib/imzali-tarama.ts). Kayıt yalnızca bunu geri alıyor. Eskiden ham
    sonuç, ad, adres ve dosya yolu ayrı ayrı tarayıcıdan geri geliyor ve
    doğrulanmadan saklanıyordu.
  */
  belirtec?: string;
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
  /*
    Yapay zekânın okuduğu kurallar ve kılavuzdaki ALINTILARI (02.11.2026,
    lib/ai/kilavuz-kurallari.ts). Öğrenci her kuralın kılavuzunda nerede
    yazdığını görür; doğrulanmamış bir okuma burada hiç görünmez.
  */
  kanitlar?: { ad: string; alinti: string }[];
  /** "okundu": yapay zekâ okudu; "kalip": yalnızca kalıpla okundu (kapalı, hak doldu ya da yanıt reddedildi). */
  okuyan?: "yapay-zeka" | "kalip";
}

/*
  KILAVUZU YAPAY ZEKÂYLA OKUMA (02.11.2026). Kalıpla okumanın ÜSTÜNE:
  model okuyamazsa (kurulum yok, abonelik/hak, yanıt reddedildi, ağ)
  tarama düşmez, kalıpla okunan kurallar kalır. Her çalışma kaydedilir
  (AGENTS.md). Öğrencinin deneme hakkından düşmez (lib/ai/erisim.ts).
  Dışarı açılmıyor: "use server" dosyasında export edilmeyen yardımcı.
*/
async function yapayZekaylaOku(
  metin: string,
  projectId: string,
  dil: "tr" | "en",
): Promise<{ okuma: KilavuzOkumasi | null; not: string | null }> {
  const kapi = await asistanKapisi(dil);
  if (!kapi.ok) return { okuma: null, not: null };
  const hak = await asistanHakkiVar(kapi.kullaniciId, dil);
  if (hak) return { okuma: null, not: hak };
  const { mesajlar, kaynak } = kilavuzIstemi(metin);
  const ortak = { kullaniciId: kapi.kullaniciId, calismaId: projectId, yetenek: "kilavuz" as const, baglam: kaynak, basladi: Date.now() };
  try {
    /*
      Bütçe geniş (ÜAK okumasıyla aynı): düşünen modellerde düşünme payı da
      bu bütçeden düşüyor; 4 000 jetonda yanıt 2 071 karakterde kesildi
      (canlı, 02.11.2026). Kesik yanıt artık atılmıyor: tamamlanmış kurallar
      kurtarılıyor (jsonOnar), her biri yine kendi alıntısıyla doğrulanıyor.
    */
    const yanit = await sor(mesajlar, { yetenek: "kilavuz", jsonBekle: true, sicaklik: 0, enFazlaJeton: 16_000, zamanAsimiMs: 150_000 });
    if (butceyeTakildi(yanit.bitis ?? null)) console.warn("[calisma-kilavuzu] yanıt bütçeye takıldı; tamamlanmış kurallar kurtarılıyor", yanit.metin.length);
    // Alıntılar TAM metne karşı doğrulanır (gönderilen kırpılmış parçaya değil).
    const sonuc = kilavuzOkumasiniCozumle(yanit.metin, metin);
    if (redMi(sonuc)) {
      // "bos"ta yanıtın başı da yazılır: biçim sorunu günlükten teşhis edilebilsin (ilk canlı okumalar böyle düştü).
      console.warn("[calisma-kilavuzu] yapay zekâ okuması reddedildi", sonuc.neden, sonuc.ayrinti.slice(0, 5), sonuc.neden === "bos" ? `${yanit.metin.length} karakter | ${yanit.metin.slice(0, 300)} … ${yanit.metin.slice(-200)}` : "");
      await asistanKaydet({ ...ortak, durum: "rejected", redNedeni: sonuc.neden, model: yanit.model, cikti: yanit.metin, bulgular: sonuc });
      return { okuma: null, not: null };
    }
    await asistanKaydet({ ...ortak, durum: "completed", model: yanit.model, cikti: yanit.metin, bulgular: sonuc });
    return { okuma: sonuc, not: null };
  } catch (hata) {
    console.error("[calisma-kilavuzu] yapay zekâ okuması başarısız:", hata instanceof Error ? hata.message : hata);
    await asistanKaydet({ ...ortak, durum: "failed" });
    return { okuma: null, not: null };
  }
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
    let tarama: { sonuc: GuidelineScanResult; metin: string };
    if (girdi.depoYolu) {
      const { data: dosya, error } = await ctx.supabase.storage.from("project-files").download(girdi.depoYolu);
      if (error || !dosya) {
        console.error("[calisma-kilavuzu] dosya depodan okunamadı:", error?.message);
        return { error: t({ tr: "Yüklenen dosya okunamadı. Tekrar yükleyin.", en: "The uploaded file could not be read. Upload it again." }) };
      }
      tarama = await scanGuidelineBytesMetinli(dosya, dosya.type || "application/pdf", girdi.depoYolu);
    } else if (girdi.adres?.trim()) {
      tarama = await scanGuidelineUrlMetinli(girdi.adres.trim());
    } else {
      return { error: t({ tr: "Kılavuz dosyası yükleyin ya da adresini girin.", en: "Upload a guideline file or enter its address." }) };
    }
    let sonuc = tarama.sonuc;

    /*
      Yapay zekâ okuması kalıbın ÜSTÜNE (lib/ai/kilavuz-kurallari.ts,
      kurallariBirlestir): alıntıyla doğrulanan değer kazanır, okumadığı
      kural kalıptan kalır. Bölümler, atıf sistemi ve sayfa sınırı da
      okuduysa onun. Metin yoksa (OCR bile okuyamadıysa) çağrılmaz.
    */
    const yz = tarama.metin.trim().length >= 200 ? await yapayZekaylaOku(tarama.metin, projectId, dil) : { okuma: null, not: null };
    const ekUyarilar: string[] = [];
    if (yz.okuma) {
      const { kurallar, farklar } = kurallariBirlestir(sonuc.suggestedRules, yz.okuma.kurallar);
      sonuc = {
        ...sonuc,
        suggestedRules: kurallar,
        suggestedSections: yz.okuma.zorunluBolumler.length ? yz.okuma.zorunluBolumler : sonuc.suggestedSections,
        detectedCitationStyle: (yz.okuma.atifStili as AtifSistemi | null) ?? sonuc.detectedCitationStyle,
        minPages: yz.okuma.enAzSayfa ?? sonuc.minPages,
        maxPages: yz.okuma.enCokSayfa ?? sonuc.maxPages,
        warnings: cozulenUyarilariAyikla(sonuc.warnings, yz.okuma),
      };
      if (farklar.length) {
        ekUyarilar.push(
          t({
            tr: `${farklar.length} kural iki farklı biçimde okunabildi; kılavuzdaki cümlesiyle doğrulanan değer kullanıldı. Aşağıdaki alıntılara bakın.`,
            en: `${farklar.length} rule(s) could be read in two ways; the value confirmed by its sentence in the guideline was used. Check the quotes below.`,
          }),
        );
      }
    } else if (yz.not) {
      ekUyarilar.push(yz.not);
    }

    const belirtec = taramaImzala(
      {
        ham: sonuc,
        // Ad kaynaktan (dosya adı / adres); eskiden sürüm etiketiydi ("2019"). Bkz. kilavuzAdi.
        belgeBasligi: kilavuzAdi({ depoYolu: girdi.depoYolu, adres: girdi.adres }),
        kaynakAdres: girdi.depoYolu ? null : girdi.adres?.trim() || null,
        depoYolu: girdi.depoYolu || null,
      } satisfies ImzaliTarama,
      taramaAnahtari(),
      taramaKapsami(ctx.user.id, projectId),
    );
    if (!belirtec) {
      return { error: t({ tr: "Kılavuzun okunan içeriği beklenenden büyük; daha kısa bir belge yükleyin.", en: "The guideline's extracted content is larger than expected; upload a shorter document." }) };
    }

    return {
      form: formaDoldur({
        citationStyle: sonuc.detectedCitationStyle,
        requiredSections: sonuc.suggestedSections,
        minPages: sonuc.minPages,
        maxPages: sonuc.maxPages,
      }),
      belirtec,
      /* Çıkarımın uyarıları Türkçe üretiliyor (lib/guideline-scan.ts); ekranda kullanıcının dilinde. */
      uyarilar: [...ekUyarilar, ...sonuc.warnings.map((uyari) => taramaUyarisiCevir(uyari, dil))],
      bicim: bicimOzeti(normalizeGuidelineEditorSettings(sonuc.suggestedRules), dil),
      kanitlar: yz.okuma?.kanitlar.map((k) => ({ ad: ALAN_ADI[k.alan]?.[dil] ?? k.alan, alinti: k.alinti })) ?? [],
      okuyan: yz.okuma ? "yapay-zeka" : "kalip",
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
    /** kilavuzuTara'nın imzalı belirteci; ad, kaynak ve kurallar YALNIZCA buradan. */
    belirtec?: string;
  },
): Promise<ActionResult> {
  const izin = await calismayaYazabilir(projectId);
  if ("hata" in izin) return { error: izin.hata };
  const { ctx } = izin;
  // Yeni kural yazıyor: abonelik kapısı (lib/access.ts).
  if (await isSubscriptionBlocked()) return { error: (await abonelikKapaliMesaji()) };
  const t = await ceviri();
  const dil = await aktifDil();

  /*
    Katalogdaki onaylı kılavuz bağlı olsa da öğrenci KENDİ kılavuzunu
    yükleyebilir (02.11.2026): yüklenen kılavuz öncelikli
    (lib/guideline-rules.ts, calismaKilavuzuOku). Eskiden burada
    reddediliyordu ve enstitü yeni sürüm yayımladığında ya da eşleşme
    yanlış olduğunda öğrencinin kılavuzunu değiştirmesinin yolu yoktu.
  */
  const hatalar = formuDogrula(girdi.form);
  if (hatalar.length > 0) return { error: dogrulamaMesaji(hatalar[0], dil) };

  const dogrulama = taramaDogrula(girdi.belirtec, taramaAnahtari(), taramaKapsami(ctx.user.id, projectId));
  if (!dogrulama.ok) {
    return {
      error:
        dogrulama.neden === "sure"
          ? t({ tr: "Okuma sonucunun süresi doldu; kılavuzu yeniden okutun.", en: "The reading has expired; read the guideline again." })
          : t({ tr: "Okuma sonucu doğrulanamadı; kılavuzu yeniden okutun.", en: "The reading could not be verified; read the guideline again." }),
    };
  }
  const imzali = dogrulama.veri as ImzaliTarama;
  /*
    Dosya yolu taramada kullanıcının klasörüyle sınırlanmıştı ve imza onu
    değişmeden taşıyor; yine de aşağıdaki depo temizliği bu yolu SİLECEĞİ
    için ikinci kez denetleniyor.
  */
  const depoYolu =
    imzali.depoYolu && imzali.depoYolu.startsWith(`${ctx.user.id}/`) && !imzali.depoYolu.includes("..") ? imzali.depoYolu : null;
  const { data: onceki } = await ctx.supabase
    .from("calisma_kilavuzu")
    .select("depo_yolu")
    .eq("project_id", projectId)
    .maybeSingle();

  const kurallar = kurallariKur(girdi.form, {
    belgeBasligi: imzali.belgeBasligi,
    kaynakAdres: imzali.kaynakAdres,
    hamCikarim: imzali.ham,
  });

  const { error } = await ctx.supabase.from("calisma_kilavuzu").upsert(
    {
      project_id: projectId,
      kaynak_adres: imzali.kaynakAdres,
      depo_yolu: depoYolu,
      belge_basligi: imzali.belgeBasligi,
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

    Katalog kılavuzu bağlı çalışmada da yazılır: öğrencinin yüklediği
    kılavuz öncelikli ve stil onunla gelir. Bilinen bedel: katalog
    kılavuzu yeniden eşitlenirse (resync_project_guidelines) tetikleyici
    stili katalogdakine çevirebilir; öğrenci kılavuzunu yeniden onaylayınca
    düzelir.
  */
  const { error: stilHatasi } = await ctx.supabase
    .from("academic_projects")
    .update({ citation_style: girdi.form.atifStili })
    .eq("id", projectId);
  await eskiDosyayiSil(ctx.supabase, onceki?.depo_yolu, depoYolu);
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
/*
  Değiştirilen ya da kaldırılan kılavuzun PDF'i depodan silinir (29.10.2026).
  Eskiden hiç silinmiyordu: her yükleme project-files'ta kalıyordu ve
  depo_yolu'nu okuyan kimse yoktu (kaynak-pdf.ts ile uak-tablosu.ts eski
  dosyayı zaten siliyor). Silinemezse akış düşmez, yalnızca log'a yazılır:
  kılavuz kaydedildi/kaldırıldı, artık dosya kalması bir bedel, hata değil.
*/
async function eskiDosyayiSil(
  supabase: NonNullable<Awaited<ReturnType<typeof getAuthContext>>>["supabase"],
  eskiYol: string | null | undefined,
  yeniYol: string | null,
) {
  if (!eskiYol || eskiYol === yeniYol) return;
  const { error } = await supabase.storage.from("project-files").remove([eskiYol]);
  if (error) console.error("[calisma-kilavuzu] eski kılavuz dosyası silinemedi:", error.message);
}

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
  const { data: silinen, error } = await izin.ctx.supabase
    .from("calisma_kilavuzu")
    .delete()
    .eq("project_id", projectId)
    .select("depo_yolu")
    .maybeSingle();
  if (error) {
    console.error("[calisma-kilavuzu] silinemedi:", error.message);
    return { error: t({ tr: "Kılavuz kaldırılamadı. Tekrar deneyin.", en: "The guideline could not be removed. Try again." }) };
  }
  await eskiDosyayiSil(izin.ctx.supabase, silinen?.depo_yolu, null);
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
