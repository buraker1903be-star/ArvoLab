import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { calismaninKaynakPdfYoluMu } from "@/lib/kaynak-pdf-yolu";

/*
  KAYNAK PDF KAYDININ YAZILMASI VE DOSYA TEMİZLİĞİ (P52b-1).

  Sunucu eylemleri (app/actions/kaynak-pdf.ts) ince kabuk; hangi yazının
  hangi KOŞULLA yapılacağı ve hangi dosyanın SİLİNEBİLECEĞİ burada. İstemci
  dışarıdan verildiği için aynı dizi gerçek PostgREST'e karşı koşturulabiliyor
  (denetim/p52b/butunluk.mjs).

  İki kural:

  1. Otomatik arama hazır PDF'i (indirildi/yuklendi) EZEMEZ. Eskiden çağrının
     başında okunan "hazır" kümesine güvenilip koşulsuz upsert yapılıyordu:
     arama sürerken öğrenci PDF yüklerse ya da ikinci bir sekme PDF'i
     indirirse, eski bilgiyle biten arama o kaydı "erişilemedi" ile eziyor,
     PDF çalışmadan kopuyor ve dosya yetim kalıyordu (denetim B-RACE-1/3).
     Artık koşul VERİTABANINDA: önce "yoksa ekle" (ON CONFLICT DO NOTHING),
     sonra yalnızca hazır OLMAYAN satırı güncelleyen tek bir UPDATE. Postgres
     bu UPDATE'te satırı kilitler ve koşulu güncel sürüme göre yeniden
     değerlendirir: araya giren bir yükleme varsa güncelleme hiçbir satıra
     değmez. Migration gerekmiyor: iki adım da tek tek atomik.

  2. Bir dosya ancak bu çalışmanın kaynak PDF kalıbına uyuyorsa VE hiçbir
     kayıt onu göstermiyorsa silinir. Eskiden "eski yol" doğrudan siliniyordu:
     bir künyenin kaydı başka künyenin dosyasını gösterirse, ilki
     değiştirilince ötekinin PDF'i gidiyordu (denetim B-PATH-1).
*/

const TABLO = "kaynak_pdfleri";
const KOVA = "project-files";
const HAZIR = "(indirildi,yuklendi)";

type PostgrestHatasi = { code?: string; message?: string } | null;

/** Otomatik indirmenin depo yolu (lib/kaynak-pdf-yolu.ts, "otomatik" kalıbı). */
export function otomatikYol(projectId: string, anahtar: string, zaman: number = Date.now()): string {
  const ozet = createHash("sha1").update(anahtar).digest("hex").slice(0, 16);
  return `${projectId.toLowerCase()}/kaynak-pdf/${ozet}-${String(Math.trunc(zaman)).padStart(13, "0")}.pdf`;
}

/**
 * Bu yolu bu çalışmada bir kayıt gösteriyor mu? `haric`: kendi künyemizin
 * satırı sayılmaz. Okunamazsa null: "bilmiyorum", silme kararı verilmez.
 */
export async function yolKullaniliyorMu(
  sb: SupabaseClient,
  projectId: string,
  yol: string,
  haric?: string,
): Promise<boolean | null> {
  let sorgu = sb.from(TABLO).select("id").eq("project_id", projectId).eq("depo_yolu", yol).limit(1);
  if (haric) sorgu = sorgu.neq("kunye_anahtari", haric);
  const { data, error } = await sorgu;
  if (error) {
    console.error("[kaynak-pdf] yol kullanımı okunamadı:", error.message);
    return null;
  }
  return (data?.length ?? 0) > 0;
}

/*
  Silinemeyen ya da silinip silinmeyeceğine karar verilemeyen dosya bu izle
  günlüğe yazılır, YOLUYLA. DB ile Storage arasında ortak bir işlem yok;
  telafinin kendisi de düşebilir. O zaman doğru davranış dosyayı bırakıp
  bulunabilir kılmak: günlükte bu iz aranarak yetimler listelenir (kalıcı
  bir tarama P52b-2'nin işi). Kullanıcıya bu yüzden "başarılı" denmez.
*/
export const YETIM_IZI = "[kaynak-pdf] YETIM_DOSYA";

export type SilmeSonucu = "silindi" | "kullaniliyor" | "gecersiz" | "okunamadi" | "silinemedi";

/*
  Yalnızca SAHİPSİZ dosya silinir. Kalıba uymayan yol hiç silinmez (önekle
  başlayan ama başka bir şey olan yol dahil). Kullanım okunamazsa da silinmez:
  emin olmadan silmek, yetim bırakmaktan pahalıdır. Silme düşerse hata
  günlüğe yazılır; dosya yetim kalır ve P52b-2 taraması onu bulur.
*/
export async function sahipsizseSil(sb: SupabaseClient, projectId: string, yol: string, neden: string): Promise<SilmeSonucu> {
  if (!calismaninKaynakPdfYoluMu(yol, projectId)) {
    console.error("[kaynak-pdf] kalıba uymayan yol silinmedi:", neden);
    return "gecersiz";
  }
  const kullanimda = await yolKullaniliyorMu(sb, projectId, yol);
  if (kullanimda === null) {
    console.error(`${YETIM_IZI} kullanımı okunamadı, silinmedi:`, neden, yol);
    return "okunamadi";
  }
  if (kullanimda) return "kullaniliyor";
  const { error } = await sb.storage.from(KOVA).remove([yol]);
  if (error) {
    console.error(`${YETIM_IZI} silinemedi:`, neden, yol, error.message);
    return "silinemedi";
  }
  return "silindi";
}

export type KaynakPdfKaydi = {
  project_id: string;
  olusturan: string;
  kunye_anahtari: string;
  kunye: string;
  doi: string | null;
  durum: string;
  depo_yolu: string | null;
  kaynak_adres: string | null;
  baslik_eslesti: boolean | null;
  bakildi: string;
};

/* Güncellemede kimlik sütunları yazılmaz (satırı başka biri açmış olabilir). */
const guncellenecek = (k: KaynakPdfKaydi) => {
  const { project_id: _p, kunye_anahtari: _k, olusturan: _o, ...geri } = k;
  void _p;
  void _k;
  void _o;
  return geri;
};

export type OtomatikSonuc<T> =
  | { tur: "yazildi"; satir: T }
  /** Satır hazır PDF taşıyor (öğrenci yüklemesi ya da başka bir indirme): dokunulmadı. */
  | { tur: "korundu"; satir: T | null }
  | { tur: "hata"; hata: PostgrestHatasi };

/** Otomatik aramanın sonucu: yoksa eklenir, varsa YALNIZCA hazır değilse güncellenir. */
export async function otomatikSonucuYaz<T>(sb: SupabaseClient, kayit: KaynakPdfKaydi, secim: string): Promise<OtomatikSonuc<T>> {
  const ekle = await sb
    .from(TABLO)
    .upsert(kayit, { onConflict: "project_id,kunye_anahtari", ignoreDuplicates: true })
    .select(secim);
  if (ekle.error) return { tur: "hata", hata: ekle.error };
  if (ekle.data?.length) return { tur: "yazildi", satir: ekle.data[0] as T };

  const guncelle = await sb
    .from(TABLO)
    .update(guncellenecek(kayit))
    .eq("project_id", kayit.project_id)
    .eq("kunye_anahtari", kayit.kunye_anahtari)
    .not("durum", "in", HAZIR)
    .select(secim);
  if (guncelle.error) return { tur: "hata", hata: guncelle.error };
  if (guncelle.data?.length) return { tur: "yazildi", satir: guncelle.data[0] as T };

  const { data: simdiki, error } = await sb
    .from(TABLO)
    .select(secim)
    .eq("project_id", kayit.project_id)
    .eq("kunye_anahtari", kayit.kunye_anahtari)
    .maybeSingle();
  if (error) return { tur: "hata", hata: error };
  return { tur: "korundu", satir: (simdiki as T | null) ?? null };
}

export type YuklemeSonuc<T> =
  | { tur: "yazildi"; satir: T; eskiYol: string | null }
  /** Üç denemede de satır başka biri tarafından değiştirildi. */
  | { tur: "yarisma" }
  | { tur: "hata"; hata: PostgrestHatasi };

/*
  Öğrencinin yüklemesi kullanıcının açık kararıdır: hazır PDF'in de yerine
  geçer. Ama yerine geçtiği dosyayı BİLEREK yazar: güncelleme okuduğu eski
  yola koşullu yapılır, böylece "eski dosya" gerçekten bu yazmanın yerine
  geçtiği dosyadır. Eskiden eski yol önceden okunup koşulsuz yazılıyordu;
  iki yükleme yarışırsa ikisi de aynı eski dosyayı silmeye çalışıyor, araya
  giren dosya yetim kalıyordu.
*/
export async function yuklemeyiYaz<T>(sb: SupabaseClient, kayit: KaynakPdfKaydi, secim: string): Promise<YuklemeSonuc<T>> {
  for (let deneme = 0; deneme < 3; deneme++) {
    const { data: mevcut, error: okumaHatasi } = await sb
      .from(TABLO)
      .select("depo_yolu")
      .eq("project_id", kayit.project_id)
      .eq("kunye_anahtari", kayit.kunye_anahtari)
      .maybeSingle();
    if (okumaHatasi) return { tur: "hata", hata: okumaHatasi };

    if (!mevcut) {
      const ekle = await sb
        .from(TABLO)
        .upsert(kayit, { onConflict: "project_id,kunye_anahtari", ignoreDuplicates: true })
        .select(secim);
      if (ekle.error) return { tur: "hata", hata: ekle.error };
      if (ekle.data?.length) return { tur: "yazildi", satir: ekle.data[0] as T, eskiYol: null };
      continue; // arada biri ekledi: yeniden oku
    }

    const eskiYol = (mevcut.depo_yolu as string | null) ?? null;
    let sorgu = sb
      .from(TABLO)
      .update(guncellenecek(kayit))
      .eq("project_id", kayit.project_id)
      .eq("kunye_anahtari", kayit.kunye_anahtari);
    sorgu = eskiYol === null ? sorgu.is("depo_yolu", null) : sorgu.eq("depo_yolu", eskiYol);
    const guncelle = await sorgu.select(secim);
    if (guncelle.error) return { tur: "hata", hata: guncelle.error };
    if (guncelle.data?.length) return { tur: "yazildi", satir: guncelle.data[0] as T, eskiYol };
  }
  return { tur: "yarisma" };
}
