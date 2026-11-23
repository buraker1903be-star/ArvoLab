/*
  DENETİMİN KAPSAMI (23.11.2026): bir stilde HANGİ kontrollerin
  uygulanabildiği.

  Neden gerekli: "sorun bulunmadı" iki ayrı şeyin aynı cümlesi oldu.
  Yerleşik bir stilde (APA 7, Vancouver) künyenin biçimi gerçekten
  denetleniyor; CSL deposundan seçilen bir dergi stilinde künyeyi
  citeproc yazdığı için biçim HİÇ denetlenmiyor (lib/atif/stiller.ts,
  `yazarBicimi: null`) — orada "sorun yok", "bakmadım" demek. Kullanıcı
  ikisini sonuçtan ayırt edemiyordu; bu, denetlemediği hâlde temiz
  görünen bir rapordur, ArvoLab'ın en çok kaçındığı hata.

  Üç durum birbirinin yerine geçmez (AGENTS.md "Kanıt durumları"):
    uygulandi     — kontrol çalıştı, sonucu bulgularda.
    gerekmiyor    — bu stilde böyle bir kural yok (numara stilinde
                    alfabetik sıra, yazar-tarih stilinde künye numarası).
    uygulanamadi  — kural var ama ArvoLab bakamadı (stilin biçim kuralları
                    yazılı değil, ya da metin verilmediği için çapraz
                    kontrol yapılamadı).

  Saf modül; testi tests/unit/atif-denetim-kapsami.test.ts.
*/

import type { Metin } from "@/lib/dil";
import { adlaEslesir, type StilTanimi } from "./stiller";

export type KapsamAnahtari =
  | "yazarBicimi"
  | "yil"
  | "baslik"
  | "numaralandirma"
  | "atifEslesmesi"
  | "dipnotAtiflari"
  | "atifNoktalamasi";

export type KapsamDurumu = "uygulandi" | "gerekmiyor" | "uygulanamadi";

export type KapsamSatiri = {
  anahtar: KapsamAnahtari;
  durum: KapsamDurumu;
  /** Yalnızca "gerekmiyor" ve "uygulanamadi" için: sebebi. */
  gerekce: Metin | null;
};

export const KAPSAM_ADI: Record<KapsamAnahtari, Metin> = {
  yazarBicimi: { tr: "Yazar biçimi", en: "Author format" },
  yil: { tr: "Yayın yılı", en: "Publication year" },
  baslik: { tr: "Başlık ve noktalama", en: "Title and punctuation" },
  numaralandirma: { tr: "Künye numaraları", en: "Reference numbering" },
  atifEslesmesi: { tr: "Metin–kaynakça eşleşmesi", en: "Text–reference matching" },
  dipnotAtiflari: { tr: "Dipnottaki atıflar", en: "Citations in footnotes" },
  atifNoktalamasi: { tr: "Atıf noktalaması", en: "Citation punctuation" },
};

/**
 * Stilin ve elimizdeki girdinin belirlediği kapsam.
 *
 * `metinVar`: gövde metni verildi mi. Verilmediyse metne bakan hiçbir
 * kontrol "uygulandı" sayılmaz — kullanıcı o soruyu hiç sormamış oldu.
 */
export function denetimKapsami(stil: StilTanimi, { metinVar }: { metinVar: boolean }): KapsamSatiri[] {
  const satir = (anahtar: KapsamAnahtari, durum: KapsamDurumu, gerekce: Metin | null = null): KapsamSatiri => ({
    anahtar,
    durum,
    gerekce: durum === "uygulandi" ? null : gerekce,
  });

  const METIN_YOK: Metin = {
    tr: "Metin verilmedi; bu kontrol metin olmadan yapılamaz.",
    en: "No text was provided; this check cannot run without the text.",
  };
  const BICIM_YAZILI_DEGIL: Metin = {
    tr: "Bu stilin künye kuralları ArvoLab'da yazılı değil; künyeyi stilin kendi biçimleyicisi yazıyor. Biçim denetlenmedi.",
    en: "This style's reference rules are not written into ArvoLab; the style's own formatter writes the reference. The format was not checked.",
  };

  return [
    stil.yazarBicimi
      ? satir("yazarBicimi", "uygulandi")
      : satir("yazarBicimi", "uygulanamadi", BICIM_YAZILI_DEGIL),

    /* Yıl her ayrıştırıcıda aranıyor; "esnek" yerleşiminde yalnızca
       varlığı (yeri dergiye göre değişiyor, kural koymak yanlış alarm). */
    satir("yil", "uygulandi"),

    /*
      Başlık, yılı parantezden ya da yazardan sonradan okuyan yolda
      noktalamayla bulunuyor. CSL yazar-tarih stillerinde yıl nerede
      olursa kabul edildiği için başlık hiç aranmıyor
      (lib/atif/kunye.ts, esnekAyristir).
    */
    stil.tur === "yazar-tarih" && stil.yilYeri === "esnek"
      ? satir("baslik", "uygulanamadi", BICIM_YAZILI_DEGIL)
      : satir("baslik", "uygulandi"),

    stil.tur === "numara"
      ? satir("numaralandirma", "uygulandi")
      : satir("numaralandirma", "gerekmiyor", {
          tr: "Bu stilde kaynaklar numaralanmaz; kaynakça alfabetik sırayla yazılır.",
          en: "In this style references are not numbered; the reference list is alphabetical.",
        }),

    !adlaEslesir(stil)
      ? satir("atifEslesmesi", "gerekmiyor", {
          tr: "Numara stilinde atıf künyeyle adla değil SIRAYLA eşleşir; eşleşme künye numaralarından denetlenir.",
          en: "In a numbered style a citation matches its reference by ORDER, not by name; matching is checked through the reference numbers.",
        })
      : metinVar
        ? satir("atifEslesmesi", "uygulandi")
        : satir("atifEslesmesi", "uygulanamadi", METIN_YOK),

    stil.tur !== "dipnot"
      ? satir("dipnotAtiflari", "gerekmiyor", {
          tr: "Bu stilde atıflar metnin içinde yer alır, dipnotta değil.",
          en: "In this style citations appear in the text, not in footnotes.",
        })
      : metinVar
        ? satir("dipnotAtiflari", "uygulandi")
        : satir("dipnotAtiflari", "uygulanamadi", METIN_YOK),

    /* Kılavuz örneğinin noktalaması ve yılsız atıf (lib/atif/tyk.ts):
       yalnızca yazar–tarih stillerinde anlamlı. */
    stil.tur !== "yazar-tarih"
      ? satir("atifNoktalamasi", "gerekmiyor", {
          tr: "Atıf noktalaması kuralı yazar–tarih stillerinde denetlenir.",
          en: "The citation punctuation rule is checked in author–date styles.",
        })
      : metinVar
        ? satir("atifNoktalamasi", "uygulandi")
        : satir("atifNoktalamasi", "uygulanamadi", METIN_YOK),
  ];
}

/** Uygulanamayan bir kontrol var mı — sonuç "kısmi" damgası taşımalı mı. */
export const kapsamKismiMi = (satirlar: KapsamSatiri[]) => satirlar.some((s) => s.durum === "uygulanamadi");

/** Gerçekten çalışan kontroller; sonuç ekranı bunları "uygulandı" diye yazar. */
export const uygulananlar = (satirlar: KapsamSatiri[]) => satirlar.filter((s) => s.durum === "uygulandi");

/** Kural var ama bakılamadı; sonuç ekranı bunları sebebiyle yazar. */
export const uygulanamayanlar = (satirlar: KapsamSatiri[]) => satirlar.filter((s) => s.durum === "uygulanamadi");
