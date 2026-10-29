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
import { sayiOkumalari } from "./sayi-denetimi";
import type { Mesaj } from "./saglayici";

export const METIN_BUTCESI = 60_000;

export type UakKriteri = {
  kod: string;
  etiket: string;
  grup: string | null;
  /** Özel şartlarda alt alan (20261027142035); genel şartlarda null. */
  alt_alan: string | null;
  puan: number;
  /** "Puan yazarlar arasında eşit bölünür" (20261027122336). */
  esit_bolusum: boolean;
  baslica_katsayi: number | null;
  diger_katsayi: number | null;
};
/** Bir grubun (null = toplam) sınırları; doktora_sonrasi asgarinin yalnızca doktora sonrası faaliyetlerle sağlanacağını söyler. */
export type UakHedefi = { grup: string | null; alt_alan: string | null; asgari_puan: number | null; azami_puan: number | null; doktora_sonrasi: boolean };
export type UakOnerisi = { kriterler: UakKriteri[]; hedefler: UakHedefi[]; notlar: string[] };

export const UAK_ISTEMI = `Sen bir veri çıkarma aracısın. Sana ÜAK (Üniversitelerarası Kurul) doçentlik başvuru şartları tablosunun PDF'ten çıkarılmış metni verilecek. Görevin bu tabloyu yapılandırılmış bir listeye çevirmek.

KURALLAR:
- Yalnızca metinde YAZAN değerleri kullan. Metinde olmayan hiçbir sayı, kod ya da kural yazma; emin olmadığın satırı atla.
- kriterler: puan getiren her bent satırı. kod "madde.bent" biçiminde (örn. "1.a", "7.b"); aynı bentte birden çok puan varsa (örn. Q1, Q2 ya da Koordinatör, Araştırmacı) her biri ayrı kriter ve kod sonuna ayırt edici ek koy (örn. "1.a-Q1", "7.a-Yürütücü"). etiket kısa açıklama (en fazla 100 karakter; uzun açıklamaları kısalt). grup maddenin başlığı (örn. "Uluslararası Makale", "Atıf"); aynı maddenin bütün bentlerinde ve hedeflerde AYNI grup adını kullan. puan satırın birim puanı.
- Tablo alt alanlara ayrılmış ÖZEL şartlar içeriyorsa (örn. "ÖZEL BAŞVURU ŞARTLARI" altında "MÜZİK BİLİM/SANAT ALANI", "Klasik Batı Müziği/Yorumculuk"), bu bölümlerin kriterlerinde grup adı alt alanı taşısın (örn. "Özel · Müzik · Klasik Batı Müziği/Yorumculuk") ve kodun başına bölümün kısa adını koy (örn. "Müzik/KBM-Yorum-a"): genel şartlardaki "1.a" ile karışmasın. Bu bölümlerin kriterlerinde ve hedeflerinde alt_alan alanına alt alanın adını yaz (örn. "Müzik · Klasik Batı Müziği/Yorumculuk", "Plastik Sanatlar, Tasarım, Sinema"); aynı alt alanın bütün satırlarında AYNI adı kullan. Genel şartlarda alt_alan null. Bu bölümlerin bent düzeyindeki asgari şartlarını notlara yaz.
- esit_bolusum: metin o kriter türü için puanın yazarlar/kişiler arasında eşit bölündüğünü söylüyorsa true (örn. "Çok yazarlı yayınlarda puan yazarlar arasında eşit olarak bölünür" bütün yayın kriterleri için, "Patentlerde puan kişi sayısına bölünür" patentler için). Yoksa false.
- baslica_katsayi ve diger_katsayi: yalnızca metin başlıca yazar ve diğer yazarlar için ayrı SAYISAL katsayı veriyorsa (örn. 0,8 ve 0,5) yaz; aksi hâlde null.
- hedefler: maddelerin puan sınırları. grup null ise toplam, değilse o maddenin grubu.
  * "en az X puan" ya da "asgari X puan" → asgari_puan: X.
  * "Bu maddeden en fazla X puan alınabilir" → azami_puan: X (doktora_sonrasi false).
  * Asgari şart doktora unvanından sonraki çalışmalarla sağlanacaksa doktora_sonrasi: true (örn. toplam için "en az 90 puanın doktora unvanının alınmasından sonra" → grup null, asgari_puan 90, doktora_sonrasi true; ayrıca toplam "asgari 100 puan" → grup null, asgari_puan 100, doktora_sonrasi false).
  * Aynı grup için hem tavan hem bütün faaliyetlere bakan asgari varsa ikisini tek satırda yaz.
- notlar: puana ya da madde sınırına çevrilemeyen şartlar: bent düzeyinde sınırlar ("g veya h bentlerinden toplamda en fazla 5 puan"), sayı şartları ("biri a bendinden olmak üzere en az iki yayın"), bent düzeyinde doktora sonrası şartlar, ikinci danışmanın yarı puanı gibi kurallar. Her biri tek cümle, en fazla 15 madde, metne yakın yaz.

YANIT BİÇİMİ: Yalnızca şu JSON nesnesini döndür, başka hiçbir şey yazma:
{"kriterler":[{"kod":"","etiket":"","grup":"","alt_alan":null,"puan":0,"esit_bolusum":false,"baslica_katsayi":null,"diger_katsayi":null}],"hedefler":[{"grup":null,"alt_alan":null,"asgari_puan":null,"azami_puan":null,"doktora_sonrasi":false}],"notlar":[""]}`;

/** PDF metnini bütçeye sığdırır; kırpıldıysa söyler (yönetici eksik okuma riskini bilsin). */
/*
  PARÇALAMA (27.10.2026). Güzel Sanatlar tablosu (12 sayfa, 29 bin
  karakter, genel şartların ardından alt alanlara ayrılmış özel şartlar)
  tek çağrıda okutulunca model 150 saniyede yanıtı bitiremedi. Tablo
  bölüm başlıklarından (BÜYÜK HARFLİ satırlar: "ÖZEL BAŞVURU ŞARTLARI",
  "MÜZİK BİLİM/SANAT ALANI"…) parçalanıyor ve parçalar AYNI ANDA
  okutuluyor; süre en uzun parça kadar. Her parçaya tablonun genel
  kuralları (ilk maddeye kadarki giriş) bağlam olarak ekleniyor: "puan
  yazarlar arasında eşit bölünür" gibi kurallar orada yazıyor.
  Başlığı olmayan kısa tablolar (Eğitim Bilimleri) tek parça kalır.
*/
const BASLIK_SATIRI = /^(?=.*[A-ZÇĞİÖŞÜ]{3})[^a-zçğıöşü\d][^a-zçğıöşü]{6,}$/;
const MADDE_SATIRI = /^\d{1,2}\.\s+\S/;

export function uakParcalari(metin: string, hedef = 9_000): { giris: string; parcalar: string[] } {
  const satirlar = metin.split("\n");
  const ilkMadde = satirlar.findIndex((s) => MADDE_SATIRI.test(s.trim()));
  const giris = (ilkMadde > 0 ? satirlar.slice(0, ilkMadde).join("\n") : "").slice(0, 3_000);

  // Bölümler: başlık satırlarında bölünür (art arda başlık satırları tek başlık sayılır).
  const bolumler: string[][] = [[]];
  let oncekiBaslik = false;
  for (const satir of satirlar) {
    const baslik = BASLIK_SATIRI.test(satir.trim()) && !/^Ü n i v e r/.test(satir.trim());
    if (baslik && !oncekiBaslik && bolumler[bolumler.length - 1].some((x) => x.trim())) bolumler.push([]);
    bolumler[bolumler.length - 1].push(satir);
    oncekiBaslik = baslik;
  }

  // Çok uzun bölüm madde satırlarından bölünür; kısa komşu bölümler birleştirilir.
  const parcalar: string[] = [];
  let birikim = "";
  const bosalt = () => {
    if (birikim.trim()) parcalar.push(birikim.trim());
    birikim = "";
  };
  for (const bolum of bolumler) {
    const metni = bolum.join("\n");
    if (metni.length > hedef * 1.4) {
      bosalt();
      const baslikSatirlari = bolum.slice(0, Math.max(0, bolum.findIndex((s) => !BASLIK_SATIRI.test(s.trim()))));
      let parca: string[] = [];
      for (const satir of bolum) {
        if (MADDE_SATIRI.test(satir.trim()) && parca.join("\n").length > hedef) {
          parcalar.push(parca.join("\n").trim());
          parca = baslikSatirlari.length ? [...baslikSatirlari, "(bölümün devamı)"] : [];
        }
        parca.push(satir);
      }
      if (parca.join("\n").trim()) parcalar.push(parca.join("\n").trim());
    } else if ((birikim + metni).length > hedef) {
      bosalt();
      birikim = metni;
    } else {
      birikim = birikim ? `${birikim}\n${metni}` : metni;
    }
  }
  bosalt();
  return { giris, parcalar: parcalar.length ? parcalar : [metin] };
}

/** Her parça için ayrı istem; tek parçalı tabloda eskisiyle aynı istem. */
/*
  Sayfa süsü: ÜAK PDF'lerinin her sayfasındaki aralıklı başlık
  ("Ü n i v e r s i t e l e r a r a s ı …"), "S a y f a 1 / 12" ve
  pdf-parse'ın "-- 1 of 12 --" ayracı. Tablonun parçası değiller;
  bırakılırsa parçalamada boş bir parça açıyor ve bütçeyi yiyorlar.
*/
export const sayfaSusunuAyikla = (metin: string) =>
  metin
    .split("\n")
    .filter((s) => !/^\s*(Ü n i v e r s i t e|S a y f a\s|-- \d+ of \d+ --)/.test(s))
    .join("\n");

export function uakIstemleri(metin: string, temelAlan: string, butce = METIN_BUTCESI): { istemler: Mesaj[][]; kaynak: string; kirpildi: boolean } {
  const temiz = sayfaSusunuAyikla(metin).replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  const kaynak = temiz.slice(0, butce);
  const { giris, parcalar } = uakParcalari(kaynak);
  if (parcalar.length <= 1) {
    return { istemler: [uakIstemi(kaynak, temelAlan, butce).mesajlar], kaynak, kirpildi: temiz.length > butce };
  }
  const istemler = parcalar.map((parca, i): Mesaj[] => [
    { rol: "sistem", metin: UAK_ISTEMI },
    {
      rol: "kullanici",
      metin:
        `Temel alan: ${temelAlan}\n\nTablo uzun olduğu için PARÇA PARÇA okunuyor. Bu, ${parcalar.length} parçanın ${i + 1}. parçası. ` +
        `Yalnızca BU PARÇADAKİ satırlardan kriter, hedef ve not çıkar. ` +
        (i === 0 ? "" : "Toplam puan hedeflerini (grup null) yazma; onlar ilk parçada. ") +
        `\n\nTABLONUN GENEL KURALLARI (yalnızca bağlam):\n${giris || "(yok)"}\n\nBU PARÇA:\n${parca}`,
    },
  ]);
  return { istemler, kaynak, kirpildi: temiz.length > butce };
}

/*
  Parça önerilerini birleştirir. Aynı kod iki parçada gelirse ilki kalır
  (bölüm öneki yüzünden beklenmez); hedefler aynı grup + dönem şartında
  birleşir, boş alanlar tamamlanır; notlar tekrarsız.
*/
export function onerileriBirlestir(oneriler: UakOnerisi[]): UakOnerisi | null {
  const kriterler: UakKriteri[] = [];
  const hedefler: UakHedefi[] = [];
  const notlar: string[] = [];
  for (const o of oneriler) {
    for (const k of o.kriterler) if (!kriterler.some((x) => x.kod === k.kod)) kriterler.push(k);
    for (const h of o.hedefler) {
      const var_ = hedefler.find((x) => x.grup === h.grup && x.alt_alan === h.alt_alan && x.doktora_sonrasi === h.doktora_sonrasi);
      if (!var_) hedefler.push({ ...h });
      else {
        var_.asgari_puan ??= h.asgari_puan;
        var_.azami_puan ??= h.azami_puan;
      }
    }
    for (const n of o.notlar) if (!notlar.includes(n)) notlar.push(n);
  }
  return kriterler.length ? { kriterler, hedefler, notlar: notlar.slice(0, 30) } : null;
}

export function uakIstemi(metin: string, temelAlan: string, butce = METIN_BUTCESI): { mesajlar: Mesaj[]; kaynak: string; kirpildi: boolean } {
  const temiz = metin.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  const kaynak = temiz.slice(0, butce);
  return {
    mesajlar: [
      { rol: "sistem", metin: UAK_ISTEMI },
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
export function uakOnerisiniCozumle(ham: string, bosKabul = false): UakOnerisi | null {
  const veri = jsonOku(ham) as { kriterler?: unknown; hedefler?: unknown; notlar?: unknown } | null;
  if (!veri || !Array.isArray(veri.kriterler)) return null;

  const gorulen = new Set<string>();
  const kriterler: UakKriteri[] = [];
  for (const k of veri.kriterler as Record<string, unknown>[]) {
    const kod = metinAl(k?.kod, 60);
    const etiket = metinAl(k?.etiket, 160);
    const puan = sayiAl(k?.puan);
    if (!kod || !etiket || puan === null || puan < 0 || gorulen.has(kod)) continue;
    gorulen.add(kod);
    kriterler.push({
      kod,
      etiket,
      grup: metinAl(k?.grup, 120) || null,
      alt_alan: metinAl(k?.alt_alan, 160) || null,
      puan,
      esit_bolusum: k?.esit_bolusum === true,
      baslica_katsayi: katsayiAl(k?.baslica_katsayi),
      diger_katsayi: katsayiAl(k?.diger_katsayi),
    });
  }
  /* Parçalı okumada bir parçada kriter olmayabilir (kısaltmalar, tanımlar); birleşik öneri yine kriter ister. */
  if (!kriterler.length && !bosKabul) return null;

  /* Aynı grup + aynı dönem şartı için tek satır (veritabanındaki benzersiz dizinle aynı). */
  const hedefler: UakHedefi[] = [];
  const sinir = (v: unknown) => {
    const n = v === null || v === undefined || v === "" ? null : sayiAl(v);
    return n !== null && n > 0 ? n : null;
  };
  /*
    Model "doktora sonrası en az 5, en fazla 10" şartını TEK satırda
    verebiliyor. Tavan dönemden bağımsız olduğu için böyle bir satır ikiye
    bölünüyor: asgari doktora sonrası satırına, tavan bütün faaliyetler
    satırına. Eskiden tavan atılıyordu: Eğitim Bilimleri tablosunda Atıf,
    Bilimsel Toplantı ve Eğitim-Öğretim maddelerinin tavanı öneriden
    düştü (27.10.2026).
  */
  const ekle = (grup: string | null, altAlan: string | null, doktoraSonrasi: boolean, asgari: number | null, azami: number | null) => {
    if (asgari === null && azami === null) return;
    const var_ = hedefler.find((x) => x.grup === grup && x.alt_alan === altAlan && x.doktora_sonrasi === doktoraSonrasi);
    if (var_) {
      // Aynı satır iki kez geldiyse boş alanlar tamamlanır, dolu olan ezilmez.
      var_.asgari_puan ??= asgari;
      var_.azami_puan ??= azami;
      return;
    }
    hedefler.push({ grup, alt_alan: altAlan, asgari_puan: asgari, azami_puan: azami, doktora_sonrasi: doktoraSonrasi });
  };
  for (const h of (Array.isArray(veri.hedefler) ? veri.hedefler : []) as Record<string, unknown>[]) {
    const grup = metinAl(h?.grup, 120) || null;
    const altAlan = metinAl(h?.alt_alan, 160) || null;
    const asgari = sinir(h?.asgari_puan);
    const azami = sinir(h?.azami_puan);
    if (h?.doktora_sonrasi === true) {
      ekle(grup, altAlan, true, asgari, null);
      ekle(grup, altAlan, false, null, azami);
    } else {
      ekle(grup, altAlan, false, asgari, azami);
    }
  }

  const notlar = (Array.isArray(veri.notlar) ? veri.notlar : [])
    .map((n) => metinAl(n, 300))
    .filter(Boolean)
    .slice(0, 15);

  return { kriterler, hedefler, notlar };
}

/*
  Önerideki sayılardan PDF metninde GEÇMEYENLER. Sayı değerleri ve
  metin alanlarının içindeki sayılar (etiketteki "Q1", nottaki "90")
  birlikte taranıyor. Serbest liste YOK (bkz. dosya başı).
*/
export function metindeOlmayanSayilar(oneri: UakOnerisi, metin: string): string[] {
  // Okumaların hepsi: "1.500" binlik de ondalık da olabilir (lib/ai/sayi-denetimi.ts).
  const bilinen = new Set(sayiOkumalari(metin).flat());
  const yazi = [
    ...oneri.kriterler.flatMap((k) => [k.kod, k.etiket, k.grup ?? "", k.alt_alan ?? "", String(k.puan), k.baslica_katsayi ?? "", k.diger_katsayi ?? ""].map(String)),
    ...oneri.hedefler.flatMap((h) => [h.grup ?? "", h.alt_alan ?? "", h.asgari_puan ?? "", h.azami_puan ?? ""].map(String)),
    ...oneri.notlar,
  ].join(" \n ");
  return [...new Set(sayiOkumalari(yazi).filter((o) => !o.some((d) => bilinen.has(d))).map((o) => o[0]))];
}

/** "2026 Mart", "2026 Ekim": içinde bulunulan ve bir sonraki başvuru dönemi. */
export function donemSecenekleri(bugun: string): string[] {
  const yil = Number(bugun.slice(0, 4));
  const ay = Number(bugun.slice(5, 7));
  // Mart dönemi yılın ilk yarısını, ekim dönemi ikinci yarısını karşılar.
  return ay <= 6 ? [`${yil} Mart`, `${yil} Ekim`] : [`${yil} Ekim`, `${yil + 1} Mart`];
}
