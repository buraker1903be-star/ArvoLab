/*
  ÜAK DOÇENTLİK TABLOSUNU OKUMA (27.10.2026). Saf modül; testi
  tests/unit/uak-tablosu.test.ts.

  ÜAK'ın bir veri arayüzü yok: başvuru şartları her dönem (mart, ekim)
  temel alan başına PDF olarak yayımlanıyor. Yönetici PDF'i yüklüyor,
  asistan tabloyu ÖNERİYE çeviriyor, yönetici onaylıyor
  (app/actions/uak-tablosu.ts).

  Bu yetenek "asistan denetler, yazmaz" kuralının dışında değil, yanında:
  ürettiği şey öğrencinin metnine girecek bir cümle değil, resmî bir
  tablonun yapılandırılmış kopyası — ve onay olmadan hiçbir yere yazılmıyor.

  SAYI KURALI BURADA DAHA SIKI. Genel denetim (sayi-denetimi.ts) 0–5, 95,
  100 gibi değerleri serbest bırakıyor; burada bırakmıyor: "toplam en az
  100 puan" bir doçentlik tablosunda en çok uydurulabilecek sayı ve tam da
  serbest listede. Önerideki HER sayı PDF metninde geçmek zorunda; tek bir
  sayı geçmiyorsa önerinin tamamı düşer — kısmen doğru bir puan tablosunda
  hangi satırın uydurulduğunu yönetici ayıklayamaz.
*/

import { jsonOku } from "./bulgu";
import { sayilar } from "./sayi-denetimi";
import type { Mesaj } from "./saglayici";

export const METIN_BUTCESI = 60_000;

export type UakKriteri = {
  kod: string;
  etiket: string;
  grup: string | null;
  puan: number;
  baslica_katsayi: number | null;
  diger_katsayi: number | null;
};
export type UakHedefi = { grup: string | null; asgari_puan: number };
export type UakOnerisi = { kriterler: UakKriteri[]; hedefler: UakHedefi[]; notlar: string[] };

const SISTEM = `Sen bir veri çıkarma aracısın. Sana ÜAK (Üniversitelerarası Kurul) doçentlik başvuru şartları tablosunun PDF'ten çıkarılmış metni verilecek. Görevin bu tabloyu yapılandırılmış bir listeye çevirmek.

KURALLAR:
- Yalnızca metinde YAZAN değerleri kullan. Metinde olmayan hiçbir sayı, kod ya da kural yazma; emin olmadığın satırı atla.
- kriterler: puan getiren her faaliyet satırı. kod tablodaki madde numarası/kodu (örn. "1.a", "A1"), etiket kısa açıklama (en fazla 160 karakter), grup tablodaki ana başlık (örn. "Makale", "Atıf", "Eğitim-Öğretim"), puan satırın birim puanı.
- baslica_katsayi ve diger_katsayi: metin çok yazarlı eserde puanın nasıl paylaşılacağını SAYI olarak açıkça veriyorsa (örn. başlıca yazar 0,8, diğer yazarlar 0,5) yaz; kural kesirle (1/n gibi) ya da yazar sayısına bağlı tabloyla veriliyorsa ya da metinde yoksa null yaz.
- hedefler: tablodaki asgari puan şartları. grup null ise toplam asgari puan; değilse o grubun asgari puanı.
- notlar: puana çevrilemeyen ama başvuruyu etkileyen şartlar (örn. "tezden üretilmiş yayın zorunlu", "puanların en az şu kadarı doktora sonrası"), her biri tek cümle, en fazla 8 madde. Metinden alıntıya yakın yaz.

YANIT BİÇİMİ: Yalnızca şu JSON nesnesini döndür, başka hiçbir şey yazma:
{"kriterler":[{"kod":"","etiket":"","grup":"","puan":0,"baslica_katsayi":null,"diger_katsayi":null}],"hedefler":[{"grup":null,"asgari_puan":0}],"notlar":[""]}`;

/** PDF metnini bütçeye sığdırır; kırpıldıysa söyler (yönetici eksik okuma riskini bilsin). */
export function uakIstemi(metin: string, temelAlan: string, butce = METIN_BUTCESI): { mesajlar: Mesaj[]; kaynak: string; kirpildi: boolean } {
  const temiz = metin.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  const kaynak = temiz.slice(0, butce);
  return {
    mesajlar: [
      { rol: "sistem", metin: SISTEM },
      { rol: "kullanici", metin: `Temel alan: ${temelAlan}\n\nTABLO METNİ:\n${kaynak}` },
    ],
    kaynak,
    kirpildi: temiz.length > butce,
  };
}

const metinAl = (v: unknown, sinir: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, sinir);
const sayiAl = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
const katsayiAl = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = sayiAl(v);
  return n !== null && n > 0 && n <= 1 ? n : null;
};

/*
  Modelin yanıtını öneriye çevirir. Bozuk satır atılır (kodsuz, puansız);
  aynı kod iki kez gelirse ilki kalır — benzersiz dizin zaten ikincisini
  reddederdi. Hiç kriter yoksa null: boş bir öneriyi onaylamak, kurumun
  bütün kriterlerini pasife almak olurdu.
*/
export function uakOnerisiniCozumle(ham: string): UakOnerisi | null {
  const veri = jsonOku(ham) as { kriterler?: unknown; hedefler?: unknown; notlar?: unknown } | null;
  if (!veri || !Array.isArray(veri.kriterler)) return null;

  const gorulen = new Set<string>();
  const kriterler: UakKriteri[] = [];
  for (const k of veri.kriterler as Record<string, unknown>[]) {
    const kod = metinAl(k?.kod, 30);
    const etiket = metinAl(k?.etiket, 160);
    const puan = sayiAl(k?.puan);
    if (!kod || !etiket || puan === null || puan < 0 || gorulen.has(kod)) continue;
    gorulen.add(kod);
    kriterler.push({
      kod,
      etiket,
      grup: metinAl(k?.grup, 120) || null,
      puan,
      baslica_katsayi: katsayiAl(k?.baslica_katsayi),
      diger_katsayi: katsayiAl(k?.diger_katsayi),
    });
  }
  if (!kriterler.length) return null;

  const hedefGrubu = new Set<string>();
  const hedefler: UakHedefi[] = [];
  for (const h of (Array.isArray(veri.hedefler) ? veri.hedefler : []) as Record<string, unknown>[]) {
    const grup = metinAl(h?.grup, 120) || null;
    const asgari = sayiAl(h?.asgari_puan);
    if (asgari === null || asgari <= 0 || hedefGrubu.has(grup ?? "")) continue;
    hedefGrubu.add(grup ?? "");
    hedefler.push({ grup, asgari_puan: asgari });
  }

  const notlar = (Array.isArray(veri.notlar) ? veri.notlar : [])
    .map((n) => metinAl(n, 300))
    .filter(Boolean)
    .slice(0, 8);

  return { kriterler, hedefler, notlar };
}

/*
  Önerideki sayılardan PDF metninde GEÇMEYENLER. Sayı değerleri ve
  metin alanlarının içindeki sayılar (etiketteki "Q1", nottaki "90")
  birlikte taranıyor. Serbest liste YOK (bkz. dosya başı).
*/
export function metindeOlmayanSayilar(oneri: UakOnerisi, metin: string): string[] {
  const bilinen = new Set(sayilar(metin));
  const yazi = [
    ...oneri.kriterler.flatMap((k) => [k.kod, k.etiket, k.grup ?? "", String(k.puan), k.baslica_katsayi ?? "", k.diger_katsayi ?? ""].map(String)),
    ...oneri.hedefler.flatMap((h) => [h.grup ?? "", String(h.asgari_puan)]),
    ...oneri.notlar,
  ].join(" \n ");
  return [...new Set(sayilar(yazi))].filter((s) => !bilinen.has(s));
}

/** "2026 Mart", "2026 Ekim": içinde bulunulan ve bir sonraki başvuru dönemi. */
export function donemSecenekleri(bugun: string): string[] {
  const yil = Number(bugun.slice(0, 4));
  const ay = Number(bugun.slice(5, 7));
  // Mart dönemi yılın ilk yarısını, ekim dönemi ikinci yarısını karşılar.
  return ay <= 6 ? [`${yil} Mart`, `${yil} Ekim`] : [`${yil} Ekim`, `${yil + 1} Mart`];
}
