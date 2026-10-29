/*
  Zamanlanmış iş isteğinin yetkisi (Vercel cron: "Authorization: Bearer
  <CRON_SECRET>"). Karşılaştırma SABİT SÜRELİ: eskiden beş rotada `!==` ile
  yapılıyordu; düz karşılaştırma ilk farklı karakterde durduğu için yanıt
  süresi sırrın ne kadarının tuttuğunu sızdırabilir. ArvoOS köprüsü baştan
  timingSafeEqual kullanıyor. Sır tanımlı değilse hiçbir istek geçmez.

  Bilerek "use server" DEĞİL (AGENTS.md).
*/
import { createHash, timingSafeEqual } from "node:crypto";

const ozet = (metin: string) => createHash("sha256").update(metin).digest();

export function cronYetkiliMi(request: Request): boolean {
  const sir = process.env.CRON_SECRET;
  if (!sir) return false;
  const gelen = request.headers.get("authorization") ?? "";
  // Özetler eşit uzunlukta: timingSafeEqual uzunluk farkında fırlatmasın, uzunluk da sızmasın.
  return timingSafeEqual(ozet(gelen), ozet(`Bearer ${sir}`));
}
