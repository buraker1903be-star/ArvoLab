"use server";

import { revalidatePath } from "next/cache";
import { getAuthContext, oturumYokMesaji, type ActionResult } from "@/lib/auth-guards";
import { isSubscriptionBlocked, abonelikKapaliMesaji } from "@/lib/access";
import { adminIstemcisiVarsa } from "@/lib/supabase/admin";
import { ALINTI_HATASI_METIN, alintiDenetle } from "@/lib/kanit/alinti";
import { aktifDil, ceviri } from "@/lib/dil-sunucu";
import type { Cevirici, Metin } from "@/lib/dil";
import { kunyeDogrula } from "@/lib/kanit/dizin";
import { kunyeOzeti } from "@/lib/kanit/kunye-karsilastirma";
import type { DestekDuzeyi, KanitKaydi, KaynakOzeti } from "@/lib/kanit/durum";

/*
  Kanıt zinciri kayıtları (migration 20261026065320).

  Asıl güvenlik RLS ve tetikleyicide: alıntının incelenen metinde geçmesi,
  metinsiz hüküm verilememesi, metin değişince eski hükmün düşmesi
  veritabanının kuralı. Buradaki denetimler aynı kuralları kullanıcıya
  anlaşılır bir mesajla söylemek için (AGENTS.md: rol kontrolü RLS'in
  yerini tutmaz).

  Abonelik kapısı: yeni kayıt ekleme ve dış dizine giden künye doğrulaması
  kapıdan geçer. Mevcut kaydın güncellenmesi, notlar ve silme geçmez —
  kullanıcı kendi verisini yönetebilmeli (lib/access.ts).
*/

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HUKUMLER: DestekDuzeyi[] = ["dogrudan", "kismen", "dolayli", "celisiyor", "dogrulanamadi"];
/* Saatlik künye doğrulama hakkı: Crossref ve OpenAlex ücretsiz ve açık;
   sınır kota değil nezaket (literatür aramasındaki gerekçe). */
const SAATLIK_KUNYE_HAKKI = 60;
const KAYIT_YOK: Metin = { tr: "Kayıt bulunamadı.", en: "Record not found." };
const KAYIT_YOK_YA_DA_YETKI: Metin = {
  tr: "Kayıt bulunamadı ya da düzenleme yetkiniz yok.",
  en: "Record not found, or you do not have permission to edit it.",
};
const IDDIA_KISA: Metin = { tr: "İddiayı yazın (en az birkaç sözcük).", en: "Write the claim (at least a few words)." };

const metin = (formData: FormData, ad: string, sinir: number) => {
  const deger = String(formData.get(ad) ?? "").trim();
  return deger ? deger.slice(0, sinir) : null;
};
const kimlik = (formData: FormData, ad: string) => {
  const deger = String(formData.get(ad) ?? "").trim();
  return UUID.test(deger) ? deger : null;
};

const yollar = (projectId: string) => {
  revalidatePath(`/dashboard/editor/${projectId}/kanit`);
  revalidatePath(`/dashboard/editor/${projectId}/makale`);
  revalidatePath(`/dashboard/editor/${projectId}`);
  // Kanıt matrisi Çalışmalarım'daki karttan da pencere olarak açılıyor.
  revalidatePath("/dashboard/editor");
};

/** Veritabanı hatasını kullanıcının anlayacağı cümleye çevirir. */
function dbHatasi(t: Cevirici, hata: { code?: string; message?: string }, varsayilan: Metin): ActionResult {
  const mesaj = hata.message ?? "";
  if (hata.code === "42501" && /kaynağa erişiminiz yok/.test(mesaj)) return { error: t({ tr: "Bu kaynağa erişiminiz yok.", en: "You do not have access to this source." }) };
  if (hata.code === "42501") return { error: t({ tr: "Bu çalışmada kanıt kaydı yazma yetkiniz yok.", en: "You do not have permission to write evidence records for this work." }) };
  if (/Alıntı incelenen metinde geçmiyor/.test(mesaj)) return { error: t(ALINTI_HATASI_METIN.metinde_yok) };
  if (/kanit_metinsiz_hukum_yok/.test(mesaj)) {
    return {
      error: t({
        tr: "Destek düzeyi verebilmek için önce incelenen metni ve ondan bir alıntıyı ekleyin.",
        en: "To assign a support level, first add the reviewed text and a quote from it.",
      }),
    };
  }
  console.error("[kanit]", hata.code, mesaj);
  return { error: t(varsayilan) };
}

export type KanitMatrisiVerisi = {
  kayitlar: KanitKaydi[];
  kaynaklar: KaynakOzeti[];
  okunamadi: boolean;
};

/**
 * Çalışmanın bütün kanıt kayıtları ve bağlanabilecek kaynaklar.
 *
 * SINIRSIZ okunuyor: matrisin üst özeti bu listeden sayılıyor ve sınırlı
 * bir sorgudan sayı çıkarmak sınıra ulaşılana kadar belirti vermeyen bir
 * hatadır (npm run check:rakamlar). Bir çalışmadaki iddia sayısı yüzlerle
 * sınırlı kalır.
 */
export async function kanitMatrisiOku(projectId: string): Promise<KanitMatrisiVerisi> {
  const ctx = await getAuthContext();
  if (!ctx || !UUID.test(projectId)) return { kayitlar: [], kaynaklar: [], okunamadi: false };

  const [kayit, kaynak] = await Promise.all([
    ctx.supabase
      .from("kanit_kayitlari")
      .select(
        "id, iddia, bolum, atif, kaynak_id, kunye_durumu, kunye_kaynagi, kunye_bakildi, kunye_ayrintisi, erisim_durumu, erisim_adresi, incelenen_metin, incelenen_kapsam, incelenen_surum, konum, alinti, destek_duzeyi, degerlendiren, gerekce, degerlendirildi, insan_incelemesi, celisen, eksik_kanit, duzeltme",
      )
      .eq("project_id", projectId)
      .order("olusturuldu", { ascending: true }),
    /*
      Bağlanabilecek kaynaklar: kullanıcının kendi listesi ve bu
      çalışmaya bağlı kaynaklar (tetikleyicideki kuralın aynısı).
    */
    ctx.supabase
      .from("literature_sources")
      .select("id, title, authors, year, container_title, doi_or_url")
      .or(`owner_id.eq.${ctx.user.id},project_id.eq.${projectId}`)
      .order("created_at", { ascending: false }),
  ]);

  if (kayit.error) console.error("[kanit] kayıtlar okunamadı:", kayit.error.message);
  if (kaynak.error) console.error("[kanit] kaynaklar okunamadı:", kaynak.error.message);
  return {
    kayitlar: (kayit.data ?? []) as KanitKaydi[],
    kaynaklar: (kaynak.data ?? []) as KaynakOzeti[],
    okunamadi: Boolean(kayit.error || kaynak.error),
  };
}

export async function kanitEkle(formData: FormData): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { error: await oturumYokMesaji() };
  const t = await ceviri();
  if (await isSubscriptionBlocked()) return { error: (await abonelikKapaliMesaji()) };

  const projectId = kimlik(formData, "project_id");
  if (!projectId) return { error: t({ tr: "Çalışma bulunamadı.", en: "Work not found." }) };
  const iddia = metin(formData, "iddia", 2000);
  if (!iddia || iddia.length < 5) return { error: t(IDDIA_KISA) };

  const { error } = await ctx.supabase.from("kanit_kayitlari").insert({
    project_id: projectId,
    olusturan: ctx.user.id,
    iddia,
    bolum: metin(formData, "bolum", 200),
    atif: metin(formData, "atif", 300),
    kaynak_id: kimlik(formData, "kaynak_id"),
  });
  if (error) return dbHatasi(t, error, { tr: "İddia eklenemedi.", en: "The claim could not be added." });

  yollar(projectId);
  return { success: true, message: t({ tr: "İddia kanıt matrisine eklendi.", en: "The claim was added to the evidence matrix." }) };
}

/** İddia, bölüm, atıf ve kaynak. İddia ya da kaynak değişirse eski sonuçlar veritabanında düşer. */
export async function kanitGuncelle(formData: FormData): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { error: await oturumYokMesaji() };
  const t = await ceviri();
  const id = kimlik(formData, "id");
  const projectId = kimlik(formData, "project_id");
  if (!id || !projectId) return { error: t(KAYIT_YOK) };
  const iddia = metin(formData, "iddia", 2000);
  if (!iddia || iddia.length < 5) return { error: t(IDDIA_KISA) };

  const { data, error } = await ctx.supabase
    .from("kanit_kayitlari")
    .update({ iddia, bolum: metin(formData, "bolum", 200), atif: metin(formData, "atif", 300), kaynak_id: kimlik(formData, "kaynak_id") })
    .eq("id", id)
    .select("id");
  if (error) return dbHatasi(t, error, { tr: "Kayıt güncellenemedi.", en: "The record could not be updated." });
  if (!data?.length) return { error: t(KAYIT_YOK_YA_DA_YETKI) };

  yollar(projectId);
  return {
    success: true,
    message: t({
      tr: "Kayıt güncellendi. İddia ya da kaynak değiştiyse önceki doğrulama sonuçları sıfırlandı.",
      en: "Record updated. If the claim or source changed, previous verification results were reset.",
    }),
  };
}

/** Kaynaktan incelenen metin, kapsam beyanı, konum ve alıntı. */
export async function kanitMetniKaydet(formData: FormData): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { error: await oturumYokMesaji() };
  const t = await ceviri();
  const id = kimlik(formData, "id");
  const projectId = kimlik(formData, "project_id");
  if (!id || !projectId) return { error: t(KAYIT_YOK) };

  const incelenen = metin(formData, "incelenen_metin", 20000);
  const kapsam = String(formData.get("incelenen_kapsam") ?? "") === "tam_metin" ? "tam_metin" : "bolum";
  const alinti = metin(formData, "alinti", 1000);

  if (alinti) {
    const denetim = alintiDenetle(alinti, incelenen);
    if (!denetim.gecti) return { error: t(ALINTI_HATASI_METIN[denetim.neden]) };
  }

  const { data, error } = await ctx.supabase
    .from("kanit_kayitlari")
    .update(
      incelenen
        ? {
            incelenen_metin: incelenen,
            incelenen_kapsam: kapsam,
            incelenen_surum: metin(formData, "incelenen_surum", 300),
            konum: metin(formData, "konum", 200),
            alinti,
          }
        : // Metin silindiyse ona bağlı her şey de gider; hüküm metinsiz kalamaz.
          {
            incelenen_metin: null,
            incelenen_kapsam: null,
            incelenen_surum: null,
            konum: null,
            alinti: null,
            destek_duzeyi: "degerlendirilmedi",
            degerlendiren: null,
            gerekce: null,
            asistan_kaydi: null,
            degerlendirildi: null,
          },
    )
    .eq("id", id)
    .select("id");
  if (error) return dbHatasi(t, error, { tr: "Metin kaydedilemedi.", en: "The text could not be saved." });
  if (!data?.length) return { error: t(KAYIT_YOK_YA_DA_YETKI) };

  yollar(projectId);
  return {
    success: true,
    message: incelenen
      ? t({
          tr: "Kanıt metni kaydedildi. Metin değiştiyse önceki değerlendirme sıfırlandı.",
          en: "Evidence text saved. If the text changed, the previous assessment was reset.",
        })
      : t({ tr: "Kanıt metni kaldırıldı.", en: "Evidence text removed." }),
  };
}

/** Kullanıcının kendi değerlendirmesi: insan incelemesi sayılır. */
export async function kanitDegerlendirmesiKaydet(formData: FormData): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { error: await oturumYokMesaji() };
  const t = await ceviri();
  const id = kimlik(formData, "id");
  const projectId = kimlik(formData, "project_id");
  if (!id || !projectId) return { error: t(KAYIT_YOK) };
  const duzey = String(formData.get("destek_duzeyi") ?? "") as DestekDuzeyi;
  if (!HUKUMLER.includes(duzey)) return { error: t({ tr: "Bir destek düzeyi seçin.", en: "Choose a support level." }) };

  const { data, error } = await ctx.supabase
    .from("kanit_kayitlari")
    .update({
      destek_duzeyi: duzey,
      degerlendiren: "kullanici",
      gerekce: metin(formData, "gerekce", 2000),
      asistan_kaydi: null,
      degerlendirildi: new Date().toISOString(),
      insan_incelemesi: "yapildi",
    })
    .eq("id", id)
    .select("id");
  if (error) return dbHatasi(t, error, { tr: "Değerlendirme kaydedilemedi.", en: "The assessment could not be saved." });
  if (!data?.length) return { error: t(KAYIT_YOK_YA_DA_YETKI) };

  yollar(projectId);
  return { success: true, message: t({ tr: "Değerlendirmeniz kaydedildi.", en: "Your assessment was saved." }) };
}

/** Otomatik değerlendirmeyi bir insanın gözden geçirdiğini kaydeder. */
export async function insanIncelemesiYapildi(formData: FormData): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { error: await oturumYokMesaji() };
  const t = await ceviri();
  const id = kimlik(formData, "id");
  const projectId = kimlik(formData, "project_id");
  if (!id || !projectId) return { error: t(KAYIT_YOK) };

  const { data, error } = await ctx.supabase.from("kanit_kayitlari").update({ insan_incelemesi: "yapildi" }).eq("id", id).select("id");
  if (error) return dbHatasi(t, error, { tr: "İnceleme kaydedilemedi.", en: "The review could not be saved." });
  if (!data?.length) return { error: t(KAYIT_YOK_YA_DA_YETKI) };

  yollar(projectId);
  return { success: true, message: t({ tr: "İnceleme kaydedildi.", en: "Review saved." }) };
}

/** Matrisin "çelişen çalışmalar", "eksik kanıt" ve "önerilen düzeltme" sütunları. */
export async function kanitNotlariKaydet(formData: FormData): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { error: await oturumYokMesaji() };
  const t = await ceviri();
  const id = kimlik(formData, "id");
  const projectId = kimlik(formData, "project_id");
  if (!id || !projectId) return { error: t(KAYIT_YOK) };

  const { data, error } = await ctx.supabase
    .from("kanit_kayitlari")
    .update({
      celisen: metin(formData, "celisen", 1000),
      eksik_kanit: metin(formData, "eksik_kanit", 1000),
      duzeltme: metin(formData, "duzeltme", 1000),
    })
    .eq("id", id)
    .select("id");
  if (error) return dbHatasi(t, error, { tr: "Notlar kaydedilemedi.", en: "The notes could not be saved." });
  if (!data?.length) return { error: t(KAYIT_YOK_YA_DA_YETKI) };

  yollar(projectId);
  return { success: true, message: t({ tr: "Notlar kaydedildi.", en: "Notes saved." }) };
}

export async function kanitSil(formData: FormData): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { error: await oturumYokMesaji() };
  const t = await ceviri();
  const id = kimlik(formData, "id");
  const projectId = kimlik(formData, "project_id");
  if (!id || !projectId) return { error: t(KAYIT_YOK) };

  const { data, error } = await ctx.supabase.from("kanit_kayitlari").delete().eq("id", id).select("id");
  if (error) return dbHatasi(t, error, { tr: "Kayıt silinemedi.", en: "The record could not be deleted." });
  if (!data?.length) return { error: t({ tr: "Kayıt bulunamadı ya da silme yetkiniz yok.", en: "Record not found, or you do not have permission to delete it." }) };

  yollar(projectId);
  return { success: true, message: t({ tr: "Kayıt silindi.", en: "Record deleted." }) };
}

/**
 * Bağlı kaynağın künyesini Crossref/OpenAlex'te doğrular ve açık erişim
 * bilgisini alır. Dizine ulaşılamazsa HİÇBİR sonuç yazılmaz
 * (lib/kanit/dizin.ts): geçici bir arıza "doğrulanamadı" diye kaydedilmez.
 */
export async function kunyeyiDogrula(formData: FormData): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { error: await oturumYokMesaji() };
  const t = await ceviri();
  if (await isSubscriptionBlocked()) return { error: (await abonelikKapaliMesaji()) };
  const id = kimlik(formData, "id");
  const projectId = kimlik(formData, "project_id");
  if (!id || !projectId) return { error: t(KAYIT_YOK) };

  // Sayaç kurulamıyorsa doğrulama engellenmiyor (bkz. adminIstemcisiVarsa).
  const admin = adminIstemcisiVarsa();
  if (admin) {
    const { data: izin, error } = await admin.rpc("rate_limit_hit", {
      p_key: `kunye-dogrulama:${ctx.user.id}`,
      p_limit: SAATLIK_KUNYE_HAKKI,
      p_window: "1 hour",
    });
    if (error) console.error("[kanit] hız sınırı okunamadı:", error.message);
    else if (izin === false) {
      return {
        error: t({
          tr: `Saatlik künye doğrulama hakkınız doldu (${SAATLIK_KUNYE_HAKKI}).`,
          en: `You have used up your hourly reference verification limit (${SAATLIK_KUNYE_HAKKI}).`,
        }),
      };
    }
  }

  const { data: kayit } = await ctx.supabase.from("kanit_kayitlari").select("id, kaynak_id").eq("id", id).maybeSingle();
  if (!kayit) return { error: t(KAYIT_YOK) };
  if (!kayit.kaynak_id) return { error: t({ tr: "Önce literatür listenizden bir kaynak bağlayın.", en: "First link a source from your literature list." }) };

  const { data: kaynak } = await ctx.supabase
    .from("literature_sources")
    .select("title, authors, year, container_title, volume, issue, pages, doi_or_url")
    .eq("id", kayit.kaynak_id)
    .maybeSingle();
  if (!kaynak) return { error: t({ tr: "Bağlı kaynağa erişilemiyor.", en: "The linked source cannot be accessed." }) };

  /* Özet kayda da bu dilde yazılıyor: sonucu isteyen kullanıcı ilk okuyandır. */
  const dil = await aktifDil();
  const sonuc = await kunyeDogrula(kaynak, undefined, dil);
  if (sonuc.tur === "ulasilamadi") return { error: sonuc.neden };

  const simdi = new Date().toISOString();
  const guncelleme =
    sonuc.tur === "bulundu"
      ? {
          kunye_durumu: sonuc.karsilastirma.durum,
          kunye_kaynagi: sonuc.karsilastirma.dizin,
          kunye_bakildi: simdi,
          kunye_ayrintisi: {
            ozet: kunyeOzeti(sonuc.karsilastirma, dil),
            alanlar: sonuc.karsilastirma.alanlar,
            adres: sonuc.karsilastirma.adres,
            doi: sonuc.doi,
          },
          erisim_durumu: sonuc.erisim.durum,
          erisim_adresi: sonuc.erisim.adres,
        }
      : {
          kunye_durumu: "dogrulanamadi",
          kunye_kaynagi: "crossref",
          kunye_bakildi: simdi,
          kunye_ayrintisi: { ozet: sonuc.neden, alanlar: [], adres: null, doi: sonuc.doi },
          erisim_durumu: sonuc.erisim.durum,
          erisim_adresi: sonuc.erisim.adres,
        };

  const { error } = await ctx.supabase.from("kanit_kayitlari").update(guncelleme).eq("id", id);
  if (error) return dbHatasi(t, error, { tr: "Doğrulama sonucu kaydedilemedi.", en: "The verification result could not be saved." });

  yollar(projectId);
  return { success: true, message: guncelleme.kunye_ayrintisi.ozet };
}
