/*
  Asistanın üçüncü yeteneği: literatür taraması.

  En kritik güvenlik kararı burada: asistan KAYNAK ÖNERMEZ. Dil modellerinin
  en bilinen ve en zararlı hatası uydurma künye üretmek — gerçekçi görünen
  yazar, başlık, dergi ve DOI. Akademik bir çalışmada bu, kariyer bitiren bir
  hatadır ve kullanıcı uydurmayı ancak tek tek arayarak anlayabilir.

  Bu yüzden asistan iki iş yapar:
    1. ARAMA STRATEJİSİ üretir: anahtar kelimeler, Türkçe/İngilizce
       karşılıklar, Boole birleşimleri, dahil etme/hariç tutma ölçütleri.
       Kaynakları kullanıcı gerçek dizinlerden kendi bulur.
    2. MEVCUT LİSTEYİ denetler: yıl dağılımı, tek dergiye/yazara yığılma,
       yöntem çeşitliliği, konuyla ilgisiz görünen kayıtlar.

  Sayı denetimi yalnızca bulgulara uygulanır, arama satırlarına değil: arama
  dizesindeki "2015..2025" gibi yıl aralıkları meşru filtrelerdir, bağlamda
  geçmezler ve kullanıcı çalıştırmadan önce zaten görür. Bulgular ise iddia
  taşır; oradaki uydurma sayı doğrudan yanıltır.

  Saf modül; testi tests/unit/ai-literatur-taramasi.test.ts.
*/

import { baglamKur, type BaglamParca } from "./baglam";
import type { Dil } from "@/lib/dil";
import { bulgulariCozumle, jsonOku, kunyeIziMetinde, type Bulgu, cikisDiliMesaji, dilliKaynak } from "./bulgu";
import type { Mesaj } from "./saglayici";

export type KayitOzeti = {
  baslik: string;
  yazarlar?: string | null;
  yil?: string | null;
  tur?: string | null;
  yayin?: string | null;
};

export type LiteraturGirdisi = {
  /** Kullanıcının arayüz dili: bulgular bu dilde yazılır (lib/ai/bulgu.ts, cikisDiliMesaji). */
  dil?: Dil;
  /** Bağlı akademik çalışmanın künyesi (lib/ai/calisma-baglami.ts). */
  calisma?: string;
  arastirmaSorusu: string;
  calismaBasligi?: string;
  kayitlar?: KayitOzeti[];
};

export type LiteraturSonucu = { bulgular: Bulgu[]; aramalar: string[] };

export const BAGLAM_BUTCESI = 9000;
const EN_FAZLA_ARAMA = 8;
const EN_UZUN_ARAMA = 200;

export const SISTEM_ISTEMI = `Sen akademik bir literatür tarama danışmanısın. Sana bir araştırma sorusu ve (varsa) araştırmacının şu ana kadar topladığı kaynakların listesi verilecek.

GÖREVİN İKİ PARÇA:
1. ARAMA STRATEJİSİ: Araştırmacının veri tabanlarına (Web of Science, Scopus, ERIC, Google Scholar, TR Dizin, YÖK Tez) yapıştırabileceği arama dizeleri üret. HER dizenin şu üç koşulu sağlaması ZORUNLUDUR:
   (a) Çok kelimeli her kavram TIRNAK içinde olacak — "blended learning", "matematik özyeterlik".
   (b) En az bir Boole operatörü (AND / OR) bulunacak ve HER OR grubu PARANTEZ içine alınacak. Parantez şart: veri tabanlarının çoğunda AND, OR'dan önce bağlar; "a" OR "b" AND "c" dizesi "a" OR ("b" AND "c") diye okunur ve ilk terimi geçen her şeyi döndürür.
   (c) Uygun yerlerde kök operatörü kullanılacak — "özyeterlik*", "achiev*".
   Anahtar kelimeleri yan yana dizmek YETERLİ DEĞİLDİR: veri tabanı bunu tam ifade araması olarak okumaz, binlerce alakasız sonuç döner. Dizeleri geniş taramadan dar taramaya sırala ve en az birini Türkçe gri literatüre ayır (TR Dizin, YÖK Tez).
2. LİSTE DENETİMİ: Verilen kaynak listesinde boşlukları göster — yıl dağılımı (yalnızca eski ya da yalnızca çok yeni kaynaklar), tek bir dergiye/yazara yığılma, yöntem çeşitliliğinin eksikliği, araştırma sorusuyla ilgisi zayıf görünen kayıtlar, ölçek/kuram kaynağının eksikliği. Liste verilmediyse bu bölümde tarama planını nasıl kuracağını anlat.

GÖREVİNİN SINIRI: Yalnızca araştırma sorusunu netleştirmeye ve arama terimi/dizesi üretmeye yardım edersin. Eser, yazar, kuramcı, ölçek sahibi ya da dergi ÖNERMEK görevin değildir. Bir boşluğu anlatırken kavram düzeyinde kal: "yalnızlık kuramlarına ilişkin kuramsal kaynaklar", "yalnızlık ölçeklerinin Türkçe uyarlamaları" — kimin yazdığını söyleme.

KESİNLİKLE YAPMAYACAKLARIN (en önemlisi budur):
1. KAYNAK ÖNERME. Hiçbir yazar adı, makale başlığı, dergi adı, yıl ya da DOI uydurma. "Şu çalışmaya bakın" deme. Var olduğunu bildiğini düşündüğün kaynakları, kuramcıları ve yazar çiftlerini (ör. "X & Y", "X vd.") bile yazma — kaynakları araştırmacı dizinden bulacak. Yalnızca araştırma sorusunda ya da toplanan kaynaklar listesinde ZATEN geçen adlara değinebilirsin.
2. Araştırmacının metnine yapıştırabileceği paragraf yazma. Denetlersin, yazmazsın.
3. Sana verilmeyen hiçbir sayıyı bulgu metninde kullanma. Kaç kaynağın eski olduğunu sayıyla değil sözle ifade et ("kaynakların çoğu", "birkaç kayıt").
4. Kaynakların bilimsel kalitesi ya da dergi itibarı hakkında yargı verme.

YANIT BİÇİMİ: Yalnızca şu JSON nesnesini döndür, başka hiçbir şey yazma:
{"aramalar":["arama dizesi"],"bulgular":[{"tur":"uyari","baslik":"kısa başlık","aciklama":"tek paragraf açıklama"}]}
- "aramalar": en fazla 6 arama dizesi, her biri tek satır, veri tabanına doğrudan yapıştırılabilir.
- "tur": ciddi bir boşluk için "uyari", iyileştirme için "oneri", yalnızca dikkat çekmek için "bilgi".
- "baslik": en fazla 60 karakter. "aciklama": en fazla 400 karakter, Türkçe.
- En fazla 8 bulgu.`;

/** Kayıt listesini modele kısa, okunur bir listeye çevirir. */
export function kayitOzeti(kayitlar: KayitOzeti[]): string {
  return kayitlar
    .map((kayit, sira) => {
      const kuyruk = [kayit.yazarlar, kayit.yil, kayit.yayin, kayit.tur].filter(Boolean).join(" · ");
      return `[${sira + 1}] ${kayit.baslik}${kuyruk ? ` (${kuyruk})` : ""}`;
    })
    .join("\n");
}

/** Modele gönderilecek mesajlar ve doğrulamada kaynak sayılacak metin. */
export function literaturIstemi(girdi: LiteraturGirdisi, butce = BAGLAM_BUTCESI) {
  const parcalar: BaglamParca[] = [
    { baslik: "Çalışma", metin: girdi.calisma ?? "", oncelik: 1 },
    { baslik: "Araştırma sorusu", metin: girdi.arastirmaSorusu, oncelik: 1 },
    { baslik: "Çalışma başlığı", metin: girdi.calismaBasligi ?? "", oncelik: 2 },
    { baslik: "Toplanan kaynaklar", metin: kayitOzeti(girdi.kayitlar ?? []), oncelik: 3 },
  ];
  const baglam = baglamKur(parcalar, butce);
  const mesajlar: Mesaj[] = [
    { rol: "sistem", metin: SISTEM_ISTEMI },
    ...cikisDiliMesaji(girdi.dil),
    { rol: "kullanici", metin: baglam.metin },
  ];
  return { mesajlar, kaynak: dilliKaynak(baglam.metin, girdi.dil), kirpilanlar: baglam.kirpilanlar };
}

/** Yanıttaki arama dizeleri ve bulgular. */
export function taramaCozumle(ham: string): LiteraturSonucu {
  const bulgular = bulgulariCozumle(ham);

  const veri = jsonOku(ham) as { aramalar?: unknown } | null;
  const aramalar = Array.isArray(veri?.aramalar)
    ? veri.aramalar
        .map((satir) => String(satir ?? "").replace(/\s+/g, " ").trim().slice(0, EN_UZUN_ARAMA))
        .filter(Boolean)
        .slice(0, EN_FAZLA_ARAMA)
    : [];

  return { bulgular, aramalar };
}

/**
 * Modelin kaynak uydurup uydurmadığına dair kaba bir işaret: künye biçimi
 * (Yazar, A. (2020). ya da "…" başlık) bulguda geçmemeli. Sayı denetimi
 * uydurma yılı yakalar ama uydurma yazar adını yakalayamaz; bu kontrol
 * istemin en kritik kuralını kodda da tutar.
 *
 * Regex lib/ai/bulgu.ts'te: belge geri bildirimi de aynı kontrolü düz metin
 * üzerinde yapıyor, iki kopya ilk düzeltmede ayrışırdı.
 */
export function kunyeIzi(sonuc: LiteraturSonucu): boolean {
  /*
    Yalnızca `aciklama` taranıyordu. İki alan açıkta kalmıştı:

    BAŞLIK — 60 karaktere kadar serbest metin ve "Şahin, A. (2021)" 16
    karakter. Başlığa yazılmış bir künye denetimden hiç geçmiyordu, oysa
    kullanıcıya ilk görünen alan başlıktır. Sayı denetimi (bulgulariDogrula)
    başlığı ve açıklamayı birleştirip tarıyor; iki denetim aynı çıktının
    farklı kısmına bakıyordu.

    ARAMA DİZELERİ — kullanıcı bunları veri tabanına yapıştırıyor. Sayı
    denetimi buraya bilerek uygulanmıyor ("2015..2025" meşru bir yıl
    filtresi) ama o gerekçe künyeye geçmez: arama dizesinde APA künye
    biçimi, olmayan bir çalışmayı varmış gibi göstermektir.

    Yanlış alarm riski düşük: desen "Soyad, A. (2020)" biçimini istiyor,
    hiçbir arama sözdizimi böyle yazılmıyor.
  */
  return (
    sonuc.bulgular.some((bulgu) => kunyeIziMetinde(`${bulgu.baslik} ${bulgu.aciklama}`)) ||
    sonuc.aramalar.some(kunyeIziMetinde)
  );
}

/*
  YAZAR ÖNERİSİ İZİ (RC06k, 17.11.2026). kunyeIzi yalnızca künye BİÇİMİNİ
  ("Soyad, A. (2020)", DOI) arıyor; yılı ve DOI'si olmayan yazar önerisi
  ondan geçiyordu. RC06k gerçek Haiku kabulünde bulgu metni şuydu:
  "…teorik temellerini açıklayan kaynaklar (Peplau & Perlman, Weiss vb.)
  eksiktir" — doğrulanmamış bir yazar önerisi, kullanıcıya sunuldu.

  Genel bir kişi adı yasağı KONMADI: araştırmacı sorusunda bir kuramcıyı
  anabilir ("Bandura'nın öz yeterlik kuramı…") ve toplanan kaynakların
  yazarları bağlamda zaten var; modelin onlara değinmesi meşru, liste
  denetiminin işi de bu ("tek yazara yığılma"). Ayrım şu: yalnızca YAZAR
  ÖNERİSİ BİÇİMİNDEKİ adlar aranır ve kullanıcının girdisinde (soru,
  çalışma, toplanan kaynaklar) geçmeyenler modelin eklediği sayılır.

  Biçimler bilerek dar: "Ad & Ad" ve "Ad et al. / vd. / ve ark.". "Ad ve
  Ad" ya da tek başına büyük harfli sözcük aranmıyor — "Türkçe ve
  İngilizce", "Scopus'ta" gibi doğal metinlerde yanlış alarm verirdi ve
  yanlış alarm, kullanıcıya doğru çalışan aracı bıraktırır.
*/
const AD = "[A-ZÇĞİÖŞÜ][a-zçğıöşüâîû]+(?:-[A-ZÇĞİÖŞÜ][a-zçğıöşüâîû]+)?";
const YAZAR_CIFTI = new RegExp(`(${AD})\\s*&\\s*(${AD})`, "gu");
const YAZAR_VD = new RegExp(`(${AD})\\s+(?:et al\\.?|vd\\.|ve ark\\.|ve arkadaşları)`, "gu");
/* Veri tabanı adları yazar değildir: "Web of Science & Scopus". */
const DIZIN_ADLARI = new Set(["science", "scopus", "scholar", "embase", "medline", "cochrane", "dizin", "tez", "proquest", "google"]);

const kucuk = (metin: string) => metin.toLocaleLowerCase("tr");

function girdideGecer(ad: string, girdi: string): boolean {
  const aranan = kucuk(ad);
  const metin = kucuk(girdi);
  let i = metin.indexOf(aranan);
  while (i !== -1) {
    const once = metin[i - 1] ?? " ";
    const sonra = metin[i + aranan.length] ?? " ";
    if (!/\p{L}/u.test(once) && !/\p{L}/u.test(sonra)) return true;
    i = metin.indexOf(aranan, i + 1);
  }
  return false;
}

/** Metinde modelin eklediği (girdide geçmeyen) yazar önerileri. */
export function eklenenYazarlar(metin: string, girdi: string): string[] {
  const bulunan: string[] = [];
  for (const m of metin.matchAll(YAZAR_CIFTI)) {
    const adlar = [m[1], m[2]];
    if (adlar.some((ad) => DIZIN_ADLARI.has(kucuk(ad)))) continue;
    if (adlar.some((ad) => !girdideGecer(ad, girdi))) bulunan.push(m[0]);
  }
  for (const m of metin.matchAll(YAZAR_VD)) {
    if (!DIZIN_ADLARI.has(kucuk(m[1])) && !girdideGecer(m[1], girdi)) bulunan.push(m[0]);
  }
  return bulunan;
}

/*
  Yazar önerisi taşıyan bulgu ve arama dizesi kullanıcıya SUNULMAZ; geri
  kalanı sunulur. Bütün cevabı düşürmek yerine ayıklamak bilinçli: aynı
  cevaptaki arama dizeleri ve öteki bulgular doğrulanabilir, kullanıcı onları
  çalıştırmadan önce görüyor; yazar önerisi ise tek bir bulguya bağlı.
  Hiçbir şey kalmazsa çağıran cevabı "kunye" nedeniyle reddeder.
*/
export function yazarOnerileriniAyikla(
  sonuc: LiteraturSonucu,
  girdi: string,
): { sonuc: LiteraturSonucu; ayiklanan: string[] } {
  const ayiklanan: string[] = [];
  const bulgular = sonuc.bulgular.filter((bulgu) => {
    const izler = eklenenYazarlar(`${bulgu.baslik} ${bulgu.aciklama}`, girdi);
    ayiklanan.push(...izler);
    return izler.length === 0;
  });
  const aramalar = sonuc.aramalar.filter((arama) => {
    const izler = eklenenYazarlar(arama, girdi);
    ayiklanan.push(...izler);
    return izler.length === 0;
  });
  return { sonuc: { bulgular, aramalar }, ayiklanan };
}
