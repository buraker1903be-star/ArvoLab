/*
  Alıntı, incelenen kaynak metninde geçiyor mu?

  Kanıt zincirinin en kritik halkası: "ilgili kanıt bulundu" yalnızca
  kaynaktaki metinden alınmış bir parça gösterilebiliyorsa söylenebilir.
  Dil modeli "kaynakta şöyle yazıyor" diyebilir ve yazmıyor olabilir;
  bunu kullanıcı ancak kaynağı açıp arayarak anlar. Burada dizgi olarak
  bakılıyor: geçmiyorsa kanıt değildir.

  Normalleştirme veritabanındaki public.kanit_metni_normallestir ile
  BİREBİR aynı adımlar ve aynı sıra (migration 20261026065320). İkisi
  ayrışırsa uygulamanın kabul ettiği alıntıyı veritabanı reddeder ya da
  tersi; tests/db/kanit-zinciri.test.mjs ikisini aynı örneklerle sınar.

  Yalnızca dizgi biçimi eşitlenir, anlam değil: PDF'ten kopyalanan
  metindeki satır sonu tirelemesi, kıvrık tırnak, uzun tire ve yumuşak
  tire. Büyük/küçük harf KORUNUR — harfi değiştirilmiş alıntı doğrudan
  alıntı değildir.

  Saf modül; testi tests/unit/kanit-alinti.test.ts.
*/

/** Bundan kısa bir parça "kanıt" sayılmaz: "the" ya da "ve" her metinde geçer. */
export const ALINTI_EN_AZ = 20;
export const ALINTI_EN_COK = 1000;

export function kanitMetniNormallestir(metin: string): string {
  return (metin ?? "")
    .normalize("NFC")
    .replace(/\u00ad/g, "")
    .replace(/[\u2018\u2019\u201a\u201b]/g, "'")
    .replace(/[\u201c\u201d\u201e\u201f]/g, '"')
    .replace(/[\u2010\u2011\u2013\u2014\u2015]/g, "-")
    .replace(/[\u00a0\u2007\u2009\u202f]/g, " ")
    .replace(/-[ \t]*\r?\n[ \t]*/g, "")
    .replace(/[ \t\r\n\f\v]+/g, " ")
    // trim() değil: Unicode boşluklarını da siler, Postgres'in btrim'i yalnızca boşluğu.
    .replace(/^ +| +$/g, "");
}

export type AlintiSonucu =
  | { gecti: true }
  | { gecti: false; neden: "bos" | "kisa" | "uzun" | "metinde_yok" | "metin_yok" };

/** Alıntı incelenen metinde (normalleştirilmiş olarak) geçiyor mu? */
export function alintiDenetle(alinti: string | null | undefined, metin: string | null | undefined): AlintiSonucu {
  const a = kanitMetniNormallestir(alinti ?? "");
  if (!a) return { gecti: false, neden: "bos" };
  const m = kanitMetniNormallestir(metin ?? "");
  if (!m) return { gecti: false, neden: "metin_yok" };
  if (a.length < ALINTI_EN_AZ) return { gecti: false, neden: "kisa" };
  if (a.length > ALINTI_EN_COK) return { gecti: false, neden: "uzun" };
  return m.includes(a) ? { gecti: true } : { gecti: false, neden: "metinde_yok" };
}

export const ALINTI_HATASI: Record<Exclude<AlintiSonucu, { gecti: true }>["neden"], string> = {
  bos: "Alıntı boş.",
  kisa: `Alıntı en az ${ALINTI_EN_AZ} karakter olmalı; çok kısa bir parça her metinde geçebilir.`,
  uzun: `Alıntı en fazla ${ALINTI_EN_COK} karakter olabilir; kanıt için ilgili cümleyi seçin.`,
  metinde_yok: "Alıntı incelenen metinde geçmiyor. Kanıt olarak yalnızca kaynaktaki metin kaydedilebilir.",
  metin_yok: "Önce kaynaktan incelenen metni ekleyin; alıntı o metnin içinden seçilir.",
};
