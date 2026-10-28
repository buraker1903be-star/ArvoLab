"use server";

import { aiHataMesaji, aiYapilandirildi, sor } from "@/lib/ai/saglayici";
import { asistanHakkiVar, asistanKapisi } from "@/lib/ai/erisim";
import { bulgulariCozumle, bulgulariDogrula, type Bulgu, bosListeMi } from "@/lib/ai/bulgu";
import { analizIstemi } from "@/lib/ai/analiz-yorumu";
import { asistanKaydet } from "@/lib/ai/kayit";
import { oncekiCevap } from "@/lib/ai/gecmis";
import { calismaBaglami } from "@/lib/ai/calisma-baglami";
import { aktifDil, ceviri } from "@/lib/dil-sunucu";

/*
  Asistanın analiz denetimi. Oturum, abonelik ve saatlik hak ortak kapıda
  (lib/ai/erisim.ts): model çağrısı para harcıyor ve bu işlem paneldeki
  düğmeden bağımsız, doğrudan çağrılabiliyor.
*/

const EN_UZUN_CIKTI = 20_000;
const EN_UZUN_ALAN = 2_000;

export type AnalizDenetimGirdisi = {
  /** Bağlı akademik çalışma (isteğe bağlı). */
  projectId?: string | null;
  /** true: kayıtlı cevap atlanır, modele yeniden sorulur. */
  zorla?: boolean;
  istatistikMetni: string;
  apaSatirlari?: string[];
  arastirmaSorusu?: string;
  orneklem?: string;
  yontem?: string;
};

export type AnalizDenetimYaniti = {
  hata?: string;
  bulgular?: Bulgu[];
  /** Uzunluk sınırı nedeniyle asistana gönderilemeyen bölümler. */
  kirpilanlar?: string[];
  /** Kredi azalıyorsa kullanıcıya gösterilecek not (lib/ai/erisim.ts). */
  krediUyarisi?: string;
  model?: string;
  /** Çalışma kaydının kimliği; kullanıcı buna puan veriyor. */
  kayitId?: string | null;
  /** Kayıtlı cevap gösterildi: model çağrılmadı, hak yanmadı. */
  kayitliCevap?: { tarih: string } | null;
};

const kisalt = (deger: unknown, sinir: number) => String(deger ?? "").slice(0, sinir).trim();

export const analizAsistaniAcik = async () => aiYapilandirildi();

export async function analizDenetle(girdi: AnalizDenetimGirdisi): Promise<AnalizDenetimYaniti> {
  const t = await ceviri();
  const dil = await aktifDil();
  const istatistikMetni = kisalt(girdi.istatistikMetni, EN_UZUN_CIKTI);
  if (istatistikMetni.length < 10) return { hata: t({ tr: "Denetlenecek bir analiz çıktısı yapıştırın.", en: "Paste an analysis output to review." }) };

  const kapi = await asistanKapisi(dil);
  if (!kapi.ok) return { hata: kapi.hata };

  /*
    Çalışma bağlamı: atıf stili, araştırma yöntemi ve tür. Bunları bilmeden
    verilen denetim genel kalıyordu — APA beklenen yerde Vancouver kuralı,
    nitel çalışmada etki büyüklüğü. Erişim RLS'e tabi: yabancı bir çalışmanın
    kimliği gönderilse satır dönmez, kayıt da ona iliştirilemez.
  */
  const calisma = await calismaBaglami(girdi.projectId);

  const apaSatirlari = (girdi.apaSatirlari ?? []).slice(0, 50).map((satir) => kisalt(satir, 300));
  const { mesajlar, kaynak, kirpilanlar } = analizIstemi({
    calisma: calisma?.metin,
    istatistikMetni,
    apaSatirlari,
    arastirmaSorusu: kisalt(girdi.arastirmaSorusu, EN_UZUN_ALAN),
    orneklem: kisalt(girdi.orneklem, EN_UZUN_ALAN),
    yontem: kisalt(girdi.yontem, EN_UZUN_ALAN),
    dil,
  });

  /*
    Aynı bağlam daha önce sorulduysa modele gidilmez. Aynı analizi ikinci kez
    denetletmek kimseye bir şey kazandırmıyor: kullanıcı bekliyor, hesaptan
    para çıkıyor, cevap zaten kayıtlı. Kullanıcı "yeniden sorgula" ile
    zorlayabilir.
  */
  if (!girdi.zorla) {
    const onceki = await oncekiCevap(kapi.kullaniciId, "analiz", kaynak);
    if (onceki)
      return { krediUyarisi: kapi.uyari ?? undefined, bulgular: onceki.bulgular, kirpilanlar, kayitId: onceki.id, kayitliCevap: { tarih: onceki.created_at } };
  }

  // Hak yalnızca modele gidilecekse yanar.
  const hakHatasi = await asistanHakkiVar(kapi.kullaniciId, dil);
  if (hakHatasi) return { hata: hakHatasi };

  const basladi = Date.now();

  try {
    const yanit = await sor(mesajlar, { yetenek: "analiz", jsonBekle: true, sicaklik: 0.1, enFazlaJeton: 3000 });
    const bulgular = bulgulariCozumle(yanit.metin);
    /* Bilerek boş liste: denetlenen metinde işaretlenecek bir şey yok. Hata değil, sonuç. */
    if (!bulgular.length && bosListeMi(yanit.metin)) {
      const kayitId = await asistanKaydet({ kullaniciId: kapi.kullaniciId, calismaId: calisma?.id ?? null, yetenek: "analiz", durum: "completed", model: yanit.model, baglam: kaynak, cikti: yanit.metin, bulgular, basladi });
      return { krediUyarisi: kapi.uyari ?? undefined, bulgular, kirpilanlar, model: yanit.model, kayitId };
    }
    if (!bulgular.length) {
      await asistanKaydet({ kullaniciId: kapi.kullaniciId, calismaId: calisma?.id ?? null, yetenek: "analiz", durum: "rejected", redNedeni: "bos", model: yanit.model, baglam: kaynak, cikti: yanit.metin, basladi });
      return {
        hata: t({
          tr: "Asistan denetlenebilir bir yapı bulamadı. Çıktıyı test adı ve değerleriyle birlikte yapıştırmayı deneyin.",
          en: "The assistant could not find anything it can review. Try pasting the output together with the test name and its values.",
        }),
        kirpilanlar,
      };
    }

    /*
      Uydurma sayı denetimi (lib/ai/sayi-denetimi.ts). Bir kısmı doğru olan
      listeye güvenmek en tehlikelisi: hangi değerin uydurulduğunu kullanıcı
      ayıklayamaz. Bu yüzden tek bir uydurma sayıda cevabın tamamı düşer.
    */
    const dogrulama = bulgulariDogrula(bulgular, kaynak, { ekKaynaklar: apaSatirlari, yapisalTuretme: true, dil });
    if (!dogrulama.gecti) {
      console.error("[ai] analiz denetimi uydurma sayı içerdi", { model: yanit.model, uydurulan: dogrulama.uydurulan });
      await asistanKaydet({ kullaniciId: kapi.kullaniciId, calismaId: calisma?.id ?? null, yetenek: "analiz", durum: "rejected", redNedeni: "uydurma_sayi", model: yanit.model, baglam: kaynak, cikti: yanit.metin, bulgular, basladi });
      return {
        hata: t({
          tr: "Asistan verilmeyen sayılar ürettiği için cevap gösterilmedi. Bu bir güvenlik kontrolüdür; tekrar deneyebilirsiniz.",
          en: "The response was not shown because the assistant produced numbers that were not in your input. This is a safety check; you can try again.",
        }),
        kirpilanlar,
      };
    }

    const kayitId = await asistanKaydet({ kullaniciId: kapi.kullaniciId, calismaId: calisma?.id ?? null, yetenek: "analiz", durum: "completed", model: yanit.model, baglam: kaynak, cikti: yanit.metin, bulgular, basladi });
    return { krediUyarisi: kapi.uyari ?? undefined, bulgular, kirpilanlar, model: yanit.model, kayitId };
  } catch (hata) {
    const mesaj = aiHataMesaji(hata, dil) ?? t({ tr: "Asistan yanıt veremedi.", en: "The assistant could not respond." });
    console.error("[ai] analiz denetimi başarısız", mesaj);
    await asistanKaydet({ kullaniciId: kapi.kullaniciId, calismaId: calisma?.id ?? null, yetenek: "analiz", durum: "failed", baglam: kaynak, basladi });
    return { hata: mesaj, kirpilanlar };
  }
}
