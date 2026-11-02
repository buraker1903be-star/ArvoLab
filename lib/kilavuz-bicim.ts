import { normalizeHeading } from "@/lib/section-match";

/*
  KILAVUZUN İNCE BİÇİM KURALLARI (02.11.2026).

  Kurum sahibinin isteği: "tam kapsamlı bir sistem yapıyoruz". DEÜ Sosyal
  Bilimler kılavuzu tarandığında beş kural okunuyor ama hiçbir yere
  inmiyordu, çünkü editörde, baskıda ve Word'de karşılıkları yoktu:

    - dipnot puntosu          ("Dipnotlarda … Times New Roman için 10, Arial için 9 punto")
    - paragraf aralığı        ("Paragraf Aralıkları: … önce 0nk, sonra 0nk")
    - bölüm başlığının hizası ("BÖLÜM BAŞLIKLARI sayfanın ortasına …, GİRİŞ, SONUÇ,
                                KAYNAKÇA başlıkları … en sola yaslı")
    - sayfa numarasının yeri  ("Sayfa Numarası: Sağ alt köşe")
    - numarasız ana bölümler  ("“Giriş” ve “Sonuç” başlıkları … numaralandırma yapılmayacaktır")

  Hepsi aynı ilkeyle çıkarılır: ölçü ya da yer AÇIKÇA yazılmışsa kural
  yazılır, yazılmamışsa hiç yazılmaz. "Bilmiyorum" ile "istemiyor" aynı şey
  değil; tahmin edilen bir kural öğrencinin belgesine doğrudan iner.

  Saf modül; testi tests/unit/kilavuz-bicim.test.ts.
*/

export const SAYFA_NUMARASI_KONUMLARI = ["bottom-center", "bottom-right", "top-center", "top-right"] as const;
export type SayfaNumarasiKonumu = (typeof SAYFA_NUMARASI_KONUMLARI)[number];
export const sayfaNumarasiKonumuMu = (deger: unknown): deger is SayfaNumarasiKonumu =>
  typeof deger === "string" && (SAYFA_NUMARASI_KONUMLARI as readonly string[]).includes(deger);

export type BolumHizasi = "center" | "left";
export const bolumHizasiMi = (deger: unknown): deger is BolumHizasi => deger === "center" || deger === "left";

/** Paragraf öncesi/sonrası boşluk, punto (nk) cinsinden. */
export type ParagrafAraligi = { beforePt: number; afterPt: number };

const EN_COK_ARALIK_PT = 36;
export const paragrafAraligiMi = (deger: unknown): deger is ParagrafAraligi => {
  if (!deger || typeof deger !== "object") return false;
  const { beforePt, afterPt } = deger as Record<string, unknown>;
  const gecerli = (n: unknown) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= EN_COK_ARALIK_PT;
  return gecerli(beforePt) && gecerli(afterPt);
};

export const dipnotPuntosuMu = (deger: unknown): deger is number =>
  typeof deger === "number" && Number.isFinite(deger) && deger >= 6 && deger <= 14;

/** Tarayıcının metni; büyük "İ" düzleştirilmiş (lib/guideline-scan.ts, noktaliIDuzle). */
const sayi = (ham: string | undefined) => (ham === undefined ? undefined : Number(ham.replace(",", ".")));

/*
  Kılavuzun geri kalanının ölçüsünü (12 punto) dipnotunkiyle karıştırmamak
  için cümle "dipnot" sözcüğünden başlatılır ve ilk güçlü cümle sonunda
  kesilir. Yazı tipine bağlı yazılmışsa ("Times New Roman için 10, Arial
  için 9 punto") SEÇİLEN yazı tipinin ölçüsü alınır; gövdedeki eşinin
  (lib/guideline-scan.ts, yaziTipininPuntosu) aynı mantığı.
*/
export function dipnotPuntosuCikar(compact: string, yaziTipi?: string): number | undefined {
  const cumleler = compact.matchAll(/dipnot\p{L}*[^.;]{0,200}/giu);
  for (const eslesme of cumleler) {
    const cumle = eslesme[0];
    if (!/punto|pt\b/iu.test(cumle)) continue;
    if (yaziTipi) {
      const ad = yaziTipi.replace(/\s+/g, "\\s+");
      const bagli = new RegExp(`${ad}\\s*(?:karakter\\p{L}*\\s+|için\\s+|ile\\s+)*(?:için\\s+)?(\\d{1,2}(?:[,.]5)?)(?!\\d)`, "iu").exec(cumle);
      const deger = sayi(bagli?.[1]);
      if (dipnotPuntosuMu(deger)) return deger;
    }
    const duz = /(\d{1,2}(?:[,.]5)?)\s*(?:punto|pt)\b/iu.exec(cumle);
    const deger = sayi(duz?.[1]);
    if (dipnotPuntosuMu(deger)) return deger;
  }
  return undefined;
}

/*
  "önce 0nk, sonra 0nk", "paragraf öncesi 6 nk, sonrası 6 nk",
  "Önce: 0 pt Sonra: 12 pt". Yalnızca "paragraf" sözcüğünün ardındaki kısa
  pencerede aranır: başlıkların "önce 12 nk" kuralı gövdenin kuralı değil.
  "Paragraflar arasında boşluk bırakılmamalı" ölçü yazmasa da açık bir
  hükümdür: 0/0. "Bir satır boşluk bırakılmalı" ise ölçüsüz ve satır
  aralığına bağlı — tahmin edilmez.
*/
export function paragrafAraligiCikar(compact: string): ParagrafAraligi | undefined {
  for (const eslesme of compact.matchAll(/paragraf\p{L}*/giu)) {
    const pencere = compact.slice(eslesme.index, eslesme.index + 170);
    const once = /önce(?:si)?\s*[:=]?\s*(\d{1,2}(?:[,.]\d)?)\s*(?:nk|pt|punto)/iu.exec(pencere);
    const sonra = /sonra(?:sı)?\s*[:=]?\s*(\d{1,2}(?:[,.]\d)?)\s*(?:nk|pt|punto)/iu.exec(pencere);
    if (once && sonra) {
      const aralik = { beforePt: sayi(once[1])!, afterPt: sayi(sonra[1])! };
      if (paragrafAraligiMi(aralik)) return aralik;
    }
  }
  if (/paragraf\p{L}*\s+aras[ıi]nda\s+(?:hiç\s+)?boşluk\s+bırak[ıi]lma(?:mal|z)/iu.test(compact)) return { beforePt: 0, afterPt: 0 };
  return undefined;
}

/*
  Sayfa numarasının yeri. "Sağ alt köşe", "sayfanın altına ortalanarak",
  "sağ üst köşede". Pencere "sayfa numara…" sözcüğünden sonraki 120
  karakter; numaranın yeri hemen ardından yazılıyor.
*/
export function sayfaNumarasiKonumuCikar(compact: string): SayfaNumarasiKonumu | undefined {
  for (const eslesme of compact.matchAll(/sayfa\s+numara\p{L}*/giu)) {
    const pencere = compact.slice(eslesme.index, eslesme.index + 120);
    const ust = /üst/iu.test(pencere) && !/alt/iu.test(pencere);
    const alt = /\balt|altına|altında|altbilgi/iu.test(pencere);
    const sag = /sağ/iu.test(pencere);
    const orta = /orta|ortala/iu.test(pencere);
    if (!(ust || alt)) continue;
    if (sag) return ust ? "top-right" : "bottom-right";
    if (orta) return ust ? "top-center" : "bottom-center";
  }
  return undefined;
}

/*
  Ana bölüm başlığının hizası ve İSTİSNALARI. DEÜ SBE: "Tezin BÖLÜM
  BAŞLIKLARI sayfanın ortasına yazılmak kaydıyla, GİRİŞ, SONUÇ, KAYNAKÇA
  başlıkları ve BİRİNCİ DERECE ALT BAŞLIKLAR en sola yaslı". Bölümler
  ortalanırken Giriş, Sonuç ve Kaynakça sola yaslanıyor; istisnasız
  ortalamak bu kılavuzda üç ana başlığı yanlış yere koyardı.
*/
const ADAY_BOLUMLER = ["Giriş", "Sonuç", "Sonuç ve Öneriler", "Kaynakça", "Kaynaklar", "Özet", "Abstract", "Ekler", "İçindekiler"];

export function bolumHizasiCikar(compact: string): { hiza: BolumHizasi; solaYasli: string[] } | undefined {
  const ortala = /bölüm\s+başl[ıi](?:k|ğ)\p{L}*[^.;]{0,60}?(?:sayfan[ıi]n\s+ortas[ıi]na|ortalan|ortaya\s+(?:hizal|yasl|yaz)|ortal[ıi]\s)/iu.exec(compact);
  const sola = /bölüm\s+başl[ıi](?:k|ğ)\p{L}*[^.;]{0,60}?(?:sola\s+(?:yasl|hizal|dayal)|sol\s+kenara)/iu.exec(compact);
  if (!ortala && !sola) return undefined;
  if (ortala && sola) {
    // İkisi de geçiyorsa önce yazılan hükümdür; ötekisi genellikle istisnanın cümlesi.
    if (sola.index < ortala.index) return { hiza: "left", solaYasli: [] };
  }
  if (!ortala) return { hiza: "left", solaYasli: [] };
  const cumle = compact.slice(ortala.index, ortala.index + 260);
  const solMu = /(?:en\s+)?sola\s+(?:yasl|hizal|dayal)/iu.exec(cumle);
  const solaYasli = solMu
    ? ADAY_BOLUMLER.filter((ad) => new RegExp(`(?<!\\p{L})${ad.replaceAll("İ", "I")}(?!\\p{L})`, "iu").test(cumle.slice(0, solMu.index)))
    : [];
  return { hiza: "center", solaYasli: solaYasli.filter((ad) => !solaYasli.some((d) => d !== ad && d.startsWith(`${ad} `))) };
}

/*
  "“Giriş” ve “Sonuç” başlıkları ayrı bir bölüm olmadığından
  numaralandırma yapılmayacaktır." Varsayılan numaralandırma Giriş ve
  Sonuç'u numaralıyor (lib/heading-numbering.ts); bu kılavuzda
  "1. GİRİŞ" yazmak kural ihlali.
*/
export function numarasizBolumlerCikar(compact: string): string[] {
  const bulunan: string[] = [];
  for (const eslesme of compact.matchAll(/((?:[“"']?\p{L}+[”"']?\s*(?:,|ve|ile)\s*)+[“"']?\p{L}+[”"']?)\s+başl[ıi]k\p{L}*[^.;]{0,80}?numaraland[ıi]r(?:ma\s+yap[ıi]lmay|[ıi]lmay|[ıi]lmaz|[ıi]lmamal)/giu)) {
    for (const ad of ["Giriş", "Sonuç"]) {
      if (new RegExp(`(?<!\\p{L})${ad}(?!\\p{L})`, "iu").test(eslesme[1]) && !bulunan.includes(ad)) bulunan.push(ad);
    }
  }
  return bulunan;
}

/**
 * Başlık adı listede mi? "Sonuç" kuralı "Sonuç ve Öneriler"i de kapsar:
 * kılavuzun bölümü bu adla geçiyor ve aynı başlık.
 */
export function adListedeMi(baslik: string, adlar: readonly string[] | undefined): boolean {
  if (!adlar?.length) return false;
  const b = normalizeHeading(baslik);
  return adlar.some((ad) => {
    const a = normalizeHeading(ad);
    return a.length > 0 && (b === a || b.startsWith(`${a} `));
  });
}

/** Birinci düzey başlığın kılavuzdaki hizası; kural yoksa null (başlığın kendi hizası geçerli). */
export function anaBaslikHizasi(
  baslik: string,
  ayar: { chapterAlign?: BolumHizasi; chapterLeftSections?: string[] },
): BolumHizasi | null {
  if (!ayar.chapterAlign) return null;
  if (ayar.chapterAlign === "center" && adListedeMi(baslik, ayar.chapterLeftSections)) return "left";
  return ayar.chapterAlign;
}

/** "nk": Türkçe Word'ün "nokta" birimi, punto ile aynı. */
export const SAYFA_NUMARASI_ADI: Record<SayfaNumarasiKonumu, { tr: string; en: string }> = {
  "bottom-center": { tr: "alt orta", en: "bottom centre" },
  "bottom-right": { tr: "sağ alt", en: "bottom right" },
  "top-center": { tr: "üst orta", en: "top centre" },
  "top-right": { tr: "sağ üst", en: "top right" },
};

/** Ekranda bölüm hizasının cümlesi; istisnalar adıyla. */
export function bolumHizasiMetni(hiza: BolumHizasi, solaYasli?: string[]): { tr: string; en: string } {
  if (hiza === "left") return { tr: "Sola yaslı", en: "Left-aligned" };
  return solaYasli?.length
    ? { tr: `Ortalanır (${solaYasli.join(", ")} sola yaslı)`, en: `Centred (${solaYasli.join(", ")} left-aligned)` }
    : { tr: "Ortalanır", en: "Centred" };
}

/*
  ALT BAŞLIK GİRİNTİSİ (02.11.2026). DEÜ SBE: "birinci dereceden sonraki
  başlıkların tümü 1,25 cm içeriden hizalı". Belgede H1 bölüm, H2 birinci
  derece alt başlık; "birinci dereceden SONRAKİ" H3 ve altı demek.
  Sıra sözcüğü düzeye çevrilir: N. derece alt başlık = H(N+1), "N.
  dereceden sonraki" = H(N+2). İçindekiler'in kendi girintisi ("her derece
  için 1'er cm") bu kural değil; "1’er" bir ölçü olarak okunmuyor.
*/
export type AltBaslikGirintisi = { fromLevel: 2 | 3 | 4; cm: number };

const SIRA: Record<string, number> = { birinci: 1, ikinci: 2, üçüncü: 3, "1.": 1, "2.": 2, "3.": 3 };

export const altBaslikGirintisiMi = (deger: unknown): deger is AltBaslikGirintisi => {
  if (!deger || typeof deger !== "object") return false;
  const { fromLevel, cm } = deger as Record<string, unknown>;
  return (fromLevel === 2 || fromLevel === 3 || fromLevel === 4) && typeof cm === "number" && cm >= 0.3 && cm <= 3;
};

export function altBaslikGirintisiCikar(compact: string): AltBaslikGirintisi | undefined {
  const olcu = "(\\d(?:[,.]\\d+)?)\\s*cm\\s+(?:içeriden|içeri|girinti)";
  const sirali = new RegExp(
    `(birinci|ikinci|üçüncü|[123]\\.)\\s+derece(den\\s+sonraki)?\\s+(?:alt\\s+)?başl[ıi](?:k|ğ)\\p{L}*[^.;]{0,50}?${olcu}`,
    "iu",
  ).exec(compact);
  if (sirali) {
    /* Metin noktalı İ'si düzleştirilmiş geliyor ("BİRİNCİ" → "BIRINCI"); Türkçe küçültme onu
       "bırıncı" yapar ve sözlükte bulunmazdı — ı da i'ye indiriliyor. */
    const n = SIRA[sirali[1].toLocaleLowerCase("tr-TR").replaceAll("ı", "i")];
    const duzey = n + 1 + (sirali[2] ? 1 : 0);
    const deger = { fromLevel: duzey, cm: Number(sirali[3].replace(",", ".")) };
    return altBaslikGirintisiMi(deger) ? deger : undefined;
  }
  const genel = new RegExp(`(?<!\\p{L})alt\\s+başl[ıi](?:k|ğ)\\p{L}*[^.;]{0,40}?${olcu}`, "iu").exec(compact);
  if (genel) {
    const deger = { fromLevel: 2 as const, cm: Number(genel[1].replace(",", ".")) };
    return altBaslikGirintisiMi(deger) ? deger : undefined;
  }
  return undefined;
}

/** Başlık bu düzeyde kılavuzun girintisini alıyor mu; ölçüsü ya da null. */
export function altBaslikGirintisi(duzey: number, kural: AltBaslikGirintisi | undefined): number | null {
  return kural && duzey >= kural.fromLevel ? kural.cm : null;
}

/** Ekranda alt başlık girintisinin cümlesi ("H3 ve altı" yerine okunur sıra). */
export function altGirintiMetni(kural: AltBaslikGirintisi): { tr: string; en: string } {
  const cm = { tr: String(kural.cm).replace(".", ","), en: String(kural.cm) };
  const duzey = kural.fromLevel - 1;
  return {
    tr: `${duzey}. derece alt başlıktan itibaren ${cm.tr} cm içeriden`,
    en: `From level-${duzey} subheadings: indented ${cm.en} cm`,
  };
}
