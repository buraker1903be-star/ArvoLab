/*
  TEK CİHAZDA OTURUM (02.11.2026, kurum sahibinin isteği: "A bilgisayarında
  oturum açıkken B'den aynı hesapla girilince A'daki oturum kapanmalı ve
  kişiye 'başka bir cihazda oturum açıldı' denmeli").

  Mekanizma Supabase'in kendisi: girişte signOut({ scope: "others" })
  (app/actions/auth.ts → login) öteki oturumların sunucudaki kaydını ve
  yenileme belirteçlerini siler. A'nın elindeki erişim belirteci süresi
  dolmasa bile Auth sunucusu onu "session_not_found" ile reddeder; süresi
  dolmuşsa yenileme "refresh_token_not_found" ile düşer. Ayrı bir tablo ya
  da "etkin oturum" sütunu tutulmuyor — iki kaynak ayrışırsa biri kişiyi
  yanlışlıkla dışarı atar.

  NASIL TANINIR: Supabase istemcisi "session_not_found" cevabını kodlu bir
  hata olarak DEĞİL, AuthSessionMissingError ("oturum yok") olarak döndürür
  — hiç giriş yapmamış ziyaretçiye verdiği hatanın aynısı (auth-js
  lib/fetch.js). Ayırt eden şey tarayıcıdaki oturum ÇEREZİ: çerez vardı
  ama sunucu oturumu tanımıyorsa oturum başka bir girişle kapatılmıştır.
  İlk sürüm yalnızca hata koduna bakıyordu ve gerçek istemciyle denenince
  uyarı hiç çıkmadı (02.11.2026, sahte Auth sunucusuyla ölçüldü).
  Süresi dolmuş erişim belirtecinde yenileme "refresh_token_not_found"
  koduyla düşer; o kod doğrudan tanınır.

  Bunların DIŞINDAKİ hatalar (ağ, zaman aşımı, Auth sunucusu arızası)
  kişiyi dışarı atmaz: geçici bir arıza, çalışırken metni yarıda bırakan
  bir "oturumunuz kapatıldı" ekranı olmamalı. "session_expired" de
  sayılmıyor — o oturum süresi sınırı, başka cihaz değil.

  Saf modül; testi tests/unit/tek-oturum.test.ts.
*/
export const BASKA_CIHAZ_BILGISI = "baska-cihaz";

const BASKA_CIHAZ_KODLARI = new Set(["session_not_found", "refresh_token_not_found"]);

/** Supabase SSR oturum çerezi: sb-<proje>-auth-token (parçalıysa .0, .1 ekli). */
export const oturumCereziMi = (ad: string) => ad.startsWith("sb-") && ad.includes("-auth-token");

export function baskaCihazdanKapatildiMi(
  hata: { code?: string | null; name?: string | null } | null | undefined,
  oturumCereziVardi: boolean,
): boolean {
  if (!hata || !oturumCereziVardi) return false;
  if (hata.code && BASKA_CIHAZ_KODLARI.has(hata.code)) return true;
  return hata.name === "AuthSessionMissingError";
}
