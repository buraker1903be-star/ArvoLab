/*
  robots.txt kurallarına uyum.

  Kılavuz taraması üniversitelerin resmî sitelerine gidiyor ama robots.txt'i
  yalnızca "Sitemap:" satırlarını almak için okuyor, "Disallow" kurallarını
  tamamen yok sayıyordu. Kurumun açıkça "burayı taramayın" dediği yere
  girmek, izin verilen bir şey yapmıyor olmamızı değiştirmez: bu dosya
  kurumun taleplerini bildirdiği standart yoldur ve ArvoLab onlarca
  üniversitenin sunucusuna her gece istek atıyor.

  Ayrıştırma bilerek dar: yalnızca bizi ilgilendiren gruplar (kendi
  aracımız ve "*") ve yalnızca Disallow/Allow yolları. Crawl-delay,
  joker karakterler ve $ sonlandırıcısı da destekleniyor çünkü Türk
  üniversite sitelerinde yaygın.

  Saf modül; testi tests/unit/robots.test.ts.
*/

export type RobotsKurallari = {
  /** Yasak yol önekleri (joker karakterler ayrıştırılmış hâlde). */
  yasak: string[];
  /** Yasağın istisnaları; Allow, aynı uzunlukta Disallow'u yener. */
  izin: string[];
  /** Kurumun istediği bekleme (saniye); yoksa null. */
  gecikmeSn: number | null;
};

/** Bizim aracımızın robots.txt'te aranacak adı. */
export const ARAC_ADI = "arvolab-guideline-monitor";

/**
 * robots.txt metnini bizi bağlayan kurallara indirger.
 *
 * Bir robots.txt birden çok "User-agent" grubu taşır. Aracımızı adıyla
 * anan bir grup varsa YALNIZCA o geçerlidir (standart böyle); yoksa "*"
 * grubu geçerlidir.
 */
export function robotsCozumle(metin: string): RobotsKurallari {
  const satirlar = metin.split(/\r?\n/).map((satir) => satir.replace(/#.*$/, "").trim());

  type Grup = { adlar: string[]; yasak: string[]; izin: string[]; gecikme: number | null };
  const gruplar: Grup[] = [];
  let aktif: Grup | null = null;
  // Arka arkaya gelen User-agent satırları TEK grubu tanımlar.
  let adToplaniyor = false;

  for (const satir of satirlar) {
    const ayrac = satir.indexOf(":");
    if (ayrac === -1) continue;
    const alan = satir.slice(0, ayrac).trim().toLowerCase();
    const deger = satir.slice(ayrac + 1).trim();

    if (alan === "user-agent") {
      if (!aktif || !adToplaniyor) {
        aktif = { adlar: [], yasak: [], izin: [], gecikme: null };
        gruplar.push(aktif);
      }
      aktif.adlar.push(deger.toLowerCase());
      adToplaniyor = true;
      continue;
    }
    if (!aktif) continue;
    adToplaniyor = false;

    if (alan === "disallow" && deger) aktif.yasak.push(deger);
    // Boş Disallow "her şeye izin" demektir; kural eklenmez.
    else if (alan === "allow" && deger) aktif.izin.push(deger);
    else if (alan === "crawl-delay") {
      const sayi = Number(deger.replace(",", "."));
      if (Number.isFinite(sayi) && sayi >= 0) aktif.gecikme = sayi;
    }
  }

  const bizeOzel = gruplar.filter((grup) => grup.adlar.includes(ARAC_ADI));
  const genel = gruplar.filter((grup) => grup.adlar.includes("*"));
  const gecerli = bizeOzel.length ? bizeOzel : genel;

  return {
    yasak: gecerli.flatMap((grup) => grup.yasak),
    izin: gecerli.flatMap((grup) => grup.izin),
    gecikmeSn: gecerli.reduce<number | null>((en, grup) => (grup.gecikme === null ? en : Math.max(en ?? 0, grup.gecikme)), null),
  };
}

/** robots.txt kalıbını (joker ve $ destekli) düzenli ifadeye çevirir. */
function kalipRegex(kalip: string): RegExp {
  const kacisli = kalip.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  const govde = kacisli.replace(/\*/g, ".*");
  // Sondaki $ yol sonunu işaretler; yoksa önek eşleşmesi yeterlidir.
  return govde.endsWith("\\$") ? new RegExp(`^${govde.slice(0, -2)}$`) : new RegExp(`^${govde}`);
}

const enUzunEslesme = (kaliplar: string[], yol: string) =>
  kaliplar.filter((kalip) => kalipRegex(kalip).test(yol)).reduce((en, kalip) => Math.max(en, kalip.length), -1);

/**
 * Bu yol taranabilir mi?
 *
 * Çakışmada daha UZUN (daha özel) kural kazanır; eşitlikte Allow kazanır —
 * standart davranış budur.
 */
export function robotsIzinVeriyor(kurallar: RobotsKurallari, yol: string): boolean {
  const yasakBoyu = enUzunEslesme(kurallar.yasak, yol);
  if (yasakBoyu === -1) return true;
  return enUzunEslesme(kurallar.izin, yol) >= yasakBoyu;
}
