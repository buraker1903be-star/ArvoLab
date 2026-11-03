import DIZIN from "./csl-dizini.json";
import { cslKimligi, type CslKodu } from "./csl-kimlik";

/*
  CSL STİL DİZİNİ (03.11.2026). lib/atif/csl-dizini.json, CSL deposunun
  bir kopyasından üretildi: [ad, başlık, kod] ya da bağımlı stilde
  [ad, başlık, kod, ebeveyn]. Kod stilin atıf biçimi (lib/atif/csl-kimlik.ts)
  ve citeproc ile ÇİZİLEREK okundu: XML'de köşeli parantez stilden stile
  farklı yerde (layout öneki, group, text öğesi) yazılıyor, çizilmiş atfa
  bakmak bunların hepsini aynı ölçüte indiriyor.

  ~1 MB; yalnızca sunucuda (app/actions/csl.ts) içe aktarılır, istemci
  pakete girmez.
*/

type Satir = [string, string, CslKodu, string?];
const SATIRLAR = DIZIN as Satir[];

const sade = (metin: string) =>
  metin.toLocaleLowerCase("tr-TR").normalize("NFD").replace(/\p{M}+/gu, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

const ARAMA = SATIRLAR.map((s) => ({ s, metin: ` ${sade(`${s[1]} ${s[0].replace(/-/g, " ")}`)} ` }));
const KONUM = new Map(SATIRLAR.map((s) => [s[0], s]));

export type CslSecenegi = { deger: string; ad: string; kod: CslKodu };

const secenek = (s: Satir): CslSecenegi => ({ deger: cslKimligi(s[2], s[0]), ad: s[1], kod: s[2] });

/**
 * Başlıkta ve dosya adında bütün sözcükleri geçen stiller. Sıra: başlığı
 * sorguyla başlayan önce, sonra kısa başlık (genel stil "Nature",
 * "Nature Genetics"tan önce gelsin).
 */
export function cslAra(sorgu: string, sinir = 30): CslSecenegi[] {
  const sozcukler = sade(sorgu).split(" ").filter(Boolean);
  if (!sozcukler.length) return [];
  const bas = ` ${sozcukler.join(" ")}`;
  const tamAd = sozcukler.join("-");
  return ARAMA.filter((a) => sozcukler.every((w) => a.metin.includes(` ${w}`)))
    // Dosya adının kendisi ("ieee", "apa") en önde; eşit başlıkta kısa dosya adı önce: "american-medical-association" (güncel) "…-10th-edition"dan önce.
    .map((a) => ({ a, puan: (a.s[0] === tamAd ? -1000 : a.metin.startsWith(bas) ? 0 : 1000) + a.s[1].length + a.s[0].length / 1000 }))
    .sort((x, y) => x.puan - y.puan)
    .slice(0, sinir)
    .map(({ a }) => secenek(a.s));
}

/** Kayıtlı bir kimliğin dizindeki karşılığı; kod uyuşmuyorsa (elle yazılmış kimlik) null. */
export function cslBul(ad: string, kod: CslKodu): CslSecenegi | null {
  const s = KONUM.get(ad);
  return s && s[2] === kod ? secenek(s) : null;
}

export const CSL_STIL_SAYISI = SATIRLAR.length;
