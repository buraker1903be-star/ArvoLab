/*
  Asistanın altıncı yeteneği: MAKALE BÖLÜM DENETİMİ.

  Kullanıcı müsveddesinden bir bölüm seçer; asistan o bölümü makalenin
  türü, araştırma sorusu ve yöntemi bağlamında denetler: yöntem ile soru
  uyumlu mu, bulgular ile yorum ayrılmış mı, tartışma bulguların ötesine
  geçiyor mu, sonuç soruya dönüyor mu.

  Denetim listesi tür ve yönteme göre DEĞİŞİYOR (lib/makale/sablonlar.ts,
  YONTEM_DENETIMLERI): nitel bir çalışmada etki büyüklüğü, mühendislik
  makalesinde kod kitabı aranmaz. Ekranda da aynı liste gösteriliyor,
  kullanıcı asistanın neye baktığını biliyor.

  Asistan DENETLER, YAZMAZ (AGENTS.md): alternatif cümle, başlık, özet,
  kapak mektubu metni üretmez; neyin eksik olduğunu ve nedenini söyler.
  Bulgular ortak kanaldan okunur (lib/ai/bulgu.ts), sayı denetimi ve
  künye denetimi uygulanır. Kabul olasılığı ya da "bu dergiye uygun"
  hükmü YASAK: hiçbir veriyle doğrulanamaz.

  Saf modül; testi tests/unit/ai-makale-denetimi.test.ts.
*/

import { baglamKur, type BaglamParca } from "./baglam";
import type { Dil } from "@/lib/dil";
import { YANIT_BICIMI, cikisDiliMesaji, dilliKaynak } from "./bulgu";
import type { Mesaj } from "./saglayici";
import { MAKALE_TURLERI, YONTEM_DENETIMLERI, type BolumTuru, type MakaleTuru, type YontemAilesi, yontemDenetimi } from "@/lib/makale/sablonlar";

export const BAGLAM_BUTCESI = 14_000;

const BOLUM_DENETIMI: Record<BolumTuru | "genel", string[]> = {
  ozet: [
    "Amaç, yöntem, temel bulgu ve sonuç özette var mı",
    "Özette ana metinde olmayan bir iddia ya da bulgu var mı",
  ],
  giris: [
    "Araştırma problemi ve literatürdeki boşluk açık mı",
    "Amaç ya da araştırma sorusu girişin sonunda net mi",
    "Kaynak gerektiren ama atıfsız kalan iddialar (kaynak ÖNERME, yalnızca işaretle)",
  ],
  literatur: [
    "Çalışmalar tek tek özetleniyor mu, yoksa temalar halinde sentezleniyor mu",
    "Çelişen bulgular ele alınmış mı",
    "Literatürden araştırma sorusuna köprü kurulmuş mu",
  ],
  yontem: [
    "Yöntemin araştırma sorusuna uygunluğu ve bu uygunluğun gerekçesi",
    "Tekrarlanabilirlik için gereken bilgiler",
  ],
  model: [
    "Modelin araştırma sorusuna uygunluğu",
    "Tekrarlanabilirlik için gereken bilgiler",
  ],
  vaka: [
    "Olgu bilgilerinin sırası ve zaman çizelgesi",
    "Aydınlatılmış onam ve etik bilgisi",
  ],
  bulgular: [
    "Bulgular ile yorumun birbirinden ayrılması (yorum tartışmaya ait)",
    "Raporlanan sonuçların yöntemde tanımlanan analizlerle uyumu",
  ],
  tartisma: [
    "Bulguların ötesine geçen genellemeler ya da nedensellik iddiaları",
    "Literatürle karşılaştırmanın dengeli olması (yalnızca destekleyen çalışmaların anılması)",
    "Alternatif açıklamalar ve sınırlılıklar",
  ],
  sonuc: [
    "Sonucun araştırma sorusuna doğrudan dönmesi",
    "Sonuçta bulgularda olmayan yeni bir iddia ya da bulgu",
  ],
  kaynakca: ["Bu bölüm biçim denetimi için Kaynakça modülünü kullanın"],
  genel: [
    "Mantıksal akış ve paragraflar arası bağlantı",
    "Kavram ve terim tutarlılığı",
    "Kanıt gerektiren iddialar",
  ],
};

/*
  Aynı denetim listesinin İngilizcesi (28.10.2026): makale çalışma alanı
  listeyi öğrenciye de gösteriyor. İstem (sistemIstemi) Türkçe listeyi
  kullanmaya devam ediyor — AGENTS.md: istemler Türkçe kalır.
*/
const BOLUM_DENETIMI_EN: Record<BolumTuru | "genel", string[]> = {
  ozet: [
    "Does the abstract state the aim, method, main finding and conclusion",
    "Does the abstract contain a claim or finding not in the main text",
  ],
  giris: [
    "Are the research problem and the gap in the literature clear",
    "Is the aim or research question stated clearly at the end of the introduction",
    "Claims that need a source but have no citation (do NOT suggest sources, only flag them)",
  ],
  literatur: [
    "Are studies summarized one by one, or synthesized into themes",
    "Are conflicting findings addressed",
    "Is there a bridge from the literature to the research question",
  ],
  yontem: [
    "Fit of the method to the research question and the justification for it",
    "Information needed for replicability",
  ],
  model: [
    "Fit of the model to the research question",
    "Information needed for replicability",
  ],
  vaka: [
    "Order of case information and the timeline",
    "Informed consent and ethics information",
  ],
  bulgular: [
    "Separation of results from interpretation (interpretation belongs in the discussion)",
    "Consistency of reported results with the analyses defined in the method",
  ],
  tartisma: [
    "Generalizations or causal claims that go beyond the results",
    "Balanced comparison with the literature (not only citing supporting studies)",
    "Alternative explanations and limitations",
  ],
  sonuc: [
    "Does the conclusion return directly to the research question",
    "A new claim or finding in the conclusion that is not in the results",
  ],
  kaynakca: ["Use the Sources module to check the formatting of this section"],
  genel: [
    "Logical flow and links between paragraphs",
    "Consistency of concepts and terms",
    "Claims that require evidence",
  ],
};

export function denetimListesi(bolum: BolumTuru | null, aile: YontemAilesi | null, dil: Dil = "tr"): string[] {
  const liste = [...(dil === "en" ? BOLUM_DENETIMI_EN : BOLUM_DENETIMI)[bolum ?? "genel"]];
  if ((bolum === "yontem" || bolum === "model" || bolum === "bulgular") && aile) liste.push(...yontemDenetimi(aile, dil).maddeler);
  return liste;
}

export function sistemIstemi(tur: MakaleTuru, bolum: BolumTuru | null, aile: YontemAilesi | null): string {
  const tanim = MAKALE_TURLERI[tur];
  const liste = denetimListesi(bolum, aile).map((m) => `- ${m}`).join("\n");
  return `Sen akademik bir makale hakemi gibi çalışan bir denetçisin. Sana bir ${tanim.etiket.toLocaleLowerCase("tr-TR")} taslağından bir bölüm ve çalışmanın bağlamı (araştırma sorusu, tasarım, hedef dergi) verilecek.

GÖREVİN: Bölümü aşağıdaki noktalara göre denetlemek ve eksikleri göstermek.
${liste}

KESİNLİKLE YAPMAYACAKLARIN:
1. Araştırmacının metnine yapıştırabileceği hazır cümle, paragraf, başlık, özet ya da alternatif ifade YAZMA. Neyin eksik ya da sorunlu olduğunu ve neden önemli olduğunu söyle; cümlesini kurma. Sorunlu bir ifadeyi göstermek için bölümdeki kendi cümlesini kısaca anabilirsin.
2. Kaynak önerme: yazar, başlık, dergi, yıl ya da DOI yazma. Kaynak gerekiyorsa "bu iddia kaynak gerektiriyor" de.
3. Sana verilmeyen hiçbir sayıyı yazma; analiz sonucu tahmin etme.
4. Derginin makaleyi kabul edip etmeyeceği ya da kabul olasılığı hakkında hiçbir şey söyleme. Derginin güncel kurallarını bildiğini varsayma.
5. Bölümde olmayan bir şeyi varmış gibi değerlendirme; "verilen bölümde görünmüyor" de.

${YANIT_BICIMI}`;
}

export type MakaleDenetimGirdisi = {
  /** Kullanıcının arayüz dili: bulgular bu dilde yazılır (lib/ai/bulgu.ts, cikisDiliMesaji). */
  dil?: Dil;
  tur: MakaleTuru;
  bolumTuru: BolumTuru | null;
  aile: YontemAilesi | null;
  calisma?: string;
  arastirmaSorusu?: string | null;
  arastirmaProblemi?: string | null;
  tasarim?: string | null;
  hedefDergi?: string | null;
  bolumBasligi: string;
  bolumMetni: string;
  /** Tartışma ve sonuç denetiminde bulguların ötesine geçişi görmek için. */
  bulgularMetni?: string | null;
};

export function makaleIstemi(girdi: MakaleDenetimGirdisi, butce = BAGLAM_BUTCESI) {
  const parcalar: BaglamParca[] = [
    /* Tür bağlamda da yazılı: sistem istemi türe göre değişiyor ama
       eğitim kümesine temsilî tek istem gidiyor (egitim-kumesi/route.ts). */
    { baslik: "Makale türü", metin: MAKALE_TURLERI[girdi.tur].etiket, oncelik: 1 },
    { baslik: "Araştırma sorusu", metin: girdi.arastirmaSorusu ?? "", oncelik: 1 },
    { baslik: `Denetlenecek bölüm: ${girdi.bolumBasligi || "başlıksız"}`, metin: girdi.bolumMetni, oncelik: 1 },
    { baslik: "Araştırma problemi", metin: girdi.arastirmaProblemi ?? "", oncelik: 2 },
    { baslik: "Araştırma tasarımı", metin: girdi.tasarim ?? "", oncelik: 2 },
    { baslik: "Çalışma", metin: girdi.calisma ?? "", oncelik: 2 },
    { baslik: "Hedef dergi", metin: girdi.hedefDergi ?? "", oncelik: 3 },
    { baslik: "Bulgular bölümü (karşılaştırma için)", metin: girdi.bulgularMetni ?? "", oncelik: 4 },
  ];
  const baglam = baglamKur(parcalar, butce);
  const mesajlar: Mesaj[] = [
    { rol: "sistem", metin: sistemIstemi(girdi.tur, girdi.bolumTuru, girdi.aile) },
    ...cikisDiliMesaji(girdi.dil),
    { rol: "kullanici", metin: baglam.metin },
  ];
  return { mesajlar, kaynak: dilliKaynak(baglam.metin, girdi.dil), kirpilanlar: baglam.kirpilanlar };
}
