"use server";

import { listeBasarili, listeOkunamadi, type ListeSonucu } from "@/lib/liste-sonucu";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { HEDEF_MESAJI, kaynakHedefi } from "@/lib/kaynak-hedefi";
import { getAuthContext, oturumYokMesaji, type ActionResult } from "@/lib/auth-guards";
import { normalizeDoi, type DoiMetadata } from "@/lib/doi";
import { crossrefKunyesi, DOI_SORGU_MESAJI, doiSorgula, type DoiSorguHatasi } from "@/lib/doi-sorgu";
import { dizinHakkiDus } from "@/lib/dizin-kotasi";
import { KOTA_DENETLENEMEDI, KOTA_DOLDU } from "@/lib/dizin-kotasi-kurali";
import { isSubscriptionBlocked, abonelikKapaliMesaji } from "@/lib/access";
import { aktifDil, ceviri } from "@/lib/dil-sunucu";
import { adminIstemcisiVarsa } from "@/lib/supabase/admin";
import { kunyeDogrula, type DogrulamaSonucu } from "@/lib/kanit/dizin";
import { doiTekrariMesaji, TEKRAR_DENETLENEMEDI, kaynakDoiAnahtari, tekrarBul } from "@/lib/kaynak-ekleme";
import { kapsamdakiKaynaklar } from "@/lib/kaynak-kapsami";
import { kaynakDuzenlemeSatiri, yayinAlanlari } from "@/lib/kaynak-formu";

const PAGE_PATH = "/dashboard/literature";
/* Literatür, Çalışmalarım'daki durum kartından da pencere olarak açılıyor;
   kart sayıları ve pencere içeriği eskimesin. */
const yenile = () => {
  revalidatePath(PAGE_PATH);
  revalidatePath("/dashboard/editor");
};
const STATUSES = ["to_review", "read", "used"];
const SOURCE_TYPES = ["article", "book", "chapter", "thesis", "report", "website", "other"];

export interface LiteratureSource {
  id: string;
  project_id: string | null;
  title: string;
  authors: string | null;
  year: string | null;
  source_type: string;
  doi_or_url: string | null;
  status: "to_review" | "read" | "used";
  notes: string | null;
  created_at: string;
  /** Yayın bilgileri (migration 20260917090000 ile) */
  container_title?: string | null;
  volume?: string | null;
  issue?: string | null;
  pages?: string | null;
  publisher?: string | null;
  /** Basım yeri (migration 20261102175708) */
  publication_place?: string | null;
}

/*
  Okuma başarısızsa BOŞ LİSTE değil "okunamadı" dönüyor. Eskiden hata
  konsola gidiyor, kullanıcıya "Henüz kaynak yok" ekranı çıkıyordu —
  yani topladığı literatürü kaybettiğini sanıyordu (lib/liste-sonucu.ts).
*/
export async function getLiteratureSources(): Promise<ListeSonucu<LiteratureSource>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return listeBasarili([]);

  // "*": yayın bilgisi kolonları henüz eklenmemiş veritabanlarında da çalışır.
  const { data, error } = await supabase
    .from("literature_sources")
    .select("*")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return listeOkunamadi();
  }
  return listeBasarili(data);
}

const text = (value: unknown, max: number) => {
  const result = String(value ?? "").trim().slice(0, max);
  return result || null;
};

/* Yayın bilgisi alanları: lib/kaynak-formu.ts (düzenleme satırıyla aynı yerde, testli). */
const publicationFields = yayinAlanlari;

const isMissingColumn = (error: { code?: string } | null) => error?.code === "PGRST204" || error?.code === "42703";

export async function createLiteratureSource(formData: FormData): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { error: await oturumYokMesaji() };
  const t = await ceviri();
  /* Abonelik kapısı: Yeni kaynak eklemek içerik üretir. Okuma, güncelleme ve silme
     açık kalır: mevcut kaynaklarını yönetebilmeli. */
  if (await isSubscriptionBlocked()) return { error: (await abonelikKapaliMesaji()) };

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: t({ tr: "Kaynak başlığı zorunludur.", en: "Source title is required." }) };

  const sourceType = String(formData.get("sourceType") ?? "article");
  const status = String(formData.get("status") ?? "to_review");
  /* Hedef çalışma sunucuda doğrulanır (lib/kaynak-hedefi.ts): istemcinin gönderdiği kimliğe güvenilmez. */
  const hedef = await kaynakHedefi(ctx.supabase, ctx.user.id, formData.get("projectId"));
  if (hedef.durum === "yetkisiz" || hedef.durum === "okunamadi") return { error: t(HEDEF_MESAJI[hedef.durum]) };

  const row = {
    owner_id: ctx.user.id,
    project_id: hedef.durum === "tamam" ? hedef.projectId : null,
    title,
    authors: String(formData.get("authors") ?? "").trim() || null,
    year: String(formData.get("year") ?? "").trim() || null,
    source_type: SOURCE_TYPES.includes(sourceType) ? sourceType : "other",
    doi_or_url: String(formData.get("doiOrUrl") ?? "").trim() || null,
    status: STATUSES.includes(status) ? status : "to_review",
    notes: String(formData.get("notes") ?? "").trim() || null,
  };
  /*
    TEKRAR (Signature OS 4.2; A1 07.11.2026). Kural lib/kaynak-ekleme.ts'te,
    kapsam lib/kaynak-kapsami.ts'te: çalışmaya bağlıysa o çalışma, değilse
    kullanıcının genel kütüphanesi (K2, K6).
      • Aynı DOI ENGELDİR (K2). Eskiden elle eklemede aynı DOI de yalnızca
        uyarıyla ikinci kez ekleniyordu.
      • Yalnızca başlık + yıl eşleşmesi UYARIDIR: kullanıcı bilerek ikinci
        bir kayıt açıyor olabilir (aynı kitabın başka baskısı). Eskiden
        uyarı yalnızca çalışmaya bağlı kaynakta veriliyordu.
    Kapsam okunamazsa: DOI'li kayıt EKLENMEZ (engelin sorgusu hata yutmaz);
    DOI'siz kayıt eklenir ama uyarı yazılmaz ("tekrar yok" da denmiyor) —
    eski davranış.
  */
  let tekrarVar = false;
  const kapsam = await kapsamdakiKaynaklar(ctx.supabase, ctx.user.id, row.project_id);
  if ("hata" in kapsam) {
    if (kaynakDoiAnahtari(row.doi_or_url)) return { error: t(TEKRAR_DENETLENEMEDI) };
  } else {
    const tekrar = tekrarBul(row, kapsam.kaynaklar);
    if (tekrar.tur === "doi") return { error: t(doiTekrariMesaji(Boolean(row.project_id), tekrar.mevcut.title)) };
    tekrarVar = tekrar.tur === "baslik";
  }

  let { error } = await ctx.supabase.from("literature_sources").insert({ ...row, ...publicationFields((name) => formData.get(name)) });
  // Migration öncesi veritabanı: yayın bilgileri olmadan kaydet.
  if (isMissingColumn(error)) ({ error } = await ctx.supabase.from("literature_sources").insert(row));

  if (error) {
    console.error(error);
    return { error: t({ tr: "Kaydedilirken bir hata oluştu.", en: "An error occurred while saving." }) };
  }

  yenile();
  if (tekrarVar) {
    return {
      success: true,
      warning: t({
        tr: "Kaynak eklendi. Aynı başlık ve yılla bir kayıt daha var; Kaynaklar listesinde “Olası tekrar” süzgeciyle görebilirsiniz.",
        en: "Source added. Another record has the same title and year; you can see it with the “Possible duplicates” filter in Sources.",
      }),
    };
  }
  return { success: true };
}

export async function updateLiteratureStatus(sourceId: string, status: string): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { error: await oturumYokMesaji() };
  const t = await ceviri();
  if (!STATUSES.includes(status)) return { error: t({ tr: "Geçersiz durum.", en: "Invalid status." }) };

  const { data, error } = await ctx.supabase
    .from("literature_sources")
    .update({ status })
    .eq("id", sourceId)
    .eq("owner_id", ctx.user.id)
    .select("id");

  if (error) {
    console.error(error);
    return { error: t({ tr: "Güncellenirken bir hata oluştu.", en: "An error occurred while updating." }) };
  }
  if (!data?.length) return { error: t({ tr: "Kaynak bulunamadı ya da size ait değil.", en: "Source not found or it doesn't belong to you." }) };

  yenile();
  return { success: true };
}

export async function updateLiteratureSource(sourceId: string, formData: FormData): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { error: await oturumYokMesaji() };
  const t = await ceviri();

  /* Form → satır dönüşümü tek yerde ve testli (lib/kaynak-formu.ts, tests/db/kaynak-duzenleme). */
  const satir = kaynakDuzenlemeSatiri((ad) => formData.get(ad));
  if ("hata" in satir) return { error: t({ tr: "Kaynak başlığı zorunludur.", en: "Source title is required." }) };
  const row = satir.temel;
  const update = (values: Record<string, unknown>) =>
    ctx.supabase.from("literature_sources").update(values).eq("id", sourceId).eq("owner_id", ctx.user.id).select("id");

  let { data, error } = await update({ ...row, ...satir.yayin });
  if (isMissingColumn(error)) ({ data, error } = await update(row));

  if (error) {
    console.error(error);
    return { error: t({ tr: "Güncellenirken bir hata oluştu.", en: "An error occurred while updating." }) };
  }
  if (!data?.length) return { error: t({ tr: "Kaynak bulunamadı ya da size ait değil.", en: "Source not found or it doesn't belong to you." }) };

  yenile();
  return { success: true };
}

export async function deleteLiteratureSource(sourceId: string): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { error: await oturumYokMesaji() };
  const t = await ceviri();

  const { data, error } = await ctx.supabase
    .from("literature_sources")
    .delete()
    .eq("id", sourceId)
    .eq("owner_id", ctx.user.id)
    .select("id");

  if (error) {
    console.error(error);
    return { error: t({ tr: "Silinirken bir hata oluştu.", en: "An error occurred while deleting." }) };
  }
  if (!data?.length) return { error: t({ tr: "Kaynak bulunamadı ya da size ait değil.", en: "Source not found or it doesn't belong to you." }) };

  yenile();
  return { success: true };
}

/*
  DOI ile künye (DOI kotası, 07.11.2026). Sıra ve sınıflandırma saf
  modülde (lib/doi-sorgu.ts): biçim → çalışma yetkisi → kütüphane →
  abonelik → ortak dizin kotası (lib/dizin-kotasi.ts) → Crossref.

  Eskiden abonelik kapısı ve kota yoktu: aboneliği biten kullanıcı da
  Crossref'e sınırsız istek gönderebiliyordu; kullanıcının kütüphanesinde
  zaten olan DOI de her seferinde dışarı soruluyordu. Hata mesajları da
  ayırt edilemiyordu (429 ile 500 aynı metindi).

  Sunucu yalnızca sabit Crossref adresine, doğrulanmış DOI ile gider.
*/
export async function lookupDoi(
  input: string,
  projectId?: string | null,
): Promise<{ error?: string; hata?: DoiSorguHatasi; metadata?: DoiMetadata; kaynak?: "kutuphane" | "crossref" }> {
  const ctx = await getAuthContext();
  if (!ctx) return { error: await oturumYokMesaji() };
  const t = await ceviri();

  const sonuc = await doiSorgula(input, {
    async calismaYetkisi() {
      const hedef = await kaynakHedefi(ctx.supabase, ctx.user.id, projectId);
      return hedef.durum === "yetkisiz" ? "yetkisiz" : hedef.durum === "okunamadi" ? "okunamadi" : "tamam";
    },
    /* Yalnızca kullanıcının KENDİ kapsamı (owner_id süzgeci, lib/kaynak-kapsami.ts):
       gözetim rolünün RLS ile okuyabildiği başkasının kaynağı buraya girmez. */
    async kutuphanedeBul(anahtar) {
      const kapsamlar = projectId ? [String(projectId), null] : [null];
      for (const kapsam of kapsamlar) {
        const k = await kapsamdakiKaynaklar(ctx.supabase, ctx.user.id, kapsam);
        if ("hata" in k) continue; // okunamayan kütüphane engel değil: dışarı sorulur (hak düşer)
        const eslesen = k.kaynaklar.find((m) => kaynakDoiAnahtari(m.doi_or_url) === anahtar);
        if (!eslesen) continue;
        const { data, error } = await ctx.supabase
          .from("literature_sources")
          .select("title, authors, year, source_type, doi_or_url, container_title, volume, issue, pages, publisher, publication_place")
          .eq("id", eslesen.id)
          .eq("owner_id", ctx.user.id)
          .maybeSingle();
        if (error || !data) continue;
        return {
          doi: normalizeDoi(data.doi_or_url ?? "") ?? anahtar,
          title: data.title,
          authors: data.authors,
          year: data.year,
          sourceType: (SOURCE_TYPES.includes(data.source_type) ? data.source_type : "other") as DoiMetadata["sourceType"],
          containerTitle: data.container_title,
          volume: data.volume,
          issue: data.issue,
          pages: data.pages,
          publisher: data.publisher,
          publicationPlace: data.publication_place,
        };
      }
      return null;
    },
    abonelikKapali: () => isSubscriptionBlocked(),
    hakDus: () => dizinHakkiDus(ctx.user.id),
    crossref: (doi) => crossrefKunyesi(doi),
  });

  if (sonuc.tur === "tamam") return { metadata: sonuc.metadata, kaynak: sonuc.kaynak };
  const h = sonuc.hata;
  const mesaj =
    h === "abonelik" ? await abonelikKapaliMesaji()
    : h === "kota" ? t(KOTA_DOLDU)
    : h === "kota_denetlenemedi" ? t(KOTA_DENETLENEMEDI)
    : t(DOI_SORGU_MESAJI[h]);
  return { error: mesaj, hata: h };
}

export interface CitationSourceInput {
  title: string;
  authors?: string | null;
  year?: string | null;
  sourceType?: string;
  doiOrUrl?: string | null;
  containerTitle?: string | null;
  volume?: string | null;
  issue?: string | null;
  pages?: string | null;
  publisher?: string | null;
  publicationPlace?: string | null;
  projectId?: string | null;
}

/** Atıf penceresinden yeni kaynak: literatür listesine "kullanıldı" olarak eklenir ve döner */
export async function createCitationSource(input: CitationSourceInput): Promise<{ error?: string; source?: LiteratureSource }> {
  const ctx = await getAuthContext();
  if (!ctx) return { error: await oturumYokMesaji() };
  const t = await ceviri();
  /* Abonelik kapısı: Atıf kaynağı da yeni içeriktir. */
  if (await isSubscriptionBlocked()) return { error: (await abonelikKapaliMesaji()) };

  const title = text(input.title, 500);
  if (!title) return { error: t({ tr: "Kaynak başlığı zorunludur.", en: "Source title is required." }) };
  const sourceType = SOURCE_TYPES.includes(input.sourceType ?? "") ? input.sourceType! : "article";
  const fields = input as unknown as Record<string, unknown>;
  /* Atıf penceresinin çalışması da doğrulanır: atanmış kişi ya da yabancı kimlik öksüz kaynak üretmesin. */
  const hedef = await kaynakHedefi(ctx.supabase, ctx.user.id, input.projectId);
  if (hedef.durum === "yetkisiz" || hedef.durum === "okunamadi") return { error: t(HEDEF_MESAJI[hedef.durum]) };

  const row = {
    owner_id: ctx.user.id,
    project_id: hedef.durum === "tamam" ? hedef.projectId : null,
    title,
    authors: text(input.authors, 1000),
    year: text(input.year, 20),
    source_type: sourceType,
    doi_or_url: text(input.doiOrUrl, 500),
    status: "used",
    notes: null,
  };
  /*
    Aynı DOI kapsamda zaten varsa (A1, K2/K6) YENİ SATIR YAZILMAZ: mevcut
    kaynak döner ve atıf ona yapılır — öğrencinin akışı kesilmez. Eskiden
    bu yolda tekrar denetimi yoktu; atıf penceresinden ve "Cümleye kaynak
    bul"dan aynı DOI her seferinde yeni bir kayıt açıyordu. Kapsam
    okunamazsa DOI'li kayıt eklenmez (engelin sorgusu hata yutmaz).
    Başlık + yıl eşleşmesine burada bakılmaz (eski davranış).
  */
  if (kaynakDoiAnahtari(row.doi_or_url)) {
    const kapsam = await kapsamdakiKaynaklar(ctx.supabase, ctx.user.id, row.project_id);
    if ("hata" in kapsam) return { error: t(TEKRAR_DENETLENEMEDI) };
    const tekrar = tekrarBul(row, kapsam.kaynaklar);
    if (tekrar.tur === "doi") {
      const { data: mevcut, error: okumaHatasi } = await ctx.supabase.from("literature_sources").select("*").eq("id", tekrar.mevcut.id).single();
      if (okumaHatasi || !mevcut) return { error: t(TEKRAR_DENETLENEMEDI) };
      return { source: mevcut as LiteratureSource };
    }
  }
  let { data, error } = await ctx.supabase
    .from("literature_sources")
    .insert({ ...row, ...publicationFields((name) => fields[name]) })
    .select("*")
    .single();
  if (isMissingColumn(error)) ({ data, error } = await ctx.supabase.from("literature_sources").insert(row).select("*").single());

  if (error || !data) {
    console.error(error);
    return { error: t({ tr: "Kaynak kaydedilemedi.", en: "Couldn't save the source." }) };
  }
  yenile();
  return { source: data as LiteratureSource };
}

/*
  KÜNYEYİ DİZİNLERLE KARŞILAŞTIR (Signature OS 4.2, 05.11.2026).
  Kaynaklar sayfasındaki ayrıntı panelinin "Dizinlerde karşılaştır"
  düğmesi. Kanıt matrisindeki künye doğrulamasıyla AYNI mantık
  (lib/kanit/dizin.ts kunyeDogrula: Crossref, sonra OpenAlex; alan alan
  karşılaştırma) ve aynı saatlik hak (kunye-dogrulama anahtarı; iki
  yerden ayrı ayrı hak kazanılmasın).

  Sonuç YAZILMAZ: literature_sources'ta doğrulama sütunu yok ve bu aşamada
  migration yapılmıyor. Ekranda "şu an karşılaştırıldı" diye gösterilir;
  kalıcı bir "doğrulandı" rozeti yok. Dizine ulaşılamazsa sonuç
  "doğrulanamadı" DEĞİL, hata döner (geçici arıza kalıcı hüküm değildir).
  Kapı: dış sunuculara istek atıyor (lib/access.ts listesi).
*/
const SAATLIK_KUNYE_HAKKI = 60;
const KAYNAK_KIMLIGI = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$|^[a-z0-9]{1,40}$/i;

export async function kaynakKunyesiniKarsilastir(sourceId: string): Promise<{ error?: string; sonuc?: Exclude<DogrulamaSonucu, { tur: "ulasilamadi" }> }> {
  const ctx = await getAuthContext();
  if (!ctx) return { error: await oturumYokMesaji() };
  const t = await ceviri();
  if (await isSubscriptionBlocked()) return { error: await abonelikKapaliMesaji() };
  if (!KAYNAK_KIMLIGI.test(String(sourceId))) return { error: t({ tr: "Kaynak bulunamadı.", en: "Source not found." }) };

  const admin = adminIstemcisiVarsa();
  if (admin) {
    const { data: izin, error } = await admin.rpc("rate_limit_hit", { p_key: `kunye-dogrulama:${ctx.user.id}`, p_limit: SAATLIK_KUNYE_HAKKI, p_window: "1 hour" });
    if (error) console.error("[literatur] hız sınırı okunamadı:", error.message);
    else if (izin === false) {
      return { error: t({ tr: `Saatlik künye doğrulama hakkınız doldu (${SAATLIK_KUNYE_HAKKI}).`, en: `You have used up your hourly reference verification limit (${SAATLIK_KUNYE_HAKKI}).` }) };
    }
  }

  const { data: kaynak, error } = await ctx.supabase
    .from("literature_sources")
    .select("title, authors, year, container_title, volume, issue, pages, doi_or_url")
    .eq("id", sourceId)
    .eq("owner_id", ctx.user.id)
    .maybeSingle();
  if (error) {
    console.error(error);
    return { error: t({ tr: "Kaynak okunamadı; tekrar deneyin.", en: "Couldn't read the source; please try again." }) };
  }
  if (!kaynak) return { error: t({ tr: "Kaynak bulunamadı ya da size ait değil.", en: "Source not found or it doesn't belong to you." }) };

  const sonuc = await kunyeDogrula(kaynak, undefined, await aktifDil());
  if (sonuc.tur === "ulasilamadi") return { error: sonuc.neden };
  return { sonuc };
}
