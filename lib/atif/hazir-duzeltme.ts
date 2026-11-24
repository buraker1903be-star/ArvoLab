/*
  HAZIR KAYNAKÇA DÜZELTMELERİ (23.11.2026).

  Denetim neyin yanlış olduğunu söylüyordu, düzeltmeyi öğrenci elle
  yapıyordu: otuz künyelik bir kaynakçada bu, otuz kez kopyala-yapıştır
  demek ve her birinde yeni bir noktalama hatası riski. Oysa künyenin
  DOĞRU hâli çoğu zaman zaten elimizde: kaynak öğrencinin Literatür
  kütüphanesinde yapılandırılmış alanlarla duruyor ve biçimleyici onu
  çalışmanın stilinde yazabiliyor (lib/citation-format.ts).

  Modülün sınırları — hepsi bilerek:

  - KÜNYE UYDURULMAZ. Düzeltme yalnızca kütüphanedeki BİR kayda
    eşleşen künye için üretilir. Eşleşme belirsizse (iki kayıt birden
    uyuyorsa) düzeltme YOK: yanlış kaynağın künyesini yazmak, bozuk
    künyeden kötüdür.
  - EKSİK BİLGİ TAMAMLANMAZ, SÖYLENİR. Kaydın cildi ya da sayfası yoksa
    künye yine de yazılabilir ama eksik kalır; o kayıtlar ayrı listede,
    hangi alanın gerektiği yazılı (eksikAlanlar).
  - BELİRSİZLİK ÖTEKİLERİ ENGELLEMEZ. Eşleşmeyen künye ayrı sayılır;
    altı künye düzeltilebiliyorsa altısı sunulur.
  - MODÜL BELGEYE DOKUNMAZ. Yalnızca "şu satır şu hâle gelir" listesi
    üretir; uygulamak çağıranın (editör) işi ve tek geri alma adımı.

  Saf modül; testi tests/unit/atif-hazir-duzeltme.test.ts.
*/

import type { Dil, Metin } from "@/lib/dil";
import { eksikAlanAnahtarlari, formatReferenceParts, kunyeAlanAdi, type CitableSource, type CitationStyle, type KunyeAlani } from "@/lib/citation-format";

/* Kütüphane kaydı: biçimleyicinin istediği alanlar + kaydın kimliği. */
export type KutuphaneKaynagi = CitableSource & { id: string };
import { kunyeAnahtari } from "@/lib/kaynak-pdf";
import { onerilenOrnek, type OrnekKunye } from "@/lib/kilavuz-ornek-kunyeler";
import { stilTanimi } from "./stiller";

export type DenetlenenKunye = { raw: string; issues?: { message: string; severity?: string }[] | null };

export type HazirDuzeltme = {
  /** Künyenin kimliği: aynı künye denetimden denetime aynı satıra düşsün. */
  anahtar: string;
  /** Kaynakçadaki şu anki satır. */
  ham: string;
  /** Çalışmanın stilinde yeniden yazılmış hâli (önizlemede gösterilen metin). */
  yeni: string;
  /* Aynı künyenin biçimli parçaları: dergi adının italiği belgeye de
     girsin. Düz metin yazmak, kaynakçayı görünüşte düzeltip italiği
     sessizce silmek olurdu. */
  parcalar: { text: string; italic?: boolean }[];
  kaynakId: string;
  /** Denetimin bu künye için yazdığı sorunlar; önizlemede "neden" olarak. */
  sebepler: string[];
  /*
    KILAVUZUN ÖZEL KURALI DOĞRULANAMIYOR. İnternet kaynaklarında
    kılavuzlar çoğu zaman kendi kuralını koyuyor (erişim tarihinin
    yazımı, URL'nin biçimi, "Erişim adresi:" öneki) ve ArvoLab bu
    kuralı kılavuzdan okumuyor. Düzeltme yine üretiliyor — öğrenci
    ötekileri uygulamaktan alıkonmamalı — ama işaretli geliyor ve
    varsayılan olarak SEÇİLİ DEĞİL: doğrulanmamış bir kuralı sessizce
    uygulamak, öğrencinin doğru yazdığı künyeyi bozabilirdi.
  */
  ozelKural: boolean;
  /*
    Künyeye GİRMEYEN eksik alanlar (cilt, sayfa, DOI…). Düzeltme yine
    sunuluyor — bunlar olmadan da künye doğru yazılır — ama öğrenci
    neyin eksik kaldığını görsün: biçimleyici olmayan alanı hiç yazmaz,
    uydurmaz.
  */
  eksikNotu: string[];
  /*
    KILAVUZDAKİ ÖRNEKLER (24.11.2026). Yalnızca özel kuralı
    doğrulanamayan kaynaklarda (internet) ve kılavuzda örnek VARSA
    dolu. `oneri` null ise tür güvenle belirlenemedi: ekran
    "Kılavuzdaki örnekleri karşılaştır" diyor ve karar öğrencinin —
    bir örneği "uygun" diye işaretlemek, doğrulamadığımız bir kurala
    yönlendirmek olurdu. Örnek SEÇMEK künyenin biçimini değiştirmez;
    öğrencinin "bu kuralı okudum" onayıdır ve önizleme aynı kalır.
  */
  ornekDurumu?: { oneri: OrnekKunye | null; secenekler: OrnekKunye[] };
};

export type EksikBilgili = {
  anahtar: string;
  ham: string;
  kaynakId: string;
  /** Künyenin tam olması için gereken alanlar ("cilt", "sayfa aralığı"). */
  alanlar: string[];
};

export type DuzeltmeOzeti = {
  duzeltmeler: HazirDuzeltme[];
  /** Kütüphanede karşılığı var ama kaydı eksik: düzeltme sunulmuyor, eksik yazılıyor. */
  eksikler: EksikBilgili[];
  /** Kütüphanede karşılığı bulunamayan ya da birden çok kayda uyan künyeler. */
  eslesmeyen: string[];
};

/*
  KÜNYENİN YAZILABİLMESİ İÇİN ŞART OLAN ALANLAR.

  Eskiden eksik olan HER alan düzeltmeyi engelliyordu (eksikAlanlar'ın
  tamamı). DOI'si olmayan bir dergi makalesi bu yüzden Vancouver'da da
  IEEE'de de düzeltilemiyordu — oysa bu stiller DOI İSTEMİYOR; APA 7 bile
  "varsa eklenmeli" diyor, zorunlu tutmuyor. Sonuç, düzeltilebilecek
  onlarca künyenin "künye bilgisi eksik" diye kenara atılmasıydı.

  Buradaki liste, YOKLUĞUNDA künyenin yanlış ya da kullanılamaz olacağı
  alanlar: yazar, yıl ve türün taşıyıcısı (makalede dergi, bölümde
  kitap, kitapta yayınevi, internet kaynağında adres). Cilt, sayı, sayfa
  ve DOI eksikse künye yine doğru yazılır, yalnızca kısadır: düzeltme
  SUNULUR ve eksik alanlar NOT olarak söylenir. Eksik bilgi künyeye
  uydurulmaz — biçimleyici olmayan alanı hiç yazmaz.
*/
const TURE_GORE_ZORUNLU: Record<string, KunyeAlani[]> = {
  article: ["yazar", "yil", "dergi"],
  chapter: ["yazar", "yil", "kitap"],
  book: ["yazar", "yil", "yayinevi"],
  thesis: ["yazar", "yil", "universite"],
  report: ["yazar", "yil", "yayinevi"],
  website: ["yil", "url"],
};
const VARSAYILAN_ZORUNLU: KunyeAlani[] = ["yazar", "yil"];

/*
  Stile özel EK zorunluluk. Katalogdaki sekiz stilin hiçbiri bir alanı
  bunların ötesinde şart koşmuyor; liste, yeni bir stil ya da
  DOĞRULANMIŞ bir kılavuz kuralı ("bu kurumda her makale künyesinde DOI
  bulunur") geldiğinde doldurulacak tek yer olsun diye var. Boş
  bırakmak, olmayan bir kuralı varmış gibi uygulamamak demek.
*/
const STILE_GORE_ZORUNLU: Partial<Record<string, KunyeAlani[]>> = {};

/**
 * Düzeltmeyi ENGELLEYEN eksikler: türün ve stilin gerçekten şart koştuğu,
 * bu kaynakta boş olan alanlar.
 *
 * `kilavuzZorunlulari`: kılavuzdan DOĞRULANMIŞ ek zorunluluklar. Bugün
 * kılavuzdan böyle bir kural okunmuyor; parametre, okunduğunda tek
 * noktadan bağlanabilsin diye duruyor ve doldurulmadıkça hiçbir şeyi
 * engellemiyor.
 */
export function engelleyenEksikler(
  kaynak: CitableSource,
  stil: string,
  kilavuzZorunlulari: KunyeAlani[] = [],
): KunyeAlani[] {
  const eksik = new Set(eksikAlanAnahtarlari(kaynak));
  const zorunlu = new Set<KunyeAlani>([
    ...(TURE_GORE_ZORUNLU[kaynak.source_type] ?? VARSAYILAN_ZORUNLU),
    ...(STILE_GORE_ZORUNLU[stil] ?? []),
    ...kilavuzZorunlulari,
  ]);
  return [...eksik].filter((alan) => zorunlu.has(alan));
}

/** Eşleşme için başlığın en az bu kadarı künyede geçmeli. */
const EN_AZ_BASLIK = 12;

const sade = (metin: string) => kunyeAnahtari(metin).replace(/\s+/g, " ");

/*
  Eşleşme ölçütü: kaydın BAŞLIĞI künyenin içinde geçmeli ve yıl tutmalı.
  Yalnızca yazar+yıl bakmak yetmiyordu — aynı yazarın aynı yıldaki iki
  eseri birbirinin künyesine dönüşürdü. Başlık kısa olduğunda (12
  karakterden az) eşleştirme hiç denenmiyor: "Giriş" gibi bir başlık
  her künyenin içinde geçer.
*/
const eslesirMi = (hamSade: string, kaynak: KutuphaneKaynagi) => {
  const baslik = sade(kaynak.title ?? "");
  if (baslik.length < EN_AZ_BASLIK) return false;
  if (!hamSade.includes(baslik)) return false;
  const yil = String(kaynak.year ?? "").trim();
  return yil ? hamSade.includes(sade(yil)) : true;
};

export function hazirDuzeltmeler({
  kunyeler,
  kaynaklar,
  stil,
  dil = "tr",
  erisimTarihi = null,
  kilavuzZorunlulari = [],
  internetOrnekleri = [],
}: {
  kunyeler: DenetlenenKunye[];
  kaynaklar: KutuphaneKaynagi[];
  stil: string;
  dil?: Dil;
  erisimTarihi?: string | null;
  /** Kılavuzdan DOĞRULANMIŞ ek zorunluluklar; bugün boş (bkz. engelleyenEksikler). */
  kilavuzZorunlulari?: KunyeAlani[];
  /** Kılavuzun internet kaynağı örnekleri (lib/kilavuz-ornek-kunyeler.ts). */
  internetOrnekleri?: OrnekKunye[];
}): DuzeltmeOzeti {
  const duzeltmeler: HazirDuzeltme[] = [];
  const eksikler: EksikBilgili[] = [];
  const eslesmeyen: string[] = [];
  /*
    Numara stillerinde künyenin numarası KAYNAKÇADAKİ SIRASIDIR; biçimleyici
    numarayı dışarıdan alıyor. Sıra, denetlenen listenin sırası.
  */
  const numarali = stilTanimi(stil).tur === "numara";

  kunyeler.forEach((kunye, indeks) => {
    const ham = kunye.raw.trim();
    const hamSade = sade(ham);
    const adaylar = kaynaklar.filter((k) => eslesirMi(hamSade, k));
    /* Belirsiz eşleşme düzeltme üretmez: yanlış künye, bozuk künyeden kötü. */
    if (adaylar.length !== 1) {
      eslesmeyen.push(ham);
      return;
    }
    const kaynak = adaylar[0];
    const anahtar = kunyeAnahtari(ham);
    const engel = engelleyenEksikler(kaynak, stil, kilavuzZorunlulari);
    if (engel.length) {
      eksikler.push({ anahtar, ham, kaynakId: kaynak.id, alanlar: engel.map((a) => kunyeAlanAdi(a, dil)) });
      return;
    }
    /* Engellemeyen eksikler künyeye yazılmıyor, NOT olarak söyleniyor. */
    const eksikNotu = eksikAlanAnahtarlari(kaynak)
      .filter((alan) => !engel.includes(alan))
      .map((alan) => kunyeAlanAdi(alan, dil));
    const parcalar = formatReferenceParts(kaynak, stil as CitationStyle, numarali ? indeks + 1 : 1, { erisimTarihi }, dil);
    const yeni = parcalar.map((p) => p.text).join("").trim();
    /* Zaten doğruysa düzeltme sunulmaz: "6 düzeltme hazır" derken
       dokunulacak bir şeyi olmayan satırları saymak sayıyı şişirirdi. */
    if (!yeni || yeni.replace(/\s+/g, " ") === ham.replace(/\s+/g, " ")) return;
    const ozelKural = kaynak.source_type === "website";
    duzeltmeler.push({
      anahtar,
      ham,
      yeni,
      parcalar,
      kaynakId: kaynak.id,
      ozelKural,
      eksikNotu,
      ...(ozelKural && internetOrnekleri.length
        ? { ornekDurumu: { oneri: onerilenOrnek(internetOrnekleri, kaynak), secenekler: internetOrnekleri } }
        : {}),
      sebepler: (kunye.issues ?? []).map((s) => s.message).filter(Boolean),
    });
  });

  return { duzeltmeler, eksikler, eslesmeyen };
}

/*
  KAYNAKÇADA OLMAYAN AMA METİNDE ANILAN KAYNAKLAR.

  Denetimin "kaynakçada karşılığı olmayan atıf" bulgusunun öteki yüzü:
  atıf metinde var, künye kaynakçada yok. Künyeyi öğrenciye elle
  yazdırmanın anlamı yok — kaynak zaten kütüphanesinde ve editör onu
  çalışmanın stilinde yazabiliyor (kaynakcaGirdisiIslemi, atıf eklerken
  kullanılan AYNI yol).

  Eşleşme ölçütü dar: atfın yazar anahtarı kaydın ilk yazarının
  soyadıyla, yılı da kaydın yılıyla tutmalı. Gevşetmek, metindeki bir
  adı yanlış kaynağa bağlayıp kaynakçaya hiç anılmamış bir eser yazmak
  olurdu.
*/
export type MetindekiAtif = { raw: string; authorKey?: string | null; year?: string | null };

const soyad = (yazar: string) => {
  const temiz = yazar.trim();
  const parca = temiz.includes(",") ? temiz.split(",")[0] : temiz.split(/\s+/).at(-1) ?? temiz;
  return sade(parca);
};

export function eksikKaynakcaGirdileri({
  atiflar,
  kunyeler,
  kaynaklar,
}: {
  atiflar: MetindekiAtif[];
  kunyeler: DenetlenenKunye[];
  kaynaklar: KutuphaneKaynagi[];
}): KutuphaneKaynagi[] {
  if (!atiflar.length) return [];
  const kunyeSadeleri = kunyeler.map((k) => sade(k.raw));
  return kaynaklar.filter((kaynak) => {
    /* Kaynakçada zaten varsa eklenecek bir şey yok. */
    if (kunyeSadeleri.some((ham) => eslesirMi(ham, kaynak))) return false;
    const ilkYazar = (kaynak.authors ?? "").split(/\s*(?:;|,\s*&|&| ve )\s*/)[0] ?? "";
    const anahtar = soyad(ilkYazar);
    if (anahtar.length < 2) return false;
    const yil = String(kaynak.year ?? "").trim();
    return atiflar.some((atif) => {
      const atifAnahtari = sade(String(atif.authorKey ?? "")) || sade(atif.raw);
      if (!atifAnahtari.includes(anahtar)) return false;
      /* Yıl ikisinde de varsa tutmalı; atıfta yoksa (MLA, numara) yazar yeter. */
      return !yil || !atif.year ? true : String(atif.year).trim() === yil;
    });
  });
}

/** Öğrenciye gösterilen özet cümlesi; sıfırken çağıran hiç göstermez. */
export function duzeltmeOzetCumlesi(ozet: DuzeltmeOzeti): Metin {
  const n = ozet.duzeltmeler.length;
  const e = ozet.eksikler.length;
  const eksikCumle: Metin = {
    tr: e ? ` ${e} kaynakta künye bilgisi eksik; hangi bilginin gerektiği listede yazılı.` : "",
    en: e ? ` ${e} source${e === 1 ? "" : "s"} ${e === 1 ? "is" : "are"} missing reference details; the list says which.` : "",
  };
  return {
    tr: `${n} kaynakça düzeltmesi hazır.${eksikCumle.tr}`,
    en: `${n} reference ${n === 1 ? "fix" : "fixes"} ready.${eksikCumle.en}`,
  };
}
