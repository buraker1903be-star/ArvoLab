import { revalidatePath } from "next/cache";
import { CALISMA_LISTESI_ADRESLERI } from "./kisisel-calismalar";

/*
  ÇALIŞMA LİSTELERİNİN YENİLENMESİ (20.11.2026, PR #113). Bir çalışmayı
  değiştiren işlem (bilgileri düzenleme, silme, kılavuz, etik, takvim,
  kaynak…) kartları gösteren sayfaları tek çağrıyla yeniler: Ana Sayfa ve
  Çalışmalarım. Eskiden on üç işlem dosyası aynı iki revalidatePath'i elle
  yazıyordu; yeni bir liste sayfası eklenirse adres listesi tek yerde
  (lib/kisisel-calismalar.ts). Bir süre Yönetim'in iki sayfası da
  listedeydi; Yönetim kalkınca çıktı.

  Bilerek "use server" DEĞİL (AGENTS.md): yardımcıdır, uç nokta değil.
*/
export function calismaListeleriniYenile() {
  for (const adres of CALISMA_LISTESI_ADRESLERI) revalidatePath(adres);
}
