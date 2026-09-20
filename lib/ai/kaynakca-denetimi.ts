/*
  Asistanın ikinci yeteneği: kaynakçayı DENETLER.

  Neden asistan: mekanik denetim zaten var (lib/apa7.ts ayrıştırıyor,
  lib/academic-reference-verification.ts Crossref/OpenAlex'te arıyor). Onun
  söyleyemediği üç şey var:
    - "Bulunamadı" her zaman hata değildir. Türkçe bir tez, kurum raporu ya
      da yerel dergi bu dizinlerde yoktur; asistan beklenen yoklukla gerçek
      şüpheyi ayırır. Aksi halde kullanıcı 25 kırmızı satır görüp hepsini
      görmezden gelmeyi öğreniyor.
    - Ayrıştırıcının göremediği biçim hataları (baş harf düzeni, "ve"/"&",
      basım yeri, cilt-sayı yazımı).
    - Önceliklendirme: jüri için hangisi gerçekten sorun.
    - ATIF–KAYNAKÇA UYUMU: mekanik karşılaştırma (lib/apa7.ts) yazar
      anahtarı ve yılın TAM eşleşmesini arıyor. Metinde "Demir (2020)",
      kaynakçada "Demir, A. (2021)" yazıyorsa bunu iki ayrı sorun olarak
      raporluyor — "karşılıksız atıf" ve "atıfsız kaynak". Oysa tek bir
      sorun var: yıl tutmuyor. Asistan bu ikilileri eşleştirir. Aynı şey
      yazım farkları (Yılmaz/Yilmaz), "vd."/"et al." kullanımı ve aynı
      yazarın aynı yıldaki iki kaynağı (2020a/2020b) için de geçerli.

  Sınır aynı: DENETLER, YAZMAZ. Düzeltilmiş kaynakça satırı ürettirmiyoruz —
  hem "yazmaz" kuralını çiğner hem de uydurmanın en kolay olduğu yer orasıdır
  (var olmayan DOI, yanlış cilt numarası). Sayı denetimi (lib/ai/bulgu.ts)
  uydurulan yılı ve numarayı yakalar; uydurulmuş bir yazar adını yakalayamaz,
  bu yüzden kural istem seviyesinde de yazılı.

  Saf modül; testi tests/unit/ai-kaynakca-denetimi.test.ts.
*/

import { baglamKur, type BaglamParca } from "./baglam";
import { YANIT_BICIMI } from "./bulgu";
import type { Mesaj } from "./saglayici";

export type KaynakDurumu = "verified" | "possible_match" | "not_found" | "insufficient_data";

export type KaynakSatiri = {
  sira: number;
  ham: string;
  durum: KaynakDurumu;
  /** Ayrıştırıcının bulduğu biçim sorunları (lib/apa7.ts). */
  bicimSorunlari?: string[];
  /** Dizinde bulunan en iyi eşleşmenin başlığı; "olası eşleşme" ayrımı için. */
  eslesmeBasligi?: string | null;
};

export type KaynakcaGirdisi = {
  /** Bağlı akademik çalışmanın künyesi (lib/ai/calisma-baglami.ts). */
  calisma?: string;
  kaynaklar: KaynakSatiri[];
  /** Metinde geçip kaynakçada olmayan atıflar. */
  eksikKaynaklar?: string[];
  /** Kaynakçada olup metinde hiç atıf yapılmayanlar. */
  kullanilmayanKaynaklar?: string[];
  /** Metindeki bütün atıflar; eşleştirme bunlarsız yapılamaz. */
  atiflar?: string[];
};

export const BAGLAM_BUTCESI = 9000;

const DURUM_ETIKETI: Record<KaynakDurumu, string> = {
  verified: "dizinde doğrulandı",
  possible_match: "olası eşleşme",
  not_found: "dizinde bulunamadı",
  insufficient_data: "ayrıştırılamadı (veri yetersiz)",
};

export const SISTEM_ISTEMI = `Sen APA 7 kaynakça denetçisisin. Sana bir araştırmacının kaynakça listesi, her kaydın dizin (Crossref/OpenAlex) sonucu ve metin içi atıf tutarsızlıkları verilecek.

GÖREVİN: Listeyi denetlemek ve gerçekten sorun olanları önceliklendirmek.
- "dizinde bulunamadı" tek başına hata değildir: Türkçe tezler, kurum raporları, kitap bölümleri ve yerel dergiler bu dizinlerde çoğu zaman yer almaz. Böyle kayıtlar için beklenen bir durum olduğunu söyle, şüpheyi gerçekten tuhaf olanlara sakla (ör. uluslararası bir dergi makalesi gibi görünüp bulunamayan kayıt).
- "olası eşleşme" kayıtlarında kullanıcıyı neyin kontrol etmesi gerektiğini söyle (yıl, cilt, yazar sırası gibi ALANIN ADINI söyle, değerini yazma).
- APA 7 biçim hatalarını grupla: aynı hata 10 kayıtta varsa tek bir bulgu yaz, kaç kayıtta olduğunu sayı olarak değil "birden çok kayıtta" diye belirt.
- Metinde geçip kaynakçada olmayan atıflar en ciddi sorundur; varsa ilk bulgu o olsun.

ATIF–KAYNAKÇA UYUMU (bu denetimi mutlaka yap):
Sana verilen "karşılıksız atıf" ve "atıfsız kaynak" listeleri mekanik karşılaştırmadan geliyor; yazar ve yılın TAM eşleşmesini arıyor. İki listeyi yan yana koy ve aynı kaynağı gösteren ikilileri eşleştir:
- Yıl tutmuyor (metinde bir yıl, kaynakçada başka bir yıl): tek bir sorundur, iki ayrı değil. Hangisinin doğru olduğunu SÖYLEME, kaynağın aslından doğrulanması gerektiğini söyle.
- Yazar adı yazım farkı (Türkçe karakter, çift soyadı, kurum adı kısaltması).
- Metinde "vd."/"et al." kullanılmış ama kaynakçadaki yazar sayısı bu kullanımı gerektirmiyor ya da tersi.
- Aynı yazarın aynı yıldaki birden çok kaynağı: kaynakçada 2020a/2020b ayrımı yapılmamışsa metindeki atıf hangisini gösterdiği belirsiz kalır.
- Eşleşmeyi kuramadığın atıf gerçekten eksik kaynaktır; bunu ayrı bir bulguda topla.
Eşleştirmede emin değilsen "aynı kaynak olabilir, kontrol edin" de; kesinmiş gibi yazma.

KESİNLİKLE YAPMAYACAKLARIN:
1. Düzeltilmiş kaynakça satırı YAZMA. Kullanıcının kopyalayıp yapıştırabileceği hiçbir künye üretme; neyin yanlış olduğunu söyle, doğrusunu yazma.
2. DOI, yıl, cilt, sayı, sayfa aralığı ya da yazar adı UYDURMA. Sana verilmeyen hiçbir künye bilgisini "doğrusu şu" diye yazma; bilmiyorsan "kaynağın aslından doğrulayın" de.
3. Sana verilmeyen hiçbir sayı yazma. Kaç kayıtta sorun olduğunu sayıyla değil sözle ifade et.
4. Kaynakların bilimsel kalitesi, dergi itibarı ya da güncelliği hakkında yorum yapma; görevin biçim ve tutarlılık denetimi.

${YANIT_BICIMI}`;

/** Kaynak listesini modele okunur, kısa bir tabloya çevirir. */
export function kaynakOzeti(kaynaklar: KaynakSatiri[]): string {
  return kaynaklar
    .map((kaynak) => {
      const parcalar = [`[${kaynak.sira}] ${DURUM_ETIKETI[kaynak.durum]}`];
      if (kaynak.eslesmeBasligi) parcalar.push(`dizindeki başlık: ${kaynak.eslesmeBasligi}`);
      if (kaynak.bicimSorunlari?.length) parcalar.push(`biçim: ${kaynak.bicimSorunlari.join("; ")}`);
      return `${parcalar.join(" · ")}\n${kaynak.ham}`;
    })
    .join("\n\n");
}

/** Modele gönderilecek mesajlar ve doğrulamada kaynak sayılacak metin. */
export function kaynakcaIstemi(girdi: KaynakcaGirdisi, butce = BAGLAM_BUTCESI) {
  const parcalar: BaglamParca[] = [
{ baslik: "Çalışma", metin: girdi.calisma ?? "", oncelik: 1 },
        {
      baslik: "Metinde geçip kaynakçada olmayan atıflar",
      metin: (girdi.eksikKaynaklar ?? []).join("\n"),
      oncelik: 1,
    },
    // Eşleştirme bu iki listeyi yan yana koymayı gerektiriyor; ikisi de
    // kaynak künyelerinden önce gelir, yoksa uyum denetimi hiç yapılamaz.
    {
      baslik: "Kaynakçada olup metinde atıf yapılmayanlar",
      metin: (girdi.kullanilmayanKaynaklar ?? []).join("\n"),
      oncelik: 1,
    },
    { baslik: "Metindeki bütün atıflar", metin: (girdi.atiflar ?? []).join(", "), oncelik: 2 },
    { baslik: "Kaynakça ve dizin sonuçları", metin: kaynakOzeti(girdi.kaynaklar), oncelik: 3 },
  ];
  const baglam = baglamKur(parcalar, butce);
  const mesajlar: Mesaj[] = [
    { rol: "sistem", metin: SISTEM_ISTEMI },
    { rol: "kullanici", metin: baglam.metin },
  ];
  return { mesajlar, kaynak: baglam.metin, kirpilanlar: baglam.kirpilanlar };
}
