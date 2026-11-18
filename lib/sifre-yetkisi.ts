import { DOGRULAMA_BAGLANTISI_SANIYE } from "./kimlik-kurallari";

/*
  ŞİFREYİ MEVCUT ŞİFRE OLMADAN KİM DEĞİŞTİREBİLİR (16.11.2026, RELEASE
  CLOSURE 03). Saf modül; testi tests/unit/sifre-yetkisi.test.ts.

  İki yol şifreyi değiştiriyor ve ikisi farklı kanıt istiyor:
   - Ayarlar (changePassword): mevcut şifre. Oturum tek başına yetmez.
   - /reset-password (resetPassword): e-postadaki bağlantı. Mevcut şifre
     sorulamaz — kişi onu unuttuğu için oradadır ya da hiç olmamıştır
     (kayıt/davet sonrası ilk şifre).

  Eskiden ikinci yolun sunucu işlemi YALNIZCA açık bir oturuma bakıyordu.
  Sunucu işlemi sayfadan bağımsız çağrılabildiği için şifreyle açılmış
  sıradan bir oturum (ele geçirilmiş çerez, açık bırakılmış bilgisayar)
  resetPassword'ü doğrudan çağırıp mevcut şifreyi hiç bilmeden yenisini
  koyabiliyordu; Ayarlar'daki mevcut şifre denetimi böylece boşa çıkardı.

  Kural: mevcut şifre olmadan değişiklik ancak şu iki durumda —
   1. Hesapta henüz şifre yok (ilk_sifre_gerekli(), migration
      20261107120542): kişi kayıt/davet bağlantısıyla gelmiş, oturum
      adresin sahibine ait. Ne kadar eski olursa olsun izin var; yoksa
      şifre belirlemeden çıkan kullanıcı kilitlenir (G1 R1).
   2. Oturum, e-postadaki bir bağlantıyla (şifre DIŞINDA bir yöntemle)
      açılmış VE o doğrulama bağlantının geçerlilik süresi içinde. Süre
      Supabase'in "Email OTP expiration" ayarının aynası
      (DOGRULAMA_BAGLANTISI_SANIYE). Süre sınırı olmasa, bir hafta önce
      magic link ile açılıp unutulmuş bir oturum da şifreyi değiştirebilirdi.

  AMR (oturumun hangi yöntemle açıldığı) erişim belirtecinden okunuyor;
  çağıran önce getUser() ile belirteci Auth sunucusunda doğrulatmış olmalı.
  Yenileme belirteçle AMR'nin zaman damgasını DEĞİŞTİRMEZ: damga ilk
  kimlik kanıtının anıdır.
*/

export type AmrKaydi = { method: string; timestamp: number };

export type SifirlamaKarari = "izin" | "suresi-doldu" | "yetkisiz";

/** Erişim belirtecinin gövdesinden AMR kayıtlarını (yöntem + saniye cinsinden zaman) çıkarır; bozuksa boş. */
export function amrKayitlari(erisimBelirteci: string | null | undefined): AmrKaydi[] {
  try {
    const govde = String(erisimBelirteci ?? "").split(".")[1];
    if (!govde) return [];
    const yuk = JSON.parse(Buffer.from(govde, "base64url").toString("utf8")) as { amr?: unknown };
    if (!Array.isArray(yuk.amr)) return [];
    const kayitlar: AmrKaydi[] = [];
    for (const k of yuk.amr) {
      if (!k || typeof k !== "object") continue;
      const { method, timestamp } = k as { method?: unknown; timestamp?: unknown };
      if (typeof method === "string" && method && typeof timestamp === "number" && Number.isFinite(timestamp)) {
        kayitlar.push({ method, timestamp });
      }
    }
    return kayitlar;
  } catch {
    return [];
  }
}

/**
 * Mevcut şifre sorulmadan şifre belirlemeye izin var mı.
 * ilkSifreGerekli: ilk_sifre_gerekli() sonucu; null = okunamadı (izin VERMEZ —
 * burası kapı değil yetki: okunamayan yetki "evet" sayılmaz).
 */
export function sifirlamaKarari(
  kayitlar: readonly AmrKaydi[],
  ilkSifreGerekli: boolean | null,
  simdiSaniye: number,
  sureSaniye: number = DOGRULAMA_BAGLANTISI_SANIYE,
): SifirlamaKarari {
  if (ilkSifreGerekli === true) return "izin";
  const baglantiylaAcilan = kayitlar.filter((k) => k.method !== "password");
  if (baglantiylaAcilan.length === 0) return "yetkisiz";
  // Gelecekteki damga (saat kayması) kabul edilmez; yalnızca son süre içindekiler.
  const taze = baglantiylaAcilan.some((k) => k.timestamp <= simdiSaniye + 60 && simdiSaniye - k.timestamp <= sureSaniye);
  return taze ? "izin" : "suresi-doldu";
}
