/*
  PDF'TE DOĞRULANMIŞ PASAJIN VURGUSU (19.11.2026, K3-A "Dayanağa git").
  Saf modül; testi tests/unit/pdf-pasaj.test.ts.

  Vurgu YALNIZCA pasaj sayfanın metninde bütünüyle bulunursa yapılır:
  sayfanın metin parçaları (pdf.js metin katmanı) boşluksuz ve küçük harfle
  birleştirilir, pasaj aynı biçimde aranır, kapsadığı parçaların sırası
  döner. Bulunamazsa null: hiçbir şey işaretlenmez — yanlış pasajı
  işaretlemek, hiç işaretlememekten kötüdür. Parça düzeyinde "içinde geçen
  her kelimeyi boya" yapılmaz: kısa bir kelime sayfanın başka yerinde de
  geçer ve okuyanı yanıltır.
*/
import { kanitMetniNormallestir } from "@/lib/kanit/alinti";

/*
  Tireler de atılır (20.11.2026). Eskiden yalnızca boşluk atılıyordu: gerçek
  makalelerde satır sonu tirelemesi metin katmanında "com-" + "pile" diye
  iki parça kalıyor, sunucunun doğruladığı pasaj ise "compile" taşıyor;
  pasaj bulunamıyor ve ne "Dayanağa git" vurgusu ne kalıcı işaret
  çiziliyordu (iki sütunlu PLDI 2009 makalesinde ölçüldü). İki taraftan da
  atıldığı için "state-of-the-art" gibi gerçek tireli sözcükler de eşleşir.
*/
const sikistir = (metin: string) => kanitMetniNormallestir(metin).toLocaleLowerCase("tr").replace(/[\s\-\u00ad\u2010\u2011]+/g, "");

/** Pasajın kapsadığı parça sıraları (yoksa null). En az 12 anlamlı karakter ister. */
export function pasajParcalari(parcalar: string[], pasaj: string): number[] | null {
  const hedef = sikistir(pasaj);
  if (hedef.length < 12) return null;
  let birlesik = "";
  const sinirlar: { bas: number; bit: number }[] = [];
  for (const parca of parcalar) {
    const s = sikistir(parca);
    sinirlar.push({ bas: birlesik.length, bit: birlesik.length + s.length });
    birlesik += s;
  }
  const yer = birlesik.indexOf(hedef);
  if (yer < 0) return null;
  const son = yer + hedef.length;
  const kapsanan: number[] = [];
  sinirlar.forEach((a, i) => {
    if (a.bit > a.bas && a.bas < son && a.bit > yer) kapsanan.push(i);
  });
  return kapsanan.length ? kapsanan : null;
}
