import { doiAnahtari, metindekiDoiler, normalizeDoi } from "@/lib/doi";
import { kaynakAnahtarlari } from "@/lib/kaynak-aktarim";
import type { Metin } from "@/lib/dil";

/*
  KAYNAK EKLEME KARARI (A1, 07.11.2026). Saf: Next, React ve Supabase'e
  dokunmaz (tests/unit/kaynak-ekleme.test.ts). Kaynak ekleyen her sunucu
  işlemi tekrar ve DOI kararını buradan alır; eskiden her yol kendi kuralını
  yazıyordu ve dört yolda dört davranış vardı (A1 denetimi):
    • içe aktarma ve DOI listesi tekrarı atlıyordu,
    • elle ekleme yalnızca uyarıyor, aynı DOI'yi yine ekliyordu,
    • atıf penceresi (createCitationSource) hiç denetlemiyordu,
    • arama sonucundan ekleme (aramaKaydiniEkle) hiç denetlemiyor ve
      istemciden gelen DOI'yi doğrulamadan "https://doi.org/<değer>" diye
      yazıyordu.

  ÜRÜN KARARLARI (docs/karar-kaynak-atif-mimarisi.md):
    K2  Çalışmaya bağlı kaynakta aynı DOI aynı çalışmada ikinci kez
        eklenmez.
    K6  Çalışmaya bağlı OLMAYAN kaynakta kapsam kullanıcının genel
        kütüphanesidir (project_id boş olan kendi kaynakları). Farklı
        kullanıcıların kaynakları birbirini etkilemez.
  Kapsamın SORGUSU (kimin hangi satırları) lib/kaynak-kapsami.ts'te; burada
  yalnızca verilen satırlar üzerinden karar verilir.

  DOI tekrarı ENGELDİR; yalnızca başlık + yıl eşleşmesi UYARIDIR: DOI kesin
  bir kimlik, başlık + yıl değil (aynı kitabın başka baskısı meşru bir
  ikinci kayıt olabilir).
*/

export type MevcutKaynak = { id: string; title: string; year: string | null; doi_or_url: string | null };
export type YeniKaynak = { title: string; year: string | null; doi_or_url: string | null };

export type TekrarSonucu =
  | { tur: "yok" }
  /** Aynı DOI: eklenmez. */
  | { tur: "doi"; mevcut: MevcutKaynak }
  /** Yalnızca başlık + yıl: eklenir, kullanıcı uyarılır. */
  | { tur: "baslik"; mevcut: MevcutKaynak };

/** doi_or_url alanının DOI anahtarı (tekrar anahtarıyla aynı kural: lib/kaynak-aktarim.ts). */
export function kaynakDoiAnahtari(doiOrUrl: string | null | undefined): string | null {
  const ham = (doiOrUrl ?? "").trim();
  return ham ? (doiAnahtari(ham) ?? metindekiDoiler(ham)[0]?.toLowerCase() ?? null) : null;
}

/** Yeni kaydın kapsamdaki kayıtlarla tekrarı. DOI eşleşmesi başlık eşleşmesinden önce gelir. */
export function tekrarBul(yeni: YeniKaynak, mevcutlar: readonly MevcutKaynak[]): TekrarSonucu {
  const doi = kaynakDoiAnahtari(yeni.doi_or_url);
  if (doi) {
    const ayni = mevcutlar.find((k) => kaynakDoiAnahtari(k.doi_or_url) === doi);
    if (ayni) return { tur: "doi", mevcut: ayni };
  }
  // Başlıksız kayıt ("b::yıl") tekrar sayılmaz: her başlıksız kayıt birbirine eşit görünürdü.
  const baslikAnahtari = kaynakAnahtarlari(yeni).find((a) => a.startsWith("b:") && !a.startsWith("b::"));
  if (baslikAnahtari) {
    const ayni = mevcutlar.find((k) => kaynakAnahtarlari(k).includes(baslikAnahtari));
    if (ayni) return { tur: "baslik", mevcut: ayni };
  }
  return { tur: "yok" };
}

/**
 * Dışarıdan (dizin araması, istemci) gelen DOI. Geçerliyse normal biçim,
 * değilse null — doğrulanmamış değer "https://doi.org/<değer>" diye
 * kaydedilmez.
 */
export function guvenliDoi(ham: unknown): string | null {
  return typeof ham === "string" && ham.trim() ? normalizeDoi(ham) : null;
}

/** Tekrarın kullanıcıya söylenişi: kapsam çalışma mı genel kütüphane mi. */
export function doiTekrariMesaji(calismaVar: boolean, baslik: string): Metin {
  const ad = baslik.length > 120 ? `${baslik.slice(0, 117)}…` : baslik;
  return calismaVar
    ? { tr: `Bu DOI bu çalışmada zaten var: “${ad}”. Kaynak yeniden eklenmedi.`, en: `This DOI is already in this work: “${ad}”. The source wasn't added again.` }
    : { tr: `Bu DOI genel kütüphanenizde zaten var: “${ad}”. Kaynak yeniden eklenmedi.`, en: `This DOI is already in your general library: “${ad}”. The source wasn't added again.` };
}

/** Tekrar denetimi yapılamadı (kapsam okunamadı): ekleme yapılmaz. Engelin sorgusu hata yutmaz. */
export const TEKRAR_DENETLENEMEDI: Metin = {
  tr: "Mevcut kaynaklarınız okunamadı; aynı DOI'nin tekrarı denetlenemediği için kaynak eklenmedi. Birazdan yeniden deneyin.",
  en: "Couldn't read your existing sources; the source wasn't added because a duplicate DOI couldn't be ruled out. Please try again shortly.",
};
