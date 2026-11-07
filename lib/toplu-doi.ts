import { doiAnahtari, normalizeDoi, type DoiMetadata } from "@/lib/doi";
import { DOI_SORGU_MESAJI, type CrossrefSonucu } from "@/lib/doi-sorgu";
import { KOTA_DENETLENEMEDI, KOTA_DOLDU, type KotaKarari } from "@/lib/dizin-kotasi-kurali";
import type { Metin } from "@/lib/dil";

/*
  TOPLU DOI — SIRA, KOTA VE RAPOR (DOI kotası, 07.11.2026). Saf:
  kütüphane, sayaç ve Crossref dışarıdan verilir; her dal
  tests/unit/toplu-doi.test.ts'te. Sunucu tarafı app/actions/kaynak-aktarim.ts
  → doiIleEkle.

  • Aynı işlemde tekrar eden DOI'ler (farklı yazım, büyük/küçük harf)
    TEK DOI sayılır: ikinci kez sorulmaz, hak düşürmez.
  • Kütüphanede (çalışmanın kapsamında) olan DOI dışarı sorulmaz, hak
    düşürmez, "vardı" raporlanır. Bu denetim kota durumundan bağımsız
    olarak HEPSİNE yapılır: hak bitse de kütüphanedekiler "işlenmedi"
    değil "vardı" görünür.
  • Dışarı gidecek her DOI için hak İSTEKTEN ÖNCE düşer; başarısız
    istek (404, 429, 5xx, zaman aşımı) de hakkı tüketmiş olur.
  • Hak doldu ya da denetlenemedi → yeni istek başlamaz. Hakkı zaten
    düşmüş, yoldaki istekler tamamlanır; kalanlar "islenmedi" ve
    nedeniyle raporlanır. Var olan kaynaklara dokunulmaz.

  Eskiden doiIleEkle hiç saymıyordu: 50 DOI'lik bir liste Kaynaklar
  aramasının saatlik 60 hakkını aşan dış isteği hak düşmeden yapıyordu.
*/

export type TopluDoiNeden = "kota" | "kota_denetlenemedi" | "dis_servis_yogun" | "dis_servis_hatasi" | "zaman_asimi";

export type TopluDoiSatiri =
  | { doi: string; durum: "vardi" }
  | { doi: string; durum: "getirildi"; metadata: DoiMetadata }
  | { doi: string; durum: "bulunamadi" }
  | { doi: string; durum: "hata"; neden: Exclude<TopluDoiNeden, "kota" | "kota_denetlenemedi"> }
  | { doi: string; durum: "islenmedi"; neden: "kota" | "kota_denetlenemedi" };

/** Girdiyi DOI'lere çevirir: geçersizler ve aynı işlemdeki tekrarlar ayrı sayılır. */
export function topluDoiAyikla(girdi: unknown): { doilar: string[]; tekrar: number; gecersiz: number } {
  const gorulen = new Set<string>();
  const doilar: string[] = [];
  let tekrar = 0;
  let gecersiz = 0;
  for (const ham of Array.isArray(girdi) ? girdi : []) {
    const doi = typeof ham === "string" ? normalizeDoi(ham) : null;
    if (!doi) {
      gecersiz++;
      continue;
    }
    const anahtar = doiAnahtari(doi)!;
    if (gorulen.has(anahtar)) {
      tekrar++;
      continue;
    }
    gorulen.add(anahtar);
    doilar.push(doi);
  }
  return { doilar, tekrar, gecersiz };
}

export interface TopluDoiBaglami {
  /** DOI anahtarı (küçük harf) kapsamda var mı. */
  kutuphanede(anahtar: string): boolean;
  hakDus(): Promise<KotaKarari>;
  crossref(doi: string): Promise<CrossrefSonucu>;
}

export async function topluDoiGetir(
  doilar: string[],
  b: TopluDoiBaglami,
  esZamanli = 5,
): Promise<{ satirlar: TopluDoiSatiri[]; durdu: "kota" | "kota_denetlenemedi" | null; disSorgu: number }> {
  const satirlar = new Map<string, TopluDoiSatiri>();
  const kuyruk: string[] = [];
  for (const doi of doilar) {
    if (b.kutuphanede(doiAnahtari(doi)!)) satirlar.set(doi, { doi, durum: "vardi" });
    else kuyruk.push(doi);
  }

  let durdu: "kota" | "kota_denetlenemedi" | null = null;
  let disSorgu = 0;
  let sira = 0;
  const isci = async () => {
    while (!durdu && sira < kuyruk.length) {
      const doi = kuyruk[sira++];
      const kota = await b.hakDus();
      if (kota.tur !== "izin") {
        /* Bu DOI de sorulmadı: aşağıda öteki sorulmayanlarla "islenmedi". */
        durdu ??= kota.tur === "doldu" ? "kota" : "kota_denetlenemedi";
        break;
      }
      disSorgu++;
      const c = await b.crossref(doi);
      satirlar.set(doi, crossrefSatiri(doi, c));
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(esZamanli, kuyruk.length)) }, isci));

  /* Sorulmadan kalanlar: kota durdurdu. */
  for (const doi of kuyruk) {
    if (!satirlar.has(doi)) satirlar.set(doi, { doi, durum: "islenmedi", neden: durdu ?? "kota" });
  }
  /* Kullanıcının yapıştırdığı sırayla. */
  return { satirlar: doilar.map((d) => satirlar.get(d)!), durdu, disSorgu };
}

function crossrefSatiri(doi: string, c: CrossrefSonucu): TopluDoiSatiri {
  switch (c.tur) {
    case "tamam":
      return { doi, durum: "getirildi", metadata: c.metadata };
    case "bulunamadi":
      return { doi, durum: "bulunamadi" };
    case "yogun":
      return { doi, durum: "hata", neden: "dis_servis_yogun" };
    case "hata":
      return { doi, durum: "hata", neden: "dis_servis_hatasi" };
    default:
      return { doi, durum: "hata", neden: "zaman_asimi" };
  }
}

/** Nedenin kullanıcıya tam mesajı (tek DOI kutusu): kota, 429, Crossref hatası ve zaman aşımı ayrı. */
export function topluDoiNedenMesaji(neden: TopluDoiNeden): Metin {
  return neden === "kota" ? KOTA_DOLDU : neden === "kota_denetlenemedi" ? KOTA_DENETLENEMEDI : DOI_SORGU_MESAJI[neden];
}
