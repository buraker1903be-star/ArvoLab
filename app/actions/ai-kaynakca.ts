"use server";

import { aiHataMesaji, aiYapilandirildi, sor } from "@/lib/ai/saglayici";
import { aktifDil, ceviri } from "@/lib/dil-sunucu";
import { asistanHakkiVar, asistanKapisi } from "@/lib/ai/erisim";
import { bulgulariCozumle, bulgulariDogrula, type Bulgu, bosListeMi } from "@/lib/ai/bulgu";
import { kaynakcaIstemi, ulasilamadiHukmunuAyikla, yapisalKaynaklar, type KaynakDurumu, type KaynakSatiri } from "@/lib/ai/kaynakca-denetimi";
import { asistanKaydet } from "@/lib/ai/kayit";
import { oncekiCevap } from "@/lib/ai/gecmis";
import { calismaBaglami } from "@/lib/ai/calisma-baglami";

/*
  Asistanın kaynakça denetimi. Mekanik denetimin (lib/apa7.ts +
  lib/academic-reference-verification.ts) sonuçlarını alır; yeniden dizin
  sorgusu yapmaz. Kapılar ortak (lib/ai/erisim.ts).
*/

const EN_UZUN_KAYNAK = 600;
const EN_FAZLA_KAYNAK = 60;
const EN_FAZLA_LISTE = 40;
const EN_FAZLA_ATIF = 120;
/* Bilinmeyen durum "veri yetersiz" sayılıyor; "ulasilamadi" listede olmalı,
   yoksa geçici erişim sorunu modele başka bir şey gibi giderdi. */
const DURUMLAR = new Set<KaynakDurumu>(["verified", "possible_match", "not_found", "insufficient_data", "ulasilamadi"]);

export type KaynakcaDenetimGirdisi = {
  /** Bağlı akademik çalışma (isteğe bağlı). */
  projectId?: string | null;
  /** true: kayıtlı cevap atlanır, modele yeniden sorulur. */
  zorla?: boolean;
  kaynaklar: KaynakSatiri[];
  eksikKaynaklar?: string[];
  kullanilmayanKaynaklar?: string[];
  /** Metindeki bütün atıflar (ham); atıf–kaynakça eşleştirmesi için. */
  atiflar?: string[];
};

export type KaynakcaDenetimYaniti = {
  hata?: string;
  /** Hata olmayan, gösterilecek bulgusu kalmamış sonuç (AsistanSonucVerisi.bilgi). */
  bilgi?: string;
  /** Deneme hakkı bitti: hata kutusunda Abonelik düğmesi (lib/ai/erisim.ts). */
  odemeGerekli?: boolean;
  bulgular?: Bulgu[];
  kirpilanlar?: string[];
  /** Kredi azalıyorsa kullanıcıya gösterilecek not (lib/ai/erisim.ts). */
  krediUyarisi?: string;
  model?: string;
  /** Çalışma kaydının kimliği; kullanıcı buna puan veriyor. */
  kayitId?: string | null;
  /** Kayıtlı cevap gösterildi: model çağrılmadı, hak yanmadı. */
  kayitliCevap?: { tarih: string } | null;
  /**
   * Dizine ulaşılamayan künyeler hakkında hüküm kurduğu için gösterilmeyen
   * bulgu sayısı (lib/ai/kaynakca-denetimi.ts, ulasilamadiHukmunuAyikla).
   */
  ayiklananSayisi?: number;
};

const kisalt = (deger: unknown, sinir: number) => String(deger ?? "").slice(0, sinir).trim();
const liste = (deger: string[] | undefined, adet: number, sinir: number) =>
  (deger ?? []).slice(0, adet).map((satir) => kisalt(satir, sinir)).filter(Boolean);

export const kaynakcaAsistaniAcik = async () => aiYapilandirildi();

/*
  Bütün bulgular ulaşılamayan künyeler hakkında hüküm kurduysa gösterilen
  metin. `bilgi` olarak döner, `hata` olarak değil (Phase 5.1a, 13.11.2026):
  eskiden kırmızı hata kutusunda ve role="alert" ile gösteriliyordu, oysa
  bozulan bir şey yok. Kayıt davranışı aynı: çalışma "rejected" yazılır,
  kredi düşmez, saatlik hak model çağrısından önce zaten kullanılmıştır.
*/
const hukumBilgisi = (t: Awaited<ReturnType<typeof ceviri>>) =>
  t({
    tr: "Asistanın bulguları, dizinlerine ulaşılamayan kaynaklar hakkında doğrulanmamış hüküm içerdiği için gösterilmedi. Dizinler yanıt verdiğinde denetimi yeniden çalıştırabilirsiniz.",
    en: "The assistant's findings weren't shown because they made unverified claims about sources whose indexes couldn't be reached. You can run the check again once the indexes respond.",
  });

export async function kaynakcaDenetle(girdi: KaynakcaDenetimGirdisi): Promise<KaynakcaDenetimYaniti> {
  // Girdi istemciden geliyor: uzunluk ve durum değerleri burada sınırlanır,
  // yoksa istem gövdesi serbestçe şişirilebilir.
  const kaynaklar = (girdi.kaynaklar ?? []).slice(0, EN_FAZLA_KAYNAK).map((kaynak, sira) => ({
    sira: Number.isFinite(kaynak?.sira) ? Number(kaynak.sira) : sira + 1,
    ham: kisalt(kaynak?.ham, EN_UZUN_KAYNAK),
    durum: DURUMLAR.has(kaynak?.durum) ? kaynak.durum : ("insufficient_data" as KaynakDurumu),
    bicimSorunlari: liste(kaynak?.bicimSorunlari, 8, 200),
    eslesmeBasligi: kaynak?.eslesmeBasligi ? kisalt(kaynak.eslesmeBasligi, 300) : null,
  }));
  const t = await ceviri();
  const dil = await aktifDil();
  if (!kaynaklar.some((kaynak) => kaynak.ham)) return { hata: t({ tr: "Denetlenecek kaynak bulunamadı.", en: "No sources to check were found." }) };

  const kapi = await asistanKapisi(dil);
  if (!kapi.ok) return { hata: kapi.hata, odemeGerekli: kapi.odemeGerekli };

  /*
    Çalışma bağlamı: atıf stili, araştırma yöntemi ve tür. Bunları bilmeden
    verilen denetim genel kalıyordu — APA beklenen yerde Vancouver kuralı,
    nitel çalışmada etki büyüklüğü. Erişim RLS'e tabi: yabancı bir çalışmanın
    kimliği gönderilse satır dönmez, kayıt da ona iliştirilemez.
  */
  const calisma = await calismaBaglami(girdi.projectId);

  const { mesajlar, kaynak, kirpilanlar } = kaynakcaIstemi({
    calisma: calisma?.metin,
    /* Sistem istemi stili ADIYLA söylüyor; bağlam metnindeki satır
       modelin kimliğini ezmiyordu (lib/ai/kaynakca-denetimi). */
    atifStili: calisma?.atifStili ?? null,
    dil,
    kaynaklar,
    eksikKaynaklar: liste(girdi.eksikKaynaklar, EN_FAZLA_LISTE, 300),
    kullanilmayanKaynaklar: liste(girdi.kullanilmayanKaynaklar, EN_FAZLA_LISTE, EN_UZUN_KAYNAK),
    // Aynı atıf metinde onlarca kez geçebiliyor; tekrarı göndermek bütçeyi
    // yiyor ve eşleştirmeye hiçbir şey katmıyor.
    atiflar: [...new Set(liste(girdi.atiflar, 300, 120))].slice(0, EN_FAZLA_ATIF),
  });

  /*
    Aynı bağlam daha önce sorulduysa modele gidilmez. Aynı analizi ikinci kez
    denetletmek kimseye bir şey kazandırmıyor: kullanıcı bekliyor, hesaptan
    para çıkıyor, cevap zaten kayıtlı. Kullanıcı "yeniden sorgula" ile
    zorlayabilir.
  */
  if (!girdi.zorla) {
    const onceki = await oncekiCevap(kapi.kullaniciId, "kaynakca", kaynak);
    if (onceki) {
      /* Kayıtlı cevap da aynı son doğrulamadan geçer: bu kural gelmeden
         önce kaydedilmiş bir cevap ulaşılamayan künye için hüküm taşıyabilir.
         Kayıtta "kaynaklar" alanı yok; yalnızca metindeki [n] okunur. */
      const ayiklama = ulasilamadiHukmunuAyikla(onceki.bulgular, kaynaklar);
      if (ayiklama.ayiklanan.length && !ayiklama.gecerli.length) return { bilgi: hukumBilgisi(t), kirpilanlar };
      return {
        krediUyarisi: kapi.uyari ?? undefined,
        bulgular: ayiklama.gecerli,
        kirpilanlar,
        kayitId: onceki.id,
        kayitliCevap: { tarih: onceki.created_at },
        ...(ayiklama.ayiklanan.length ? { ayiklananSayisi: ayiklama.ayiklanan.length } : {}),
      };
    }
  }

  // Hak yalnızca modele gidilecekse yanar.
  const hakHatasi = await asistanHakkiVar(kapi.kullaniciId, dil);
  if (hakHatasi) return { hata: hakHatasi };

  const basladi = Date.now();

  try {
    const yanit = await sor(mesajlar, { yetenek: "kaynakca", jsonBekle: true, sicaklik: 0.1, enFazlaJeton: 3000 });
    const bulgular = bulgulariCozumle(yanit.metin);
    /* Bilerek boş liste: denetlenen metinde işaretlenecek bir şey yok. Hata değil, sonuç. */
    if (!bulgular.length && bosListeMi(yanit.metin)) {
      const kayitId = await asistanKaydet({ kullaniciId: kapi.kullaniciId, calismaId: calisma?.id ?? null, yetenek: "kaynakca", durum: "completed", model: yanit.model, baglam: kaynak, cikti: yanit.metin, bulgular, basladi });
      return { krediUyarisi: kapi.uyari ?? undefined, bulgular, kirpilanlar, model: yanit.model, kayitId };
    }
    if (!bulgular.length) {
      await asistanKaydet({ kullaniciId: kapi.kullaniciId, calismaId: calisma?.id ?? null, yetenek: "kaynakca", durum: "rejected", redNedeni: "bos", model: yanit.model, baglam: kaynak, cikti: yanit.metin, basladi });
      return { hata: t({ tr: "Asistan kaynakçada denetlenecek bir şey bulamadı.", en: "The assistant found nothing to check in the reference list." }), kirpilanlar };
    }

    /*
      Uydurma sayı denetimi: kaynakçada en sık uydurulan şey yıl, cilt, sayı
      ve sayfa aralığıdır. Bir tanesi bile bağlamda geçmiyorsa cevabın
      tamamı düşer — kullanıcı hangisinin uydurma olduğunu ayıklayamaz.
    */
    const dogrulama = bulgulariDogrula(bulgular, kaynak, { dil });
    if (!dogrulama.gecti) {
      console.error("[ai] kaynakça denetimi uydurma sayı içerdi", { model: yanit.model, uydurulan: dogrulama.uydurulan });
      await asistanKaydet({ kullaniciId: kapi.kullaniciId, calismaId: calisma?.id ?? null, yetenek: "kaynakca", durum: "rejected", redNedeni: "uydurma_sayi", model: yanit.model, baglam: kaynak, cikti: yanit.metin, bulgular, basladi });
      return {
        hata: t({
          tr: "Asistan verilmeyen künye bilgileri ürettiği için cevap gösterilmedi. Bu bir güvenlik kontrolüdür; tekrar deneyebilirsiniz.",
          en: "The response wasn't shown because the assistant produced reference details that weren't provided. This is a safety check; you can try again.",
        }),
        kirpilanlar,
      };
    }

    /*
      Ulaşılamayan künye hakkında hüküm (T1): sayı denetiminden SONRA, çünkü
      o denetim cevabın tamamına bakıyor — ayıklanacak bir bulgudaki uydurma
      sayı da cevabı düşürmeli. Ham çıktı kayda aynen gider ("output");
      "findings" kullanıcıya gösterilen doğrulanmış bulgulardır.
    */
    const ayiklama = ulasilamadiHukmunuAyikla(bulgular, kaynaklar, yapisalKaynaklar(yanit.metin));
    if (ayiklama.ayiklanan.length) {
      console.error("[ai] kaynakça denetimi ulaşılamayan künye için hüküm içerdi", { model: yanit.model, ayiklanan: ayiklama.ayiklanan.length, kalan: ayiklama.gecerli.length });
    }
    if (ayiklama.ayiklanan.length && !ayiklama.gecerli.length) {
      /* Gösterilecek doğrulanmış bulgu kalmadı: cevap düşer. Red nedeni
         boş bırakılıyor; yeni bir neden migration ister (reject_reason
         kısıtı) ve "rejected" zaten kredi düşürmüyor. */
      await asistanKaydet({ kullaniciId: kapi.kullaniciId, calismaId: calisma?.id ?? null, yetenek: "kaynakca", durum: "rejected", model: yanit.model, baglam: kaynak, cikti: yanit.metin, bulgular: [], basladi });
      return { bilgi: hukumBilgisi(t), kirpilanlar };
    }

    const kayitId = await asistanKaydet({ kullaniciId: kapi.kullaniciId, calismaId: calisma?.id ?? null, yetenek: "kaynakca", durum: "completed", model: yanit.model, baglam: kaynak, cikti: yanit.metin, bulgular: ayiklama.gecerli, basladi });
    return {
      krediUyarisi: kapi.uyari ?? undefined,
      bulgular: ayiklama.gecerli,
      kirpilanlar,
      model: yanit.model,
      kayitId,
      ...(ayiklama.ayiklanan.length ? { ayiklananSayisi: ayiklama.ayiklanan.length } : {}),
    };
  } catch (hata) {
    const mesaj = aiHataMesaji(hata, dil) ?? t({ tr: "Asistan yanıt veremedi.", en: "The assistant couldn't respond." });
    console.error("[ai] kaynakça denetimi başarısız", mesaj);
    await asistanKaydet({ kullaniciId: kapi.kullaniciId, calismaId: calisma?.id ?? null, yetenek: "kaynakca", durum: "failed", baglam: kaynak, basladi });
    return { hata: mesaj, kirpilanlar };
  }
}
