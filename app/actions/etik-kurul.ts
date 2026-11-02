"use server";

import { revalidatePath } from "next/cache";
import { getAuthContext, oturumYokMesaji, type ActionResult } from "@/lib/auth-guards";
import { abonelikKapaliMesaji, isSubscriptionBlocked } from "@/lib/access";
import { aktifDil, ceviri } from "@/lib/dil-sunucu";
import { belgeMetniOku, detectDocType } from "@/lib/document-extract";
import { pdfMetniniOcrIleOku, taranmisBelgeMi } from "@/lib/ocr";
import { belgeleriBirlestir, belgeListesiniTemizle, yonergedenBelgeler, type EtikBelge } from "@/lib/etik/belgeler";
import { ETIK_DURUMLARI, type EtikDurum } from "@/lib/etik/durum";

/*
  ETİK KURUL BAŞVURUSU (02.11.2026). Tablo: etik_kurul (20261102134543),
  kurallar: lib/etik/.

  Yetki RLS'te (can_write_project): yazamayan kullanıcının upsert'i hata
  döner, burada anlaşılır mesaja çevrilir. Abonelik kapısı üç işlemde de
  var — yeni içerik yazıyorlar, tarama ayrıca ağır çözümleme (PDF, OCR).
*/

type Sonuc<T = object> = ({ ok: true } & T) | { error: string };

const GUN = /^\d{4}-\d{2}-\d{2}$/;
const tarihOku = (deger: unknown) => {
  const metin = String(deger ?? "").trim();
  return GUN.test(metin) ? metin : null;
};
const metinOku = (deger: unknown, sinir: number) => String(deger ?? "").replace(/\s+/g, " ").trim().slice(0, sinir) || null;

type Baglam = NonNullable<Awaited<ReturnType<typeof getAuthContext>>>;

async function hazirlik(): Promise<{ error: string; ctx?: undefined } | { error?: undefined; ctx: Baglam }> {
  const ctx = await getAuthContext();
  if (!ctx) return { error: await oturumYokMesaji() };
  if (await isSubscriptionBlocked()) return { error: await abonelikKapaliMesaji() };
  return { ctx };
}

const yaziHatasi = async (kod?: string) => {
  const t = await ceviri();
  if (kod === "23514") return t({ tr: "Bilgiler tutarsız: onaylandıysa karar tarihi ve sayısını, başvuru tarihini de onaydan önce girin.", en: "The details are inconsistent: if approved, enter the decision date and number, with the application date before approval." });
  if (kod === "42501") return t({ tr: "Bu çalışmanın etik kurul bilgilerini değiştiremezsiniz.", en: "You can't change this work's ethics details." });
  return t({ tr: "Kaydedilemedi; tekrar deneyin.", en: "Couldn't save; try again." });
};

/* Etik sekmesindeki bilgi formu (dashboard/action-form ile; alan adları formdaki name'ler). */
export async function etikBilgileriniKaydet(formData: FormData): Promise<ActionResult> {
  const h = await hazirlik();
  if (h.error !== undefined) return { error: h.error };
  const projectId = String(formData.get("project_id") ?? "");
  const girdi = Object.fromEntries(formData.entries());
  const durum = ETIK_DURUMLARI.includes(girdi.durum as EtikDurum) ? (girdi.durum as EtikDurum) : "belirsiz";
  const { error } = await h.ctx.supabase.from("etik_kurul").upsert(
    {
      project_id: projectId,
      durum,
      kurul_adi: metinOku(girdi.kurulAdi, 300),
      basvuru_tarihi: tarihOku(girdi.basvuruTarihi),
      onay_tarihi: tarihOku(girdi.onayTarihi),
      karar_no: metinOku(girdi.kararNo, 120),
      veri_toplama_baslangic: tarihOku(girdi.veriToplamaBaslangic),
      gerekmeme_gerekcesi: durum === "gerekmiyor" ? metinOku(girdi.gerekmemeGerekcesi, 1000) : null,
      notlar: metinOku(girdi.notlar, 4000),
      guncelleyen: h.ctx.user.id,
      guncellendi: new Date().toISOString(),
    },
    { onConflict: "project_id" },
  );
  if (error) {
    console.error("[etik] bilgiler yazılamadı", error.code, error.message);
    return { error: await yaziHatasi(error.code) };
  }
  revalidatePath(`/dashboard/editor/${projectId}`, "layout");
  return { success: true };
}

export async function etikBelgeleriniKaydet(projectId: string, ham: unknown): Promise<Sonuc<{ belgeler: EtikBelge[] }>> {
  const h = await hazirlik();
  if (h.error !== undefined) return { error: h.error };
  const belgeler = belgeListesiniTemizle(ham);
  const { error } = await h.ctx.supabase
    .from("etik_kurul")
    .upsert({ project_id: projectId, belgeler, guncelleyen: h.ctx.user.id, guncellendi: new Date().toISOString() }, { onConflict: "project_id" });
  if (error) {
    console.error("[etik] belgeler yazılamadı", error.code, error.message);
    return { error: await yaziHatasi(error.code) };
  }
  revalidatePath(`/dashboard/editor/${projectId}`, "layout");
  return { ok: true, belgeler };
}

/*
  Kurulun yönergesini okuyup belge listesini çıkarır (lib/etik/belgeler.ts,
  sözlükle). Dosya tarayıcıdan kullanıcının kendi klasörüne yüklenir
  (project-files/<kullanıcı>/etik/…); yol bu yüzden önekle denetlenir —
  başkasının dosyası taratılamasın (calisma-kilavuzu.ts'teki denetimin
  eşi). Dosya okunduktan sonra SİLİNİR: lazım olan yalnızca çıkarılan
  liste ve alıntılar, yönergenin kopyasını saklamak için bir sebep yok.
*/
export async function etikYonergesiniTara(
  projectId: string,
  depoYolu: string,
  dosyaAdi: string,
): Promise<Sonuc<{ belgeler: EtikBelge[]; bulunan: number }>> {
  const h = await hazirlik();
  if (h.error !== undefined) return { error: h.error };
  const t = await ceviri();
  const dil = await aktifDil();
  const { ctx } = h;
  if (!depoYolu.startsWith(`${ctx.user.id}/etik/`) || depoYolu.includes("..")) {
    return { error: t({ tr: "Geçersiz dosya yolu.", en: "Invalid file path." }) };
  }

  try {
    const { data: dosya, error: indirmeHatasi } = await ctx.supabase.storage.from("project-files").download(depoYolu);
    if (indirmeHatasi || !dosya) {
      console.error("[etik] yönerge depodan okunamadı:", indirmeHatasi?.message);
      return { error: t({ tr: "Yüklenen dosya okunamadı. Tekrar yükleyin.", en: "The uploaded file could not be read. Upload it again." }) };
    }
    const tur = detectDocType(dosyaAdi, dosya.type);
    if (!tur) return { error: t({ tr: "Yalnızca PDF ya da Word (.docx) okunabiliyor.", en: "Only PDF or Word (.docx) files can be read." }) };
    const tampon = Buffer.from(await dosya.arrayBuffer());
    const okunan = await belgeMetniOku(tampon, tur);
    const sayfa = okunan.sayfa;
    let metin = okunan.metin;
    // Taranmış (görüntü) PDF: tez kılavuzundaki OCR (lib/ocr.ts).
    if (tur === "pdf" && taranmisBelgeMi(metin, sayfa ?? 0)) {
      const ocr = await pdfMetniniOcrIleOku(tampon, sayfa ?? 0, dil);
      if (ocr.metin.trim().length > metin.trim().length) metin = ocr.metin;
    }
    if (metin.trim().length < 40) {
      return { error: t({ tr: "Yönergenin metni okunamadı. Metni seçilebilir bir PDF ya da Word dosyası yükleyin.", en: "The guideline's text couldn't be read. Upload a PDF with selectable text or a Word file." }) };
    }

    const { data: kayit, error: okumaHatasi } = await ctx.supabase.from("etik_kurul").select("belgeler").eq("project_id", projectId).maybeSingle();
    if (okumaHatasi) {
      console.error("[etik] mevcut liste okunamadı:", okumaHatasi.message);
      return { error: t({ tr: "Mevcut liste okunamadı; tekrar deneyin.", en: "The current list couldn't be read; try again." }) };
    }
    const bulunan = yonergedenBelgeler(metin);
    const belgeler = belgeleriBirlestir(belgeListesiniTemizle(kayit?.belgeler), bulunan, dil);
    const { error } = await ctx.supabase.from("etik_kurul").upsert(
      {
        project_id: projectId,
        belgeler,
        yonerge_adi: dosyaAdi.slice(0, 300),
        guncelleyen: ctx.user.id,
        guncellendi: new Date().toISOString(),
      },
      { onConflict: "project_id" },
    );
    if (error) {
      console.error("[etik] tarama sonucu yazılamadı", error.code, error.message);
      return { error: await yaziHatasi(error.code) };
    }
    revalidatePath(`/dashboard/editor/${projectId}`, "layout");
    return { ok: true, belgeler, bulunan: bulunan.length };
  } finally {
    const { error } = await ctx.supabase.storage.from("project-files").remove([depoYolu]);
    if (error) console.error("[etik] yönerge dosyası silinemedi:", error.message);
  }
}
