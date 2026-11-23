/*
  McDONALD OMEGA (ω) — tek faktörlü model, ham madde toplam puanı
  (23.11.2026).

  NEDEN. Güvenilirlik analizi yalnızca Cronbach α veriyordu. α, ölçeğin
  TAU-EŞDEĞER olduğunu (bütün maddelerin gizil değişkene AYNI yükle
  bağlandığını) varsayar; gerçek ölçeklerde bu varsayım nadiren
  karşılanır ve α o zaman güvenilirliği OLDUĞUNDAN DÜŞÜK gösterir.
  ω aynı veriyi tek faktörlü bir ölçüm modeliyle kestirir ve yüklerin
  farklı olmasına izin verir.

  HESAP. ω = (Σλ)² / ((Σλ)² + Σθ). Yükler (λ) STANDARTLAŞTIRILMAMIŞ ve
  hata varyansları (θ) MADDENİN KENDİ ÖLÇEĞİNDE; ikisi de tek faktörlü
  doğrulayıcı faktör analizinden (lib/stats-dfa.ts, en çok olabilirlik;
  faktör varyansı 1'e sabit) geliyor. Bu, HAM madde toplam puanının
  güvenilirliğidir. Maddeler standartlaştırılıp toplansaydı (ya da
  korelasyon matrisi üzerinden kestirilseydi) başka bir sayı çıkardı:
  madde varyansları birbirinden farklı olduğunda iki değer AYRILIR.
  Bu ilk sürüm yalnızca ham puanı veriyor; hangi model ve hangi
  kestirim kullanıldığı ekranda yazılı.

  TERS MADDE KENDİLİĞİNDEN ÇEVRİLMEZ. Diğerlerinin tersine yüklenen bir
  madde λ'sı negatif olarak girer ve Σλ'yı küçültür — ham toplam puanda
  olan budur. Mutlak değer almak, kullanıcının yapmadığı bir dönüşümü
  yapılmış gibi göstermek olurdu. Böyle maddeler `tersYuklenen` ile
  bildiriliyor; çevirme kararı kullanıcınındır.

  TEK FAKTÖRLÜ MODELİN KURULABİLMESİ TEK BOYUTLULUĞUN KANITI DEĞİLDİR.
  Model her veriye kurulur; uyup uymadığı ayrı bir sorudur ve
  Doğrulayıcı Faktör Analizi'nin uyum indekslerine bakılır. ω'nın
  üretilmiş olması "ölçek tek boyutlu" demek değildir.

  EKSİK VERİ BURADA ELENMEZ. Çağıran, α ile ω'nın AYNI maddeler ve AYNI
  eksiksiz satırlar üzerinden hesaplanması için listeyi önceden
  eşleştirir (lib/veri-eslestirme.ts). Bu modül tam veri bekler.

  Doğrulama: R + lavaan + semTools'a karşı (aynı model, aynı kestirim,
  aynı eksik veri kuralı) — scripts/referans/omega-referans.R →
  tests/fixtures/omega-referans.json; testi tests/unit/stats-omega.test.ts.

  Saf modül.
*/
import type { Metin } from "@/lib/dil";
import { dogrulayiciFaktorAnalizi } from "@/lib/stats-dfa";

export type OmegaEngel =
  | "az-madde"
  | "az-gozlem"
  | "tanimsiz"
  | "yakinsamadi"
  | "gecersiz-hata-varyansi"
  | "kestirilemedi";

export interface OmegaMaddesi {
  madde: string;
  /** Standartlaştırılmamış yük (faktör varyansı 1). */
  yuk: number;
  /** Maddenin kendi ölçeğindeki hata varyansı. */
  hata: number;
}

export interface OmegaSonucu {
  engel: null;
  omega: number;
  n: number;
  maddeSayisi: number;
  /** Σλ ve Σθ: ekranda formülün izlenebilmesi için. */
  yukToplami: number;
  hataToplami: number;
  maddeler: OmegaMaddesi[];
  /** Diğerlerinin TERSİNE yüklenen maddeler; çevrilmediği için ω'yı düşürürler. */
  tersYuklenen: string[];
  model: "tek-faktor";
  kestirim: "ml";
}

export interface OmegaEngeli {
  engel: OmegaEngel;
}

/** ω için en az bu kadar madde gerekir: iki maddeyle tek faktörlü model tanımlanamaz. */
export const OMEGA_EN_AZ_MADDE = 3;

export const OMEGA_ENGEL_METNI: Record<OmegaEngel, Metin> = {
  "az-madde": {
    tr: `ω için en az ${OMEGA_EN_AZ_MADDE} madde gerekir: iki maddeyle tek faktörlü model tanımlanamaz.`,
    en: `ω requires at least ${OMEGA_EN_AZ_MADDE} items: a one-factor model is not identified with two items.`,
  },
  "az-gozlem": {
    tr: "Eksiksiz gözlem sayısı madde sayısından fazla olmalı; ω üretilmedi.",
    en: "The number of complete observations must exceed the number of items; ω was not produced.",
  },
  tanimsiz: {
    tr: "Tek faktörlü model bu seçimle tanımlanamıyor; ω üretilmedi.",
    en: "The one-factor model is not identified for this selection; ω was not produced.",
  },
  yakinsamadi: {
    tr: "Kestirim yakınsamadı; ω üretilmedi.",
    en: "The estimation did not converge; ω was not produced.",
  },
  "gecersiz-hata-varyansi": {
    tr: "Kestirimde sıfır ya da negatif hata varyansı çıktı (Heywood durumu); ω üretilmedi.",
    en: "The estimation produced a zero or negative error variance (a Heywood case); ω was not produced.",
  },
  kestirilemedi: {
    tr: "Model kestirilemedi; maddelerden biri sabit ya da iki madde birbirinin aynısı olabilir. ω üretilmedi.",
    en: "The model could not be estimated; an item may be constant or two items identical. ω was not produced.",
  },
};

/**
 * Tek faktörlü modelden HAM madde toplam puanı için McDonald ω.
 *
 * `maddeler[i]` i. maddenin gözlemleri; bütün maddeler aynı uzunlukta ve
 * EKSİKSİZ olmalı (eleme çağıranın işi). Üretilemediğinde sebebi döner.
 */
export function mcdonaldOmega(maddeler: number[][], maddeAdlari: string[]): OmegaSonucu | OmegaEngeli {
  if (maddeAdlari.length !== maddeler.length) throw new Error("McDonald ω: her madde için bir ad gerekiyor.");
  const n = maddeler[0]?.length ?? 0;
  if (maddeler.some((m) => m.length !== n)) throw new Error("McDonald ω: bütün maddeler aynı sayıda gözlem taşımalı.");
  if (maddeler.length < OMEGA_EN_AZ_MADDE) return { engel: "az-madde" };

  const dfa = dogrulayiciFaktorAnalizi(maddeler, maddeAdlari, {
    faktorler: ["F"],
    maddeFaktoru: maddeler.map(() => 0),
  });
  if (typeof dfa === "string") return { engel: dfa === "az-madde" ? "az-madde" : dfa };
  if (!dfa.yakinsadi) return { engel: "yakinsamadi" };

  const satirlar: OmegaMaddesi[] = dfa.yukler.map((y) => ({ madde: y.madde, yuk: y.b, hata: y.hata }));
  if (satirlar.some((s) => !Number.isFinite(s.yuk) || !Number.isFinite(s.hata))) return { engel: "kestirilemedi" };
  /* Sıfır hata varyansı da geçersiz: ω = 1 çıkar ve ölçüm hatasız görünür. */
  if (satirlar.some((s) => s.hata <= 0)) return { engel: "gecersiz-hata-varyansi" };

  const yukToplami = satirlar.reduce((t, s) => t + s.yuk, 0);
  const hataToplami = satirlar.reduce((t, s) => t + s.hata, 0);
  const payda = yukToplami * yukToplami + hataToplami;
  if (!(payda > 0)) return { engel: "kestirilemedi" };
  const omega = (yukToplami * yukToplami) / payda;
  if (!Number.isFinite(omega)) return { engel: "kestirilemedi" };

  /*
    Çoğunluğun yönü referans alınır; ona ters düşen madde ters kodlanmış
    olabilir. Faktörün işareti keyfî olduğu için tek tek işaret değil,
    ÇOĞUNLUĞA GÖRE yön bakılıyor.
  */
  const artiSayisi = satirlar.filter((s) => s.yuk > 0).length;
  const yon = artiSayisi * 2 >= satirlar.length ? 1 : -1;
  const tersYuklenen = satirlar.filter((s) => s.yuk * yon < 0).map((s) => s.madde);

  return {
    engel: null,
    omega,
    n: dfa.n,
    maddeSayisi: satirlar.length,
    yukToplami,
    hataToplami,
    maddeler: satirlar,
    tersYuklenen,
    model: "tek-faktor",
    kestirim: "ml",
  };
}
