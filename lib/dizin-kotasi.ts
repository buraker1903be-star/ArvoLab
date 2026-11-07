import { adminIstemcisiVarsa } from "@/lib/supabase/admin";
import {
  DIZIN_KOTA_PENCERESI,
  DIZIN_SAATLIK_HAK,
  dizinKotaAnahtari,
  kotaKarari,
  sayacCevabi,
  uretimMi,
  type KotaKarari,
} from "@/lib/dizin-kotasi-kurali";

/*
  ORTAK DİZİN KOTASI — SUNUCU (DOI kotası, 07.11.2026). Kural ve ortam
  davranışı lib/dizin-kotasi-kurali.ts'te (saf, birim testli); burası
  yalnızca sayacı çağırır. Bilerek "use server" DEĞİL: dışarıdan
  çağrılabilen bir uç nokta olsaydı herkes başkasının hakkını düşürebilirdi.

  Çağıran, hakkı dış isteği göndermeden HEMEN ÖNCE düşürür; yetki,
  geçerlilik, abonelik ve kütüphane denetimleri bundan önce gelir.

  Eskiden Kaynaklar araması sayaç yoksa ya da hata verirse üretimde de
  açık geçiyordu; lookupDoi ve toplu DOI hiç saymıyordu.
*/
export async function dizinHakkiDus(kullaniciId: string): Promise<KotaKarari> {
  // Ortam değişkenleri BİLEREK düz yazılı: ARVOLAB_DAGITIM_ORTAMI derlemede gömülüyor.
  const uretim = uretimMi(process.env.VERCEL_ENV, process.env.ARVOLAB_DAGITIM_ORTAMI);
  const admin = adminIstemcisiVarsa();
  let karar: KotaKarari;
  if (!admin) {
    karar = kotaKarari("sayac_yok", uretim);
  } else {
    try {
      const { data, error } = await admin.rpc("rate_limit_hit", {
        p_key: dizinKotaAnahtari(kullaniciId),
        p_limit: DIZIN_SAATLIK_HAK,
        p_window: DIZIN_KOTA_PENCERESI,
      });
      if (error) console.error("[dizin-kotasi] sayaç hata verdi:", error.message);
      karar = kotaKarari(sayacCevabi(data, error), uretim);
    } catch (hata) {
      console.error("[dizin-kotasi] sayaç çağrılamadı:", hata instanceof Error ? hata.message : hata);
      karar = kotaKarari("sayac_hatasi", uretim);
    }
  }
  if (karar.tur === "izin" && karar.uyari) console.warn(`[dizin-kotasi] üretim dışı ortam, kota denetlenmeden geçildi: ${karar.uyari}`);
  if (karar.tur === "denetlenemedi") console.error("[dizin-kotasi] üretimde sayaç yok ya da hata verdi: dış istek gönderilmedi");
  return karar;
}
