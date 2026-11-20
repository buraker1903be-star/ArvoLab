/*
  Asistanın kullanıcı başına saatlik hakkı (lib/ai/erisim.ts uygular).
  Ayrı ve saf bir dosyada: Kullanım Kılavuzu (lib/yardim) aynı sayıyı
  kullanıcıya yazıyor ve Supabase'e dokunan erisim.ts'i içe aktaramaz.
  Sayı iki yerde yazılsaydı kılavuz bir gün yanlış hakkı söylerdi.
*/
export const SAATLIK_HAK = 20;

/*
  Satır içi tamamlamanın SUNUCUDAKİ en az aralığı (20.11.2026). Ayrı bir
  hak DEĞİL (yetenek başına hak tutulmaz, lib/ai/erisim.ts): her öneri
  yine saatlik asistan hakkından ve kurum kredisinden düşer. Bu yalnızca
  daha sıkı bir fren: tarayıcı kodu atlanarak tuş başına istek
  gönderilemesin. Eskiden fren istemcideydi ("saatte 12", localStorage)
  ve sunucu hiçbir şey bilmiyordu.
*/
export const TAMAMLAMA_EN_AZ_ARALIK_SN = 3;
