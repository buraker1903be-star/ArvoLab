/*
  GİRİŞ HIZ SINIRI (Phase 2, 04.11.2026).

  Kayıt ve şifre sıfırlamada sınır vardı, girişte yoktu. Supabase'in
  kendi sınırı IP başına, ama giriş isteği SUNUCUDAN gidiyor: Supabase
  her kullanıcıyı Vercel'in adresinden geliyor görüyor. Yani sınır ya
  herkese birden işliyordu ya da hiç.

  Yalnızca HATALI denemeler sayılır. Her denemeyi saymak aynı kampüs
  ağından (tek IP) giren öğrencileri birbirine kilitlerdi. Başarılı giriş
  adresin sayacını sıfırlar. Bedeli bilinerek kabul edildi: başkasının
  adresine 10 yanlış şifre deneyen biri o adresi 15 dakika kilitleyebilir;
  kilitli kişi şifre sıfırlamayla her zaman girebilir.

  Sayaç veritabanında (public.auth_rate_limits, rate_limit_hit,
  migration 20260924100002): sunucu her istekte başka örnekte çalışıyor.
*/
export const GIRIS_PENCERESI_MS = 15 * 60 * 1000;
export const GIRIS_PENCERESI_SQL = "15 minutes";
export const ADRES_SINIRI = 10;
export const IP_SINIRI = 50;

export const girisAnahtarlari = (eposta: string, ip: string) => ({
  adres: `giris:${eposta.trim().toLowerCase()}`,
  ip: `giris-ip:${ip}`,
});

/** Sayaç satırı penceresinin içinde ve sınıra ulaşmışsa giriş denenmez. */
export function girisKilitliMi(
  satir: { count: number; window_start: string } | null | undefined,
  sinir: number,
  simdi: number,
): boolean {
  if (!satir) return false;
  const baslangic = Date.parse(satir.window_start);
  if (Number.isNaN(baslangic) || simdi - baslangic >= GIRIS_PENCERESI_MS) return false;
  return satir.count >= sinir;
}
