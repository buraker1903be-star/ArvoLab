/*
  LİTERATÜR BULGULARI: SABİT KODLAR + SUNUCU ŞABLONLARI (PR #105, 17.11.2026).

  Neden: literatür yeteneği bulguları serbest metin olarak yazıyordu ve
  modelin eklediği yazar/eser önerileri ("Peplau & Perlman, Weiss vb.",
  "Weiss'i okuyun") o metnin içinden kullanıcıya ulaşıyordu. Metni
  kalıplarla süzmek ya genel bir ad yasağına ya da büyüyen bir listeye
  varıyordu; her iki yol da doğru çalışan aracı bozar. Yapısal çözüm:
  model yalnızca bir KATEGORİ KODU (ve önem derecesi) seçer; kullanıcının
  gördüğü başlık ve açıklama buradaki iki dilli şablondan gelir. Modelin
  yazdığı hiçbir serbest metin bulgu olarak gösterilmez; bilinmeyen kod
  düşer.

  Bedeli: bulgular genelleşir ("kaynakların yıl dağılımı dengesiz
  görünüyor"); hangi kaydın eski olduğunu artık asistan söylemiyor,
  kullanıcı listesine bakıyor. Bilinçli tercih.

  KAPSAM SINIRI: bu güvence YALNIZCA bulgular içindir. Arama dizeleri
  hâlâ modelin serbest metnidir; onlar kunyeIzi ve yazar önerisi izinden
  geçer (lib/ai/literatur-taramasi.ts) ve o süzgeçlerin bilinen açıkları
  vardır. Bu modül bütün cevap için garanti DEĞİLDİR.

  Saf modül; testi tests/unit/literatur-bulgu.test.ts.
*/

import type { Dil, Metin } from "@/lib/dil";
import type { Bulgu, BulguTuru } from "./bulgu";

type Sablon = { tur: BulguTuru; baslik: Metin; aciklama: Metin };

/*
  Kodlar istemdeki liste denetimi başlıklarının ve RC06k'da gerçek modelin
  kendiliğinden ürettiği kategorilerin karşılığı. Şablonlarda HİÇBİR özel
  ad, sayı ya da eser adı yok (testi var): şablonun kendisi bir öneri
  taşımamalı. Veri tabanı adları (TR Dizin, YÖK Tez) sunucunun sabit
  metnidir, modelin değil.
*/
export const LITERATUR_SABLONLARI = {
  kaynak_tabani_dar: {
    tur: "uyari",
    baslik: { tr: "Kaynak tabanı dar", en: "Narrow source base" },
    aciklama: {
      tr: "Toplanan kaynaklar araştırma sorusunun kapsamına göre az görünüyor. Sorudaki her ana kavram için ayrı bir tarama yapın ve sonuçları birleştirin.",
      en: "The collected sources look few for the scope of the research question. Run a separate search for each main concept in the question and combine the results.",
    },
  },
  yil_dagilimi_eski: {
    tur: "uyari",
    baslik: { tr: "Kaynaklar ağırlıkla eski", en: "Sources are mostly older" },
    aciklama: {
      tr: "Listedeki kaynakların çoğu eski görünüyor. Güncel çalışmalar için tarama dizelerinize yıl süzgeci ekleyin; kuramsal temel için eski kaynakları ayrıca gerekçelendirin.",
      en: "Most sources in the list look older. Add a year filter to your search strings for recent work; justify older sources separately as theoretical background.",
    },
  },
  yil_dagilimi_yeni: {
    tur: "oneri",
    baslik: { tr: "Kaynaklar ağırlıkla çok yeni", en: "Sources are mostly very recent" },
    aciklama: {
      tr: "Listedeki kaynakların çoğu çok yeni görünüyor. Kavramların ilk tanımlandığı ve kuramsal çerçeveyi kuran çalışmaların da listede olup olmadığına bakın.",
      en: "Most sources in the list look very recent. Check whether the works that first defined the concepts and set the theoretical frame are also in the list.",
    },
  },
  dergi_yigilmasi: {
    tur: "uyari",
    baslik: { tr: "Tek dergiye yığılma", en: "Clustering in one journal" },
    aciklama: {
      tr: "Kaynakların önemli bir kısmı aynı dergiden geliyor gibi görünüyor. Farklı dergilerden ve dizinlerden tarama yaparak bakış açısını genişletin.",
      en: "A large share of the sources seem to come from the same journal. Broaden the perspective by searching other journals and indexes.",
    },
  },
  yazar_yigilmasi: {
    tur: "uyari",
    baslik: { tr: "Aynı yazara yığılma", en: "Clustering around one author" },
    aciklama: {
      tr: "Kaynakların önemli bir kısmı aynı yazar ya da ekipten geliyor gibi görünüyor. Farklı araştırma gruplarının çalışmalarını da tarayın.",
      en: "A large share of the sources seem to come from the same author or team. Also search for work by other research groups.",
    },
  },
  yontem_cesitliligi: {
    tur: "oneri",
    baslik: { tr: "Yöntem çeşitliliği az", en: "Little methodological variety" },
    aciklama: {
      tr: "Listedeki çalışmalar benzer yöntemleri kullanıyor gibi görünüyor. Nicel, nitel ve karma yöntemli çalışmalar için tarama dizelerine yöntem terimleri ekleyin.",
      en: "The studies in the list seem to use similar methods. Add method terms to your search strings to find quantitative, qualitative and mixed-methods studies.",
    },
  },
  ilgisi_zayif_kayit: {
    tur: "bilgi",
    baslik: { tr: "İlgisi zayıf görünen kayıtlar", en: "Records that look weakly related" },
    aciklama: {
      tr: "Listedeki bazı kayıtların araştırma sorusuyla bağı zayıf görünüyor. Dahil etme ölçütlerinizi yazın ve her kaydı bu ölçütlere göre gözden geçirin.",
      en: "Some records in the list look weakly related to the research question. Write down your inclusion criteria and review each record against them.",
    },
  },
  olcek_kaynagi_eksik: {
    tur: "uyari",
    baslik: { tr: "Ölçek kaynakları eksik", en: "Measurement sources missing" },
    aciklama: {
      tr: "Kullanacağınız ölçme araçlarının özgün geliştirme çalışmaları ve varsa Türkçe uyarlama çalışmaları listede görünmüyor. Bunları ölçek adıyla dizinde arayın.",
      en: "The original development studies of the instruments you will use, and any adaptation studies, don't appear in the list. Search for them in the index by instrument name.",
    },
  },
  kuram_kaynagi_eksik: {
    tur: "uyari",
    baslik: { tr: "Kuramsal çerçeve kaynakları eksik", en: "Theoretical framework sources missing" },
    aciklama: {
      tr: "Araştırma sorusundaki kavramların kuramsal temelini açıklayan kaynaklar listede görünmüyor. Kavram adlarını kuram ve model terimleriyle birlikte tarayın.",
      en: "Sources explaining the theoretical basis of the concepts in the research question don't appear in the list. Search the concept names together with theory and model terms.",
    },
  },
  gri_literatur: {
    tur: "oneri",
    baslik: { tr: "Türkçe gri literatür", en: "Turkish grey literature" },
    aciklama: {
      tr: "Türkiye'de yapılmış tezleri ve makaleleri YÖK Tez ve TR Dizin'de ayrıca tarayın; Türkçe anahtar kelimeleri İngilizce karşılıklarıyla birlikte kullanın.",
      en: "Also search YÖK Tez and TR Dizin for theses and articles from Turkey; use Turkish keywords together with their English equivalents.",
    },
  },
  disiplinler_arasi: {
    tur: "bilgi",
    baslik: { tr: "Disiplinler arası tarama", en: "Interdisciplinary search" },
    aciklama: {
      tr: "Konu birden fazla alanı ilgilendiriyor görünüyor. İlgili disiplinlerin dizinlerinde de tarama yapın ve disiplin süzgeçleriyle sonuçları daraltın.",
      en: "The topic seems to concern more than one field. Also search the indexes of related disciplines and narrow the results with discipline filters.",
    },
  },
  tarama_plani: {
    tur: "bilgi",
    baslik: { tr: "Tarama planı", en: "Search plan" },
    aciklama: {
      tr: "Önce geniş bir dizeyle tarayın, sonra dahil etme ve hariç tutma ölçütleriyle daraltın. Her turda kaç kayıt bulduğunuzu ve kaçını neden elediğinizi not edin.",
      en: "Search with a broad string first, then narrow with inclusion and exclusion criteria. Note in each round how many records you found and why you excluded them.",
    },
  },
} as const satisfies Record<string, Sablon>;

export type LiteraturKodu = keyof typeof LITERATUR_SABLONLARI;
export const LITERATUR_KODLARI = Object.keys(LITERATUR_SABLONLARI) as LiteraturKodu[];

/** Kullanıcıya giden bulgu: şablondan çizilmiş metin + kaynağı olan kod. */
export type LiteraturBulgusu = Bulgu & { kod: LiteraturKodu };

const EN_FAZLA = 8;
const kodMu = (deger: unknown): deger is LiteraturKodu =>
  typeof deger === "string" && Object.prototype.hasOwnProperty.call(LITERATUR_SABLONLARI, deger);
const turMu = (deger: unknown): deger is BulguTuru => deger === "uyari" || deger === "oneri" || deger === "bilgi";

/** Kod + (geçerliyse) modelin önem derecesi → şablondan çizilmiş bulgu. */
export function literaturBulgusu(kod: LiteraturKodu, tur: unknown, dil: Dil = "tr"): LiteraturBulgusu {
  const sablon: Sablon = LITERATUR_SABLONLARI[kod];
  return { kod, tur: turMu(tur) ? tur : sablon.tur, baslik: sablon.baslik[dil], aciklama: sablon.aciklama[dil] };
}

/*
  Kod listesinden bulgular. Hem modelin cevabı hem kayıtlı cevaplar buradan
  geçer: yalnızca `kod` ve `tur` okunur; satırdaki başka her alan (modelin
  ya da eski kaydın serbest başlık/açıklaması) yok sayılır. Bilinmeyen ya da
  eksik kod düşer, yinelenen kod bir kez gösterilir.
*/
export function literaturBulgulari(liste: unknown, dil: Dil = "tr"): { bulgular: LiteraturBulgusu[]; dusen: number } {
  if (!Array.isArray(liste)) return { bulgular: [], dusen: 0 };
  const gorulen = new Set<LiteraturKodu>();
  const bulgular: LiteraturBulgusu[] = [];
  let dusen = 0;
  for (const satir of liste) {
    const kod = (satir as { kod?: unknown } | null)?.kod;
    if (!kodMu(kod)) {
      dusen += 1;
      continue;
    }
    if (gorulen.has(kod)) continue;
    gorulen.add(kod);
    bulgular.push(literaturBulgusu(kod, (satir as { tur?: unknown }).tur, dil));
  }
  return { bulgular: bulgular.slice(0, EN_FAZLA), dusen };
}

/** İstemde modele verilen kod listesi; şablonla aynı kaynaktan, kopyası tutulmaz. */
export function kodListesiIstemi(): string {
  return LITERATUR_KODLARI.map((kod) => `- ${kod}: ${LITERATUR_SABLONLARI[kod].baslik.tr}`).join("\n");
}
