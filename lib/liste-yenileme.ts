import { revalidatePath } from "next/cache";
import { CALISMA_LISTESI_ADRESLERI } from "./yonetim";

/*
  ÇALIŞMA LİSTELERİNİN YENİLENMESİ (20.11.2026, PR #113). Bir çalışmayı
  değiştiren işlem (onay, onayı kaldırma, bilgileri düzenleme, silme,
  kılavuz, etik, takvim…) kartları ve sayaçları gösteren DÖRT sayfayı
  birden yeniler: Ana Sayfa, Çalışmalarım ve Yönetim'in iki sayfası.
  Eskiden işlemler yalnızca "/dashboard/editor" ve "/dashboard"ı
  yeniliyordu; Yönetim ayrı adrese taşınınca onay verip listeye dönen
  Kontrolör eski sayacı görüyor, sayfayı elle yenilemesi gerekiyordu.
  Adres listesi tek yerde: yeni bir liste sayfası eklenirse burası.

  Bilerek "use server" DEĞİL (AGENTS.md): yardımcıdır, uç nokta değil.
*/
export function calismaListeleriniYenile() {
  for (const adres of CALISMA_LISTESI_ADRESLERI) revalidatePath(adres);
}
