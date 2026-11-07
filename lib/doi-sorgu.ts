import { CROSSREF_USER_AGENT, crossrefWorkUrl, doiAnahtari, normalizeDoi, parseCrossrefWork, type DoiMetadata } from "@/lib/doi";
import type { KotaKarari } from "@/lib/dizin-kotasi-kurali";
import type { Metin } from "@/lib/dil";

/*
  DOI SORGUSU — SIRA VE SINIFLANDIRMA (DOI kotası, 07.11.2026). Saf:
  bağımlılıklar (kütüphane, abonelik, sayaç, Crossref) dışarıdan verilir,
  böylece her dal tests/unit/doi-sorgu.test.ts'te sınanır. Sunucu tarafı
  app/actions/literature.ts → lookupDoi.

  Sıra BİLEREK böyle (ucuzdan pahalıya, hak yalnızca dışarı gidecekse):
    1. DOI biçimi       — geçersizse dur. Hak YOK, dış istek YOK.
    2. Çalışma yetkisi  — istenen çalışma kullanıcının değilse dur. Hak YOK.
                          Kütüphane okuması da yapılmaz: başka birinin
                          çalışması üzerinden kütüphane yoklanamaz.
    3. Kütüphane        — DOI kullanıcının kapsamında (çalışma ya da genel
                          kütüphane, lib/kaynak-kapsami.ts) varsa künye
                          oradan döner. Hak YOK, dış istek YOK, abonelik
                          sorulmaz (dış maliyet yok). Okunamazsa sorgu
                          dışarıya devam eder (bu bir engel değil, tasarruf).
    4. Abonelik         — kapalıysa dur (sunucuda; arayüze güvenilmez).
    5. Sayaç            — hak doldu / denetlenemedi ise dur.
    6. Crossref         — gönderildi: sonucu ne olursa olsun hak düşmüştür.
*/

export type CrossrefSonucu =
  | { tur: "tamam"; metadata: DoiMetadata }
  | { tur: "bulunamadi" }
  | { tur: "yogun" }
  | { tur: "hata"; durum: number }
  | { tur: "zaman_asimi" }
  | { tur: "baglanti" };

type Getir = (adres: string, secenek: RequestInit) => Promise<Pick<Response, "status" | "ok" | "json">>;

/** Crossref works isteği ve cevabın sınıflandırılması (lookupDoi ve toplu DOI aynı fonksiyonu kullanır). */
export async function crossrefKunyesi(doi: string, getir: Getir = fetch, zamanAsimiMs = 8000): Promise<CrossrefSonucu> {
  let yanit: Awaited<ReturnType<Getir>>;
  try {
    yanit = await getir(crossrefWorkUrl(doi), {
      headers: { "User-Agent": CROSSREF_USER_AGENT },
      signal: AbortSignal.timeout(zamanAsimiMs),
      cache: "no-store",
    });
  } catch (hata) {
    const ad = (hata as { name?: string } | null)?.name;
    return ad === "TimeoutError" || ad === "AbortError" ? { tur: "zaman_asimi" } : { tur: "baglanti" };
  }
  if (yanit.status === 404) return { tur: "bulunamadi" };
  if (yanit.status === 429) return { tur: "yogun" };
  if (!yanit.ok) return { tur: "hata", durum: yanit.status };
  try {
    const govde = (await yanit.json()) as { message?: unknown };
    const metadata = parseCrossrefWork(govde?.message as Parameters<typeof parseCrossrefWork>[0], doi);
    return metadata ? { tur: "tamam", metadata } : { tur: "bulunamadi" };
  } catch {
    return { tur: "hata", durum: yanit.status };
  }
}

export type DoiSorguHatasi =
  | "gecersiz"
  | "yetkisiz"
  | "calisma_okunamadi"
  | "abonelik"
  | "kota"
  | "kota_denetlenemedi"
  | "bulunamadi"
  | "dis_servis_yogun"
  | "dis_servis_hatasi"
  | "zaman_asimi";

export type DoiSorguSonucu =
  | { tur: "tamam"; metadata: DoiMetadata; kaynak: "kutuphane" | "crossref" }
  | { tur: "hata"; hata: DoiSorguHatasi };

export interface DoiSorguBaglami {
  /** İstenen çalışma kullanıcının mı (çalışma verilmediyse true). */
  calismaYetkisi(): Promise<"tamam" | "yetkisiz" | "okunamadi">;
  /** Kapsamda bu DOI anahtarlı kaynak varsa künyesi; yoksa ya da okunamazsa null. */
  kutuphanedeBul(anahtar: string): Promise<DoiMetadata | null>;
  abonelikKapali(): Promise<boolean>;
  hakDus(): Promise<KotaKarari>;
  crossref(doi: string): Promise<CrossrefSonucu>;
}

export async function doiSorgula(girdi: unknown, b: DoiSorguBaglami): Promise<DoiSorguSonucu> {
  const doi = typeof girdi === "string" ? normalizeDoi(girdi) : null;
  if (!doi) return { tur: "hata", hata: "gecersiz" };
  const yetki = await b.calismaYetkisi();
  if (yetki === "yetkisiz") return { tur: "hata", hata: "yetkisiz" };
  if (yetki === "okunamadi") return { tur: "hata", hata: "calisma_okunamadi" };
  const mevcut = await b.kutuphanedeBul(doiAnahtari(doi)!);
  if (mevcut) return { tur: "tamam", metadata: mevcut, kaynak: "kutuphane" };
  if (await b.abonelikKapali()) return { tur: "hata", hata: "abonelik" };
  const kota = await b.hakDus();
  if (kota.tur === "doldu") return { tur: "hata", hata: "kota" };
  if (kota.tur === "denetlenemedi") return { tur: "hata", hata: "kota_denetlenemedi" };
  const c = await b.crossref(doi);
  switch (c.tur) {
    case "tamam":
      return { tur: "tamam", metadata: c.metadata, kaynak: "crossref" };
    case "bulunamadi":
      return { tur: "hata", hata: "bulunamadi" };
    case "yogun":
      return { tur: "hata", hata: "dis_servis_yogun" };
    case "hata":
      return { tur: "hata", hata: "dis_servis_hatasi" };
    default:
      return { tur: "hata", hata: "zaman_asimi" };
  }
}

/* Kullanıcıya birbirinden ayırt edilebilir mesajlar. "abonelik" ve
   "kota*" metinleri çağıranda (lib/access.ts ve lib/dizin-kotasi-kurali.ts);
   burada yalnızca DOI ve dış servise özgü olanlar. */
export const DOI_SORGU_MESAJI: Record<Exclude<DoiSorguHatasi, "abonelik" | "kota" | "kota_denetlenemedi">, Metin> = {
  gecersiz: { tr: "Geçerli bir DOI girin (ör. 10.1000/xyz123 ya da https://doi.org/…).", en: "Enter a valid DOI (e.g. 10.1000/xyz123 or https://doi.org/…)." },
  yetkisiz: { tr: "Bu çalışma için DOI sorgulanamıyor: çalışma bulunamadı ya da size ait değil.", en: "A DOI can't be looked up for this work: it wasn't found or it isn't yours." },
  calisma_okunamadi: { tr: "Çalışma bilgisi okunamadı; DOI sorgulanmadı. Birazdan yeniden deneyin.", en: "Couldn't read the work; the DOI wasn't looked up. Please try again shortly." },
  bulunamadi: { tr: "Bu DOI Crossref kayıtlarında bulunamadı.", en: "This DOI wasn't found in Crossref." },
  dis_servis_yogun: { tr: "Crossref şu an çok yoğun ve isteği geri çevirdi; birazdan yeniden deneyin. Bilgileri elle de girebilirsiniz.", en: "Crossref is busy and turned the request down; please try again shortly. You can also enter the details manually." },
  dis_servis_hatasi: { tr: "Kaynak bilgileri şu an alınamadı (Crossref hatası); birazdan yeniden deneyin. Bilgileri elle de girebilirsiniz.", en: "Couldn't fetch source details right now (Crossref error); please try again shortly. You can also enter them manually." },
  zaman_asimi: { tr: "Crossref'e ulaşılamadı (zaman aşımı ya da bağlantı hatası). Bilgileri elle de girebilirsiniz.", en: "Couldn't reach Crossref (timeout or connection error). You can also enter the details manually." },
};
