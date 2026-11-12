import { normalizeDoi } from "@/lib/doi";
import { kaynakAnahtarlari, type KaynakTaslagi } from "@/lib/kaynak-aktarim";

/*
  DOI LİSTESİNDEN TOPLU EKLEME — saf karar katmanı (T3, 12.11.2026).
  Sunucu eylemi (app/actions/kaynak-aktarim.ts, doiIleEkle) ağ ve
  veritabanı işini yapar; HANGİ DOI'nin ne olacağı burada ve
  tests/unit/doi-toplu.test.ts ile sınanır.

  Bütçe (lib/doi-sorgu-siniri.ts) yalnızca Crossref'e GERÇEKTEN gidecek
  DOI'lerden düşer: geçersiz biçim, listede tekrar ve bu çalışmada zaten
  olan DOI ağa gitmez, hak da harcamaz.

  Eskiden iki doğruluk hatası vardı:
   - D1: "eklendi" kayıttan ÖNCE yazılıyordu. Ardından başlık+yıl tekrarı
     diye atlanan kaynak da (DOI'siz girilmiş aynı yayın ya da aynı başlık
     ve yılı taşıyan ikinci bir DOI) "eklendi" görünüyordu. Artık
     "eklendi" yalnızca başarılı yazımdan sonra; başlık+yıl çakışması ayrı
     durum ("vardi_baslik") ve farklı DOI'ler sessizce birleştirilmiyor.
   - D2: kayıt düşünce yalnızca bir hata metni dönüyor, DOI başına sonuçlar
     kayboluyordu. Artık sonuçlar döner; yazılamayanlar "kaydedilemedi".
*/

export type DoiDurumu =
  /** Satır veritabanına yazıldı. */
  | "eklendi"
  /** Aynı DOI bu çalışmada zaten var: Crossref'e gidilmedi. */
  | "vardi"
  /** DOI farklı ama aynı başlık ve yıl bu çalışmada (ya da aynı listede) var: eklenmedi, birleştirilmedi. */
  | "vardi_baslik"
  /** Crossref'te kayıt yok ya da başlık yok. */
  | "bulunamadi"
  /** Crossref'e ulaşılamadı (5xx, zaman aşımı, ağ): yeniden denenebilir. */
  | "hata"
  /** Bu turda sorgulanmadı: saatlik hak doldu ya da süre bütçesi bitti. Yeniden denenebilir. */
  | "ertelendi"
  /** Crossref'ten geldi ama veritabanına yazılamadı. Yeniden denenebilir. */
  | "kaydedilemedi";

export type DoiSonucu = {
  doi: string;
  durum: DoiDurumu;
  baslik?: string;
  /** Yalnızca "ertelendi" için: hak mı doldu, süre mi bitti. */
  neden?: "hak" | "sure";
};

export type DoiHazirligi = {
  /** Geçerli, tekilleştirilmiş DOI'ler, kullanıcının sırasıyla. */
  sira: string[];
  /** Bu çalışmada aynı DOI'yle zaten olanlar (ağa gitmez). */
  vardi: string[];
  /** Crossref'e gidecek olanlar, sırayla. */
  aranacak: string[];
  /** DOI biçiminde olmayan girdi sayısı. */
  gecersiz: number;
  /** Listede ikinci kez geçen (büyük/küçük harf farkı dahil) DOI sayısı. */
  listedeTekrar: number;
};

/** DOI'nin tekrar anahtarı; lib/kaynak-aktarim'deki kaynakAnahtarlari ile aynı biçim. */
export const doiAnahtari = (doi: string) => `doi:${doi.toLowerCase()}`;

export function doiListesiniHazirla(girdiler: unknown, mevcutAnahtarlar: ReadonlySet<string>): DoiHazirligi {
  const liste = Array.isArray(girdiler) ? girdiler : [];
  const gorulen = new Set<string>();
  const sira: string[] = [];
  let gecersiz = 0;
  let listedeTekrar = 0;
  for (const ham of liste) {
    const doi = normalizeDoi(String(ham ?? ""));
    if (!doi) {
      gecersiz += 1;
      continue;
    }
    const kucuk = doi.toLowerCase();
    if (gorulen.has(kucuk)) {
      listedeTekrar += 1;
      continue;
    }
    gorulen.add(kucuk);
    sira.push(doi);
  }
  const vardi = sira.filter((doi) => mevcutAnahtarlar.has(doiAnahtari(doi)));
  const aranacak = sira.filter((doi) => !mevcutAnahtarlar.has(doiAnahtari(doi)));
  return { sira, vardi, aranacak, gecersiz, listedeTekrar };
}

/** Rezervasyona göre bölüş: ilk `verilen` DOI sorgulanır, kalanı ertelenir; sıra korunur. */
export function rezervasyonuBol(aranacak: readonly string[], verilen: number) {
  const n = Math.max(0, Math.min(aranacak.length, Math.floor(verilen)));
  return { islenecek: aranacak.slice(0, n), ertelenen: aranacak.slice(n) };
}

export type CekilenKayit = { doi: string; taslak: KaynakTaslagi };

/**
 * Crossref'ten gelenlerden hangisi yazılacak. DOI tekrarı zaten ayıklandı;
 * burada BAŞLIK+YIL çakışmasına bakılır: hem bu çalışmadaki kayıtlarla hem
 * aynı listede daha önce gelenle. Çakışan yazılmaz ve "vardi_baslik" olur
 * — iki farklı DOI tek kayda sessizce indirgenmez.
 */
export function kayitPlani(cekilenler: readonly CekilenKayit[], mevcutAnahtarlar: ReadonlySet<string>) {
  const anahtarlar = new Set(mevcutAnahtarlar);
  const yazilacak: CekilenKayit[] = [];
  const baslikCakisan: CekilenKayit[] = [];
  /* Crossref yapıştırılandan FARKLI (kanonik/takma ad) bir DOI döndürebilir
     ve o DOI çalışmada ya da listede daha önce olabilir: bu bir DOI
     eşleşmesidir, "aynı başlık ve yıl" değil (bağımsız inceleme). */
  const doiCakisan: CekilenKayit[] = [];
  for (const kayit of cekilenler) {
    const kendi = kaynakAnahtarlari(kayit.taslak);
    if (kendi.some((a) => a.startsWith("doi:") && anahtarlar.has(a))) {
      doiCakisan.push(kayit);
      continue;
    }
    if (kendi.some((a) => anahtarlar.has(a))) {
      baslikCakisan.push(kayit);
      continue;
    }
    kendi.forEach((a) => anahtarlar.add(a));
    yazilacak.push(kayit);
  }
  return { yazilacak, baslikCakisan, doiCakisan };
}

/** Yeniden denendiğinde sonucu değişebilecek durumlar (bulunamadı ve başlık çakışması değişmez). */
export const YENIDEN_DENENEBILIR: ReadonlySet<DoiDurumu> = new Set(["ertelendi", "hata", "kaydedilemedi"]);

/** Sonuçları kullanıcının yapıştırdığı sıraya göre diz. */
export function sirala(sonuclar: readonly DoiSonucu[], sira: readonly string[]): DoiSonucu[] {
  const yer = new Map(sira.map((doi, i) => [doi, i]));
  return [...sonuclar].sort((a, b) => (yer.get(a.doi) ?? 0) - (yer.get(b.doi) ?? 0));
}

export type DoiOzeti = {
  /** Crossref'e gitmesi gereken DOI sayısı (bütçe istenen). */
  istenen: number;
  /** Sayacın verdiği hak (rezervasyon). */
  rezerve: number;
  /** Gerçekten Crossref'e gönderilen istek sayısı. */
  sorgulanan: number;
  /** Rezerve edilip süre bütçesi yüzünden kullanılamayan hak (iade edilmez). */
  kullanilmayan: number;
  /** Bu turda sorgulanmayan DOI sayısı. */
  ertelenen: number;
  /** Sayaç çalıştıysa kalan saatlik hak; çalışmadıysa null. */
  kalanHak: number | null;
  /** Pencerenin yenileneceği an (ISO); bilinmiyorsa null. */
  yenilenme: string | null;
  /** Sayaç kurulamadı/okunamadı: bu turda sınır uygulanmadı. */
  sayacsiz: boolean;
  gecersiz: number;
  listedeTekrar: number;
};

/**
 * Pencerenin yenileneceği saat, kullanıcının tarayıcısının saatiyle
 * ("14:32"). İstemcide çağrılır: hak bitince "… saatinde yenilenir" yazmak
 * için. Okunamayan değer null.
 */
export function yenilenmeSaati(iso: string | null | undefined, yerel: string): string | null {
  if (!iso) return null;
  const an = new Date(iso);
  if (Number.isNaN(an.getTime())) return null;
  return an.toLocaleTimeString(yerel, { hour: "2-digit", minute: "2-digit" });
}
