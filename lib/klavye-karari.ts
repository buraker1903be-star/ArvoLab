/*
  EDİTÖRDE TAB VE SHIFT+TAB (27.10.2026, kurum sahibinin bildirimi:
  "editörün içinde klavyenin özelliklerini kullanamıyorum, örneğin Tab
  çalışmıyor").

  Eskiden Tab'ın editörde bir karşılığı yoktu: tarayıcı odağı bir sonraki
  düğmeye taşıyordu, öğrenci yazarken imleç editörden çıkıyordu. Liste ve
  tablo kendi Tab'larını (girinti, sonraki hücre) zaten işliyor; bu karar
  geri kalan her yer için ve Word'ün davranışını izliyor:

  - Paragrafın BAŞINDA Tab: ilk satır girintisi (Word de satır başındaki
    Tab'ı girintiye çevirir). Girinti zaten varsa sekme karakteri.
  - Paragrafın içinde Tab: sekme karakteri.
  - Shift+Tab paragraf başında: ilk satır girintisini kaldırır.
  - Listede ve tabloda Tab ASLA editörden çıkmaz: liste öğesi daha fazla
    içeri alınamıyorsa bile tuş yutulur, yoksa odak kaçardı.

  Saf modül; testi tests/unit/klavye-karari.test.ts.
*/

export type TabDurumu = { listede: boolean; tabloda: boolean; satirBasinda: boolean; girintili: boolean };
export type TabKarari = "girinti-ekle" | "girinti-kaldir" | "sekme" | "yut";

export function tabKarari(durum: TabDurumu, shift: boolean): TabKarari {
  if (durum.listede || durum.tabloda) return "yut";
  if (shift) return durum.satirBasinda && durum.girintili ? "girinti-kaldir" : "yut";
  return durum.satirBasinda && !durum.girintili ? "girinti-ekle" : "sekme";
}

/** Ctrl+] / Ctrl+[: yazı boyutunu bir punto büyüt/küçült (Word); 8–72 pt arası. */
export function puntoAdimi(simdiki: string | null | undefined, varsayilanPt: number, yon: 1 | -1): string {
  const pt = parseFloat(String(simdiki ?? "")) || varsayilanPt;
  return `${Math.min(72, Math.max(8, Math.round(pt) + yon))}pt`;
}

/*
  SHIFT+F3: HARF DURUMU (Word). Seçili metin sırayla küçük harf → BÜYÜK
  HARF → Başlık Düzeni arasında döner. Tez başlıkları kılavuza göre büyük
  ya da başlık düzeninde yazılıyor ve öğrenci başlığı yeniden yazıyordu.
  Türkçe kurallarla: "i" → "İ", "I" → "ı" (toLocaleUpperCase("tr")).
*/
export type HarfDurumu = "kucuk" | "buyuk" | "baslik";

const harfVar = (m: string) => /\p{L}/u.test(m);

/** Seçimin şu anki durumuna göre SIRADAKİ durum. */
export function siradakiHarfDurumu(metin: string): HarfDurumu {
  if (!harfVar(metin)) return "kucuk";
  const kucuk = metin.toLocaleLowerCase("tr-TR");
  const buyuk = metin.toLocaleUpperCase("tr-TR");
  if (metin === kucuk) return "buyuk";
  if (metin === buyuk) return "baslik";
  return "kucuk";
}

/**
 * Metni istenen duruma çevirir. `kelimeBasi`: metnin ilk karakteri bir
 * kelimenin başında mı (seçim kelime ortasında başlıyorsa baş harf büyütülmez;
 * seçim birden çok metin düğümüne bölündüğünde de düğüm sınırı kelime başı sayılmaz).
 */
export function harfCevir(metin: string, durum: HarfDurumu, kelimeBasi = true): string {
  if (durum === "kucuk") return metin.toLocaleLowerCase("tr-TR");
  if (durum === "buyuk") return metin.toLocaleUpperCase("tr-TR");
  let onceki = kelimeBasi ? " " : "a";
  let sonuc = "";
  for (const harf of metin) {
    const bas = !/[\p{L}\p{N}'’]/u.test(onceki);
    sonuc += bas ? harf.toLocaleUpperCase("tr-TR") : harf.toLocaleLowerCase("tr-TR");
    onceki = harf;
  }
  return sonuc;
}

/*
  EDİTÖRDEN KLAVYEYLE ÇIKIŞ (V4.3-B2, WCAG 2.1.2 "klavye tuzağı yok").

  27.10.2026'dan beri Tab editörün içinde girinti/sekme ve odak editörden
  HİÇ çıkmıyordu: yalnız klavye kullanan biri editöre girince sayfanın
  geri kalanına (kaydet durumu, panel, gezinme) ulaşamıyordu.

  Kural (kod editörlerindeki "Esc, sonra Tab" deseni):
  - Esc "çıkışı kurar". Belgeye, seçime, kayda ve AI'a dokunmaz; editörü
    odaktan da çıkarmaz (imleç yerinde kalır).
  - Kuruluyken gelen Tab / Shift+Tab odağı editörün dışındaki
    sonraki / önceki denetime taşır.
  - Başka herhangi bir tuş kurulumu bozar: Tab yine girinti yapar.
  - Satır içi öneri açıkken Esc onu kapatır ve çıkışı KURMAZ (önce o
    eklenti çalışır ve tuşu tüketir; bu karara hiç ulaşılmaz).
*/
export type CikisKarari = "kur" | "cik-ileri" | "cik-geri" | "boz" | "dokunma";

export function cikisKarari(kurulu: boolean, tus: string, shift: boolean): CikisKarari {
  if (tus === "Escape") return "kur";
  if (tus === "Tab") return kurulu ? (shift ? "cik-geri" : "cik-ileri") : "dokunma";
  // Değiştirici tuşun kendisi (Shift+Tab'ın Shift'i) kurulumu bozmaz.
  if (tus === "Shift" || tus === "Control" || tus === "Alt" || tus === "Meta") return "dokunma";
  return kurulu ? "boz" : "dokunma";
}
