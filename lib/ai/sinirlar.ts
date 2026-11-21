/*
  Asistanın kullanıcı başına saatlik hakkı (lib/ai/erisim.ts uygular).
  Ayrı ve saf bir dosyada: Kullanım Kılavuzu (lib/yardim) aynı sayıyı
  kullanıcıya yazıyor ve Supabase'e dokunan erisim.ts'i içe aktaramaz.
  Sayı iki yerde yazılsaydı kılavuz bir gün yanlış hakkı söylerdi.
*/
export const SAATLIK_HAK = 20;

/*
  Satır içi tamamlamanın SUNUCUDAKİ en az aralığı (20.11.2026). Ayrı bir
  hak DEĞİL: bir fren. Tarayıcı kodu atlanarak tuş başına istek
  gönderilemesin, aynı anda iki istek de geçemesin (sayaç penceresi
  kullanıcı başına 1 istek). Eskiden fren istemcideydi ("saatte 12",
  localStorage) ve sunucu hiçbir şey bilmiyordu.
*/
export const TAMAMLAMA_EN_AZ_ARALIK_SN = 3;

/*
  SAATLİK HAKKIN TEK İSTİSNASI: SATIR İÇİ TAMAMLAMA (21.11.2026, kurum
  sahibinin kararı, "D seçeneği"). Tamamlama ("tamamla" görevi; otomatik
  ya da Alt+/ ile istenmiş, ikisi aynı) sohbetle ortak saatlik 20 haktan
  DÜŞMEZ. Ölçüldü: gerçekçi yazma temposunda sade istem ve 40 karakter /
  8 sn kuralıyla bile ortak hak 4. dakikada doluyor, sohbet o saatin
  sonuna kadar kilitleniyordu.
  Tamamlamada YİNE geçerli olanlar: oturum, abonelik, kurulum, deneme ve
  aylık AI kredisi (lib/ai/erisim.ts → asistanKapisi), sunucudaki en az
  aralık (yukarıda) ve her çalışmanın kaydı (kredi kayıttan düşer).
  Öteki bütün yetenekler (sohbet dahil) saatlik hakka tabi; bu liste
  bilerek tek elemanlı. Yeni bir görev eklemek bir karar ister, kod
  değişikliği değil.
*/
export const SAATLIK_HAKTAN_MUAF_GOREVLER: readonly string[] = ["tamamla"];
export function saatlikHakaSayilir(gorev: string): boolean {
  return !SAATLIK_HAKTAN_MUAF_GOREVLER.includes(gorev);
}
