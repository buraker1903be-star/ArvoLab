"use server";

import { revalidatePath } from "next/cache";
import { requireRole, type ActionResult } from "@/lib/auth-guards";
import { ADMIN_ROLES } from "@/lib/project-labels";
import { listeBasarili, listeOkunamadi, type ListeSonucu } from "@/lib/liste-sonucu";
import { pdfMi } from "@/lib/kaynak-pdf";
import { extractTextFromBuffer } from "@/lib/document-extract";
import { butceyeTakildi, sor } from "@/lib/ai/saglayici";
import { asistanHakkiVar, asistanKapisi } from "@/lib/ai/erisim";
import { asistanKaydet } from "@/lib/ai/kayit";
import { metindeOlmayanSayilar, onerileriBirlestir, uakIstemleri, uakOnerisiniCozumle, type UakOnerisi } from "@/lib/ai/uak-tablosu";

/*
  ÜAK TABLOLARI (migration 20261027083309, saf kısım lib/ai/uak-tablosu.ts).

  Akış: yükle → yorumlat (öneri) → onayla (kurumun kriterleri ve
  hedefleri). Onay olmadan hiçbir kriter değişmez. Kurum + temel alan
  başına tek tablo: yeni dönemin PDF'i eskisinin yerine geçer.

  Yalnızca iç ekip (27.10.2026): tablolar bir kez yüklenir, onaylanınca
  GENEL listeye yazılır ve bütün kurumlar kullanır. Abonelik kapısı
  yalnızca asistan çağrısında, asistanKapisi içinde (lib/access.ts).
*/

const SAYFA = "/dashboard/associate-professorship";
const KOVA = "project-files";
const EN_AZ_METIN = 200;

export type UakTablosu = {
  id: string;
  organization_id: string;
  temel_alan: string;
  donem: string;
  depo_yolu: string;
  dosya_adi: string | null;
  durum: "yuklendi" | "oneri_hazir" | "onaylandi";
  oneri: (UakOnerisi & { kirpildi?: boolean }) | null;
  yuklendi_at: string;
  onaylandi_at: string | null;
};

export async function uakTablolari(): Promise<ListeSonucu<UakTablosu>> {
  const auth = await requireRole(ADMIN_ROLES);
  if ("error" in auth) return listeBasarili([]);
  // Yalnızca kendi kurumunun tabloları: iç ekip RLS'te her kurumu görüyor, ekranda karışmasın.
  const kurum = await kurumum(auth);
  if (!kurum) return listeBasarili([]);
  const { data, error } = await auth.supabase
    .from("uak_tablolari")
    .select("id, organization_id, temel_alan, donem, depo_yolu, dosya_adi, durum, oneri, yuklendi_at, onaylandi_at")
    .eq("organization_id", kurum)
    .order("temel_alan");
  if (error) {
    console.error("[üak] tablolar okunamadı", error.message);
    return listeOkunamadi();
  }
  return listeBasarili(data as UakTablosu[]);
}

async function kurumum(auth: Extract<Awaited<ReturnType<typeof requireRole>>, { supabase: unknown }>) {
  const { data } = await auth.supabase.from("profiles").select("organization_id").eq("id", auth.user.id).maybeSingle();
  return (data?.organization_id as string | null) ?? null;
}

/*
  PDF tarayıcıdan kullanıcının klasörüne yükleniyor (project-files/<kişi>/uak/…);
  burada yol ve PDF imzası doğrulanıyor. Aynı alanın eski tablosu varsa
  dosyası silinip satırı yeni dönemle değiştiriliyor; eski kriterler
  yeni öneri onaylanana kadar yürürlükte kalıyor.
*/
export async function uakPdfiKaydet(girdi: { temelAlan: string; donem: string; yol: string; dosyaAdi: string }): Promise<ActionResult> {
  const auth = await requireRole(ADMIN_ROLES, "ÜAK tablolarını yalnızca Arvo ekibi yükler; kurumunuz yüklenen tabloları otomatik kullanır.");
  if ("error" in auth) return { error: auth.error };
  const temelAlan = girdi.temelAlan.trim().slice(0, 120);
  const donem = girdi.donem.trim().slice(0, 40);
  if (!temelAlan || !donem) return { error: "Temel alan ve dönem zorunlu." };
  if (!girdi.yol.startsWith(`${auth.user.id}/uak/`) || girdi.yol.includes("..")) return { error: "Dosya yolu geçersiz." };

  const kurum = await kurumum(auth);
  if (!kurum) {
    await auth.supabase.storage.from(KOVA).remove([girdi.yol]);
    return { error: "Tablo kurumunuza yazılır; önce bir kuruma bağlı olmalısınız." };
  }

  const { data: dosya, error: indirmeHatasi } = await auth.supabase.storage.from(KOVA).download(girdi.yol);
  if (indirmeHatasi || !dosya) return { error: "Yüklenen dosya okunamadı; tekrar deneyin." };
  if (!pdfMi(new Uint8Array(await dosya.arrayBuffer()))) {
    await auth.supabase.storage.from(KOVA).remove([girdi.yol]);
    return { error: "Dosya PDF değil. ÜAK'ın yayımladığı PDF'i yükleyin." };
  }

  const { data: eski, error: aramaHatasi } = await auth.supabase
    .from("uak_tablolari").select("id, depo_yolu").eq("organization_id", kurum).eq("temel_alan", temelAlan).maybeSingle();
  if (aramaHatasi) {
    await auth.supabase.storage.from(KOVA).remove([girdi.yol]);
    return { error: "Mevcut tablo okunamadı; tekrar deneyin." };
  }

  const satir = {
    organization_id: kurum,
    temel_alan: temelAlan,
    donem,
    depo_yolu: girdi.yol,
    dosya_adi: girdi.dosyaAdi.slice(0, 300) || null,
    durum: "yuklendi",
    oneri: null,
    ai_kaydi: null,
    yukleyen: auth.user.id,
    yuklendi_at: new Date().toISOString(),
    onaylayan: null,
    onaylandi_at: null,
  };
  const { error } = eski
    ? await auth.supabase.from("uak_tablolari").update(satir).eq("id", eski.id)
    : await auth.supabase.from("uak_tablolari").insert(satir);
  if (error) {
    console.error("[üak] tablo kaydedilemedi", error.message);
    await auth.supabase.storage.from(KOVA).remove([girdi.yol]);
    return { error: "Tablo kaydedilemedi; tekrar deneyin." };
  }
  // Eski dönemin PDF'i: artık hiçbir satıra bağlı değil. Silinemezse yalnızca yer kaplar.
  if (eski?.depo_yolu && eski.depo_yolu !== girdi.yol) {
    const { error: silmeHatasi } = await auth.supabase.storage.from(KOVA).remove([eski.depo_yolu]);
    if (silmeHatasi) console.error("[üak] eski PDF silinemedi", silmeHatasi.message);
  }
  revalidatePath(SAYFA);
  return { success: true, message: eski ? "Yeni dönemin tablosu eskisinin yerine geçti. Yorumlatıp onaylayın." : "Tablo yüklendi. Şimdi yorumlatın." };
}

export async function uakTablosunuYorumla(tabloId: string): Promise<ActionResult> {
  const auth = await requireRole(ADMIN_ROLES, "ÜAK tablolarını yalnızca Arvo ekibi yorumlatır.");
  if ("error" in auth) return { error: auth.error };
  const kapi = await asistanKapisi();
  if (!kapi.ok) return { error: kapi.hata };

  const { data: tablo, error: okumaHatasi } = await auth.supabase
    .from("uak_tablolari").select("id, temel_alan, depo_yolu").eq("id", tabloId).maybeSingle();
  if (okumaHatasi || !tablo) return { error: "Tablo bulunamadı." };

  const { data: dosya, error: indirmeHatasi } = await auth.supabase.storage.from(KOVA).download(tablo.depo_yolu);
  if (indirmeHatasi || !dosya) return { error: "PDF okunamadı; tekrar deneyin." };
  let metin = "";
  try {
    metin = await extractTextFromBuffer(Buffer.from(await dosya.arrayBuffer()), "pdf");
  } catch (hata) {
    console.error("[üak] PDF metni çıkarılamadı", hata instanceof Error ? hata.message : hata);
  }
  if (metin.trim().length < EN_AZ_METIN) {
    return { error: "PDF'ten metin çıkmadı; taranmış (görüntü) bir PDF olabilir. ÜAK sitesindeki metin içeren PDF'i yükleyin." };
  }

  const hakHatasi = await asistanHakkiVar(kapi.kullaniciId);
  if (hakHatasi) return { error: hakHatasi };

  const { istemler, kaynak, kirpildi } = uakIstemleri(metin, tablo.temel_alan);
  const basladi = Date.now();
  const ortak = { kullaniciId: kapi.kullaniciId, yetenek: "uak" as const, baglam: kaynak, basladi };

  try {
    /*
      Parçalar AYNI ANDA okutuluyor (lib/ai/uak-tablosu.ts → uakParcalari);
      süre en uzun parça kadar. Bir parça bile düşerse öneri gösterilmez:
      eksik bir tabloyu onaylamak o bölümün kriterlerini kurumdan siler.
    */
    const yanitlar = await Promise.all(
      istemler.map((m) => sor(m, { yetenek: "uak", jsonBekle: true, sicaklik: 0, enFazlaJeton: 16_000, zamanAsimiMs: 240_000 })),
    );
    const model = yanitlar[0].model;
    const cikti = yanitlar.length === 1 ? yanitlar[0].metin : yanitlar.map((y, i) => `### Parça ${i + 1}\n${y.metin}`).join("\n\n");
    /*
      Yarıda kesilmiş yanıt REDDEDİLİR. Diğer yeteneklerde kesik yanıtın
      tamamlanmış kısmı işe yarıyor (lib/ai/bulgu.ts → jsonOku); burada
      yaramıyor: son maddeleri eksik bir puan tablosunu onaylamak, o
      maddelerin kriterlerini kurumdan SİLMEK demek.
    */
    if (yanitlar.some((y) => butceyeTakildi(y.bitis ?? null))) {
      await asistanKaydet({ ...ortak, durum: "rejected", redNedeni: "bos", model, cikti });
      return { error: "Asistanın yanıtı tablonun sonuna gelmeden kesildi; eksik bir öneri gösterilmedi. Tekrar deneyin." };
    }
    const parcalar = yanitlar.map((y) => uakOnerisiniCozumle(y.metin, yanitlar.length > 1));
    if (parcalar.some((p) => p === null)) {
      await asistanKaydet({ ...ortak, durum: "rejected", redNedeni: "bos", model, cikti });
      return { error: "Asistan tablonun bir bölümünü okuyamadı; eksik bir öneri gösterilmedi. Tekrar deneyin." };
    }
    const oneri = onerileriBirlestir(parcalar as UakOnerisi[]);
    if (!oneri) {
      await asistanKaydet({ ...ortak, durum: "rejected", redNedeni: "bos", model, cikti });
      return { error: "Asistan tablodan kriter çıkaramadı. PDF'in doğru dosya olduğundan emin olup tekrar deneyin." };
    }
    const uydurulan = metindeOlmayanSayilar(oneri, kaynak);
    if (uydurulan.length) {
      console.error("[üak] öneride PDF'te olmayan sayı", { model, uydurulan });
      await asistanKaydet({ ...ortak, durum: "rejected", redNedeni: "uydurma_sayi", model, cikti, bulgular: oneri });
      return {
        error: `Öneride PDF'te geçmeyen sayılar vardı (${uydurulan.slice(0, 5).join(", ")}); güvenlik için öneri gösterilmedi. Tekrar deneyin.`,
      };
    }
    const kayitId = await asistanKaydet({ ...ortak, durum: "completed", model, cikti, bulgular: oneri });
    const { error } = await auth.supabase
      .from("uak_tablolari")
      .update({ durum: "oneri_hazir", oneri: { ...oneri, kirpildi }, ai_kaydi: kayitId })
      .eq("id", tabloId);
    if (error) {
      console.error("[üak] öneri kaydedilemedi", error.message);
      return { error: "Öneri kaydedilemedi; tekrar deneyin." };
    }
    revalidatePath(SAYFA);
    return { success: true, message: `${oneri.kriterler.length} kriter ve ${oneri.hedefler.length} hedef önerildi. İnceleyip onaylayın.` };
  } catch (hata) {
    const mesaj = hata instanceof Error ? hata.message : "Asistan yanıt veremedi.";
    console.error("[üak] yorumlama başarısız", mesaj);
    await asistanKaydet({ ...ortak, durum: "failed" });
    return { error: mesaj };
  }
}

/*
  ONAY: öneri GENEL listeye yazılır (organization_id NULL): bütün kurumlar
  ve bireysel aboneler kullanır. Kurum sahibinin kararı (27.10.2026):
  ÜAK tablolarını Arvo ekibi bir kez yükler, kurumlar ayrıca PDF yüklemez.
  Eskiden onay yükleyenin KURUMUNA yazıyordu ve her kurumun aynı PDF'i
  ayrı ayrı yüklemesi gerekiyordu.
  - Kriter KODLA eşleşir: aynı kod güncellenir (puanı değişse de eski
    faaliyet kayıtları kendi puanıyla korunur), yeni kod eklenir, tabloda
    artık olmayan kod silinir; ona bağlı faaliyet varsa pasife alınır
    (deleteCriterion'daki kural).
  - Hedefler o alan için baştan yazılır.
  - Yükleyenin kurumunda AYNI temel alan için duran kopyalar (genel
    listeye geçmeden önce kuruma onaylananlar) kaldırılır; kalsaydı o
    kurumda her kriter iki kez görünürdü.
  Tek bir işlem değil; yarıda düşerse tekrar onaylanabilir — kodla
  eşleştiği için ikinci deneme çift kayıt açmaz.
*/
type Db = Extract<Awaited<ReturnType<typeof requireRole>>, { supabase: unknown }>["supabase"];

/** Kapsamdaki (kurum ya da genel) o temel alanın kriterlerini siler; faaliyete bağlı olanı pasife alır. */
async function kriterleriKaldir(db: Db, kurum: string | null, temelAlan: string, tut: Set<string>, kullanici: string): Promise<string | null> {
  let sorgu = db.from("scoring_criteria").select("id, code, is_active").eq("temel_alan", temelAlan);
  sorgu = kurum ? sorgu.eq("organization_id", kurum) : sorgu.is("organization_id", null);
  const { data, error } = await sorgu;
  if (error) return "Mevcut kriterler okunamadı.";
  for (const m of (data ?? []).filter((m) => !tut.has(m.code) && m.is_active)) {
    const { error: silmeHatasi } = await db.from("scoring_criteria").delete().eq("id", m.id);
    if (silmeHatasi?.code === "23503") {
      const { error: pasifHatasi } = await db.from("scoring_criteria").update({ is_active: false, updated_by: kullanici }).eq("id", m.id);
      if (pasifHatasi) return "Eski bir kriter pasife alınamadı.";
    } else if (silmeHatasi) {
      return "Eski bir kriter kaldırılamadı.";
    }
  }
  return null;
}

export async function uakOnerisiniUygula(tabloId: string): Promise<ActionResult> {
  const auth = await requireRole(ADMIN_ROLES, "ÜAK tablolarını yalnızca Arvo ekibi uygular.");
  if ("error" in auth) return { error: auth.error };
  const db = auth.supabase;

  const { data: tablo, error: okumaHatasi } = await db
    .from("uak_tablolari").select("id, organization_id, temel_alan, donem, durum, oneri").eq("id", tabloId).maybeSingle();
  if (okumaHatasi || !tablo) return { error: "Tablo bulunamadı." };
  const oneri = tablo.oneri as UakOnerisi | null;
  if (!oneri?.kriterler?.length) return { error: "Onaylanacak öneri yok; önce tabloyu yorumlatın." };

  const { data: mevcut, error: kriterHatasi } = await db
    .from("scoring_criteria").select("id, code, is_active").is("organization_id", null).eq("temel_alan", tablo.temel_alan);
  if (kriterHatasi) return { error: "Mevcut kriterler okunamadı; hiçbir şey değiştirilmedi." };

  const not = `ÜAK ${tablo.donem}`;
  const kodlar = new Set(oneri.kriterler.map((k) => k.kod));
  for (const k of oneri.kriterler) {
    const satir = {
      label: k.etiket,
      category_group: k.grup,
      points_per_unit: k.puan,
      esit_bolusum: k.esit_bolusum,
      alt_alan: k.alt_alan,
      baslica_yazar_katsayisi: k.baslica_katsayi,
      diger_yazar_katsayisi: k.diger_katsayi,
      notes: not,
      is_active: true,
      updated_by: auth.user.id,
      updated_at: new Date().toISOString(),
    };
    const var_ = (mevcut ?? []).find((m) => m.code === k.kod);
    const { error } = var_
      ? await db.from("scoring_criteria").update(satir).eq("id", var_.id)
      : await db.from("scoring_criteria").insert({ ...satir, code: k.kod, organization_id: null, temel_alan: tablo.temel_alan });
    if (error) {
      console.error("[üak] kriter yazılamadı", k.kod, error.message);
      return { error: `“${k.kod}” kriteri yazılamadı; onay yarıda kaldı. Tekrar onaylayabilirsiniz.` };
    }
  }

  const genelHata = await kriterleriKaldir(db, null, tablo.temel_alan, kodlar, auth.user.id);
  if (genelHata) return { error: `${genelHata} Onay yarıda kaldı; tekrar onaylayabilirsiniz.` };

  const { error: hedefSilmeHatasi } = await db
    .from("docentlik_hedefleri").delete().is("organization_id", null).eq("temel_alan", tablo.temel_alan);
  if (hedefSilmeHatasi) return { error: "Eski hedefler kaldırılamadı; kriterler güncellendi. Tekrar onaylayabilirsiniz." };
  if (oneri.hedefler.length) {
    const { error } = await db.from("docentlik_hedefleri").insert(
      oneri.hedefler.map((h) => ({
        organization_id: null,
        temel_alan: tablo.temel_alan,
        grup: h.grup,
        alt_alan: h.alt_alan,
        asgari_puan: h.asgari_puan,
        azami_puan: h.azami_puan,
        doktora_sonrasi: h.doktora_sonrasi,
        notlar: not,
        updated_by: auth.user.id,
      })),
    );
    if (error) {
      console.error("[üak] hedefler yazılamadı", error.message);
      return { error: "Hedefler yazılamadı; kriterler güncellendi. Tekrar onaylayabilirsiniz." };
    }
  }

  // Yükleyenin kurumundaki eski kopyalar (genel listeye geçmeden önce kuruma onaylananlar).
  const kurumHata = await kriterleriKaldir(db, tablo.organization_id, tablo.temel_alan, new Set(), auth.user.id);
  if (kurumHata) return { error: `Genel liste güncellendi ama kurumdaki eski kopyalar kaldırılamadı: ${kurumHata} Tekrar onaylayabilirsiniz.` };
  const { error: kurumHedefHatasi } = await db
    .from("docentlik_hedefleri").delete().eq("organization_id", tablo.organization_id).eq("temel_alan", tablo.temel_alan);
  if (kurumHedefHatasi) return { error: "Genel liste güncellendi ama kurumdaki eski hedefler kaldırılamadı. Tekrar onaylayabilirsiniz." };

  const { error } = await db
    .from("uak_tablolari")
    .update({ durum: "onaylandi", onaylayan: auth.user.id, onaylandi_at: new Date().toISOString() })
    .eq("id", tabloId);
  if (error) console.error("[üak] onay işaretlenemedi", error.message);
  revalidatePath(SAYFA);
  return { success: true, message: `${tablo.temel_alan} kriterleri ve hedefleri bütün kurumlar için güncellendi.` };
}

/* Tablo ve PDF'i silinir; onaylanmış kriterler genel listede kalır (elle düzenlenebilir). */
export async function uakTablosunuSil(tabloId: string): Promise<ActionResult> {
  const auth = await requireRole(ADMIN_ROLES, "ÜAK tablolarını yalnızca Arvo ekibi siler.");
  if ("error" in auth) return { error: auth.error };
  const { data, error } = await auth.supabase.from("uak_tablolari").delete().eq("id", tabloId).select("depo_yolu");
  if (error || !data?.length) return { error: "Tablo silinemedi." };
  const { error: silmeHatasi } = await auth.supabase.storage.from(KOVA).remove([data[0].depo_yolu as string]);
  if (silmeHatasi) console.error("[üak] PDF silinemedi", silmeHatasi.message);
  revalidatePath(SAYFA);
  return { success: true };
}
