/*
  Asistanın ilk yeteneği: istatistik çıktısını DENETLER.

  Sınır (kullanıcının koyduğu kural): asistan yazmaz, denetler ve düzeltme
  önerir. Yani "Tartışma bölümünüz şöyle olmalı" diye paragraf üretmez;
  "etki büyüklüğü raporlanmamış, APA 7 bunu zorunlu tutar" der. Yorum,
  bulgunun ne anlama geldiği değil, nasıl raporlandığı ve neyin eksik
  olduğu üzerinedir.

  İkinci sınır: uydurma sayı yasak. Modelin ürettiği her sayı gönderilen
  bağlamda geçmek zorunda (lib/ai/sayi-denetimi.ts). Geçmiyorsa cevap
  kullanıcıya hiç gösterilmez — akademik metinde uydurma bir p değeri,
  yanlış bir cümleden çok daha ağır bir hatadır.

  Saf modül: istem kurma, çözümleme ve doğrulama burada, ağ çağrısı
  lib/ai/saglayici.ts'te. Testi tests/unit/ai-analiz-yorumu.test.ts.
*/

import { baglamKur, type BaglamParca } from "./baglam";
import { YANIT_BICIMI } from "./bulgu";
import type { Mesaj } from "./saglayici";

// Çözümleme ve uydurma sayı denetimi bütün yeteneklerde ortak (lib/ai/bulgu.ts);
// çağıranlar tek yerden alsın diye buradan da veriliyor.
export { bulgulariCozumle, bulgulariDogrula, type Bulgu, type BulguTuru } from "./bulgu";

export type YorumGirdisi = {
  /** Bağlı akademik çalışmanın künyesi (lib/ai/calisma-baglami.ts). */
  calisma?: string;
  /** Kullanıcının yapıştırdığı ham çıktı (SPSS, R, Jamovi…). */
  istatistikMetni: string;
  /** detectStatistics'in ürettiği APA satırları: doğrulanmış sayı kaynağı. */
  apaSatirlari?: string[];
  arastirmaSorusu?: string;
  orneklem?: string;
  yontem?: string;
};

export const BAGLAM_BUTCESI = 9000;

export const SISTEM_ISTEMI = `Sen akademik bir istatistik denetçisisin. Sana bir araştırmacının analiz çıktısı ve çalışmasının kısa bağlamı verilecek.

GÖREVİN: Raporlamayı denetlemek ve eksikleri göstermek. Bakacağın tipik noktalar:
- Etki büyüklüğü raporlanmış mı (Cohen's d, η², r); APA 7 bunu zorunlu tutar.
- Serbestlik derecesi, örneklem büyüklüğü ve test adı eksiksiz mi.
- p değeri biçimi doğru mu (p < .001, baştaki sıfır yok).
- Anlamlılık eşiğe çok yakınsa ya da örneklem küçükse bulgunun kırılganlığı.
- Çok sayıda test yapılmışsa çoklu karşılaştırma düzeltmesinden söz edilmiş mi.
- Testin varsayımlarına (normallik, varyans homojenliği) değinilmiş mi.
- Raporlanan değerler birbiriyle tutarlı mı.

KESİNLİKLE YAPMAYACAKLARIN:
1. Araştırmacının metnine yapıştırabileceği hazır cümle veya paragraf YAZMA. Neyin eksik olduğunu ve neden önemli olduğunu söyle, cümlesini kurma.
2. Bulgunun kuramsal anlamını yorumlama ("bu, X kuramını destekler" gibi). Bu araştırmacının ve danışmanının işidir.
3. Sana verilmeyen HİÇBİR SAYI yazma. Etki büyüklüğü hesaplama, eksik bir değeri tahmin etme, örnek değer uydurma. Bir sayıya ihtiyaç duyuyorsan onu sayı olarak değil, adıyla an ("etki büyüklüğü", "örneklem büyüklüğü").
4. Emin olmadığın bir eksikliği kesinmiş gibi yazma; "verilen çıktıda görünmüyor" de.

${YANIT_BICIMI}`;

/** Modele gönderilecek mesajlar ve doğrulamada kaynak sayılacak metin. */
export function analizIstemi(girdi: YorumGirdisi, butce = BAGLAM_BUTCESI) {
  const parcalar: BaglamParca[] = [
    { baslik: "Çalışma", metin: girdi.calisma ?? "", oncelik: 1 },
    { baslik: "Analiz çıktısı", metin: girdi.istatistikMetni, oncelik: 1 },
    { baslik: "Tespit edilen istatistikler (APA 7)", metin: (girdi.apaSatirlari ?? []).join("\n"), oncelik: 1 },
    { baslik: "Araştırma sorusu", metin: girdi.arastirmaSorusu ?? "", oncelik: 2 },
    { baslik: "Örneklem", metin: girdi.orneklem ?? "", oncelik: 2 },
    { baslik: "Yöntem notu", metin: girdi.yontem ?? "", oncelik: 3 },
  ];
  const baglam = baglamKur(parcalar, butce);
  const mesajlar: Mesaj[] = [
    { rol: "sistem", metin: SISTEM_ISTEMI },
    { rol: "kullanici", metin: baglam.metin },
  ];
  // Doğrulama gönderilen metne göre yapılır: modelin görmediği bir sayıyı
  // "biliyor" saymak, kırpılan bölümden gelen tesadüfi eşleşmeyi meşru
  // gösterirdi.
  return { mesajlar, kaynak: baglam.metin, kirpilanlar: baglam.kirpilanlar };
}
