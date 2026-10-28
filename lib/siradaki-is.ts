import type { Adim } from "@/lib/calisma-ozeti";
import type { Dil, Metin } from "@/lib/dil";
import type { ChecklistItem } from "@/lib/submission-checklist";

/*
  "ŞİMDİ NE YAPMALIYIM" — TEK İŞ (26.10.2026).

  Ana sayfa öğrenciye dört birim ve üç eksik gösteriyor. Hepsi doğru
  ama hiçbiri "önce hangisi" demiyordu; yeni başlayan bir öğrenci için
  yedi doğru seçenek, sıfır seçenekten daha iyi değil.

  SIRA KURALI, tahmin değil:

  1. Kılavuzun ZORUNLU TUTTUĞU bir eksik varsa o. Teslimi engelleyen
     şey budur; "biraz daha literatür topla" ondan sonra gelir.
  2. Yoksa, boru hattındaki ilk yarım birim (literatür → yazım →
     kaynakça → belge). Sıra birimlerin kendi listesinden geliyor
     (lib/calisma-ozeti.ts), burada ikinci kez yazılmıyor.
  3. İkisi de yoksa iş bitmiş demektir; cümle "hazır görünüyor" olur
     ama "hazır" DEMEZ — otomatik denetim danışman ve jüri kontrolünün
     yerini tutmuyor.

  Teslim tarihi işi DEĞİŞTİRMEZ, yalnızca aciliyetini söyler: yaklaşan
  tarih yüzünden sıradaki işi değiştirmek, öğrenciyi yanlış şeye
  koşturmak olurdu.

  Saf modül: testi tests/unit/siradaki-is.test.ts.
*/

export type Aciliyet = "normal" | "yaklasiyor" | "acil";

export interface SiradakiIs {
  baslik: string;
  aciklama: string;
  href: string;
  /** Bağlantının üstündeki eylem adı ("Eksik bölümleri ekle"). */
  eylem: string;
  aciliyet: Aciliyet;
  /** Yapacak iş kalmadı: cümle kutlama değil, "hazır görünüyor". */
  bitti: boolean;
  /*
    İş bir teslim kontrolü maddesinden geldiyse o maddenin kimliği.
    Çağıran bunu listesinden ÇIKARIYOR: aynı eksik hem "şimdi"
    satırında hem alttaki listede yazarsa, sayfanın geri kalanında
    temizlediğimiz tekrarın aynısı olurdu.
  */
  kaynakMadde?: string;
}

/** Teslime bu kadar gün kalınca "acil", bunun iki katında "yaklaşıyor". */
export const ACIL_GUN = 7;
export const YAKLASIYOR_GUN = 21;

export function aciliyetOlc(kalanGun: number | null): Aciliyet {
  if (kalanGun === null) return "normal";
  if (kalanGun <= ACIL_GUN) return "acil";
  if (kalanGun <= YAKLASIYOR_GUN) return "yaklasiyor";
  return "normal";
}

export function siradakiIs(girdi: {
  calismaId: string;
  /** Birimler, kendi sıralarında (lib/calisma-ozeti.ts). */
  adimlar: Adim[];
  /** Teslim kontrolünün tamamlanmamış maddeleri. */
  eksikler: ChecklistItem[];
  /** Teslime kalan gün; yoksa null. */
  kalanGun: number | null;
  /** Bu modülün kendi yazdığı metinlerin dili; adım ve madde metinleri çağıranın dilinde gelir. */
  dil?: Dil;
}): SiradakiIs {
  const aciliyet = aciliyetOlc(girdi.kalanGun);
  const t = (metin: Metin) => metin[girdi.dil ?? "tr"];

  /*
    "todo" ile "warning" ayrı: ilki eksik bir şey, ikincisi bakılması
    gereken bir şey. Eksik varsa önce o gelir.
  */
  const eksik = girdi.eksikler.find((e) => e.status === "todo") ?? girdi.eksikler.find((e) => e.status === "warning");
  if (eksik) {
    return {
      baslik: eksik.label,
      aciklama: eksik.detail,
      href: `/dashboard/editor/${girdi.calismaId}/write?teslim=${eksik.id}`,
      eylem: eksik.action?.label ?? t({ tr: "Teslim kontrolünde aç", en: "Open in submission check" }),
      aciliyet,
      bitti: false,
      kaynakMadde: eksik.id,
    };
  }

  const yarim = girdi.adimlar.find((adim) => !adim.tamam);
  if (yarim) {
    return {
      baslik: yarim.baslik,
      aciklama: yarim.aciklama,
      href: yarim.href,
      eylem: t({ tr: "Başla", en: "Start" }),
      aciliyet,
      bitti: false,
    };
  }

  return {
    baslik: t({ tr: "Teslime hazır görünüyor", en: "Looks ready for submission" }),
    /* "Hazır" DENMİYOR: otomatik denetim danışman ve jüri kontrolünün
       yerini tutmuyor; öyle demek öğrenciyi yanlış güvene sokardı. */
    aciklama: t({
      tr: "Otomatik denetimler temiz. Danışmanınızın kontrolü bunun yerini tutmaz.",
      en: "Automated checks are clean. This does not replace your advisor's review.",
    }),
    href: `/dashboard/editor/${girdi.calismaId}`,
    eylem: t({ tr: "Çalışma özetini aç", en: "Open work overview" }),
    aciliyet,
    bitti: true,
  };
}
