"use server";

import { aiYapilandirildi, sor } from "@/lib/ai/saglayici";
import { asistanHakkiVar, asistanKapisi } from "@/lib/ai/erisim";
import { bulgulariCozumle, bulgulariDogrula, type Bulgu } from "@/lib/ai/bulgu";
import { analizIstemi } from "@/lib/ai/analiz-yorumu";
import { asistanKaydet } from "@/lib/ai/kayit";
import { oncekiCevap } from "@/lib/ai/gecmis";

/*
  Asistanın analiz denetimi. Oturum, abonelik ve saatlik hak ortak kapıda
  (lib/ai/erisim.ts): model çağrısı para harcıyor ve bu işlem paneldeki
  düğmeden bağımsız, doğrudan çağrılabiliyor.
*/

const EN_UZUN_CIKTI = 20_000;
const EN_UZUN_ALAN = 2_000;

export type AnalizDenetimGirdisi = {
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
  model?: string;
  /** Çalışma kaydının kimliği; kullanıcı buna puan veriyor. */
  kayitId?: string | null;
  /** Kayıtlı cevap gösterildi: model çağrılmadı, hak yanmadı. */
  kayitliCevap?: { tarih: string } | null;
};

const kisalt = (deger: unknown, sinir: number) => String(deger ?? "").slice(0, sinir).trim();

export const analizAsistaniAcik = async () => aiYapilandirildi();

export async function analizDenetle(girdi: AnalizDenetimGirdisi): Promise<AnalizDenetimYaniti> {
  const istatistikMetni = kisalt(girdi.istatistikMetni, EN_UZUN_CIKTI);
  if (istatistikMetni.length < 10) return { hata: "Denetlenecek bir analiz çıktısı yapıştırın." };

  const kapi = await asistanKapisi();
  if (!kapi.ok) return { hata: kapi.hata };

  const apaSatirlari = (girdi.apaSatirlari ?? []).slice(0, 50).map((satir) => kisalt(satir, 300));
  const { mesajlar, kaynak, kirpilanlar } = analizIstemi({
    istatistikMetni,
    apaSatirlari,
    arastirmaSorusu: kisalt(girdi.arastirmaSorusu, EN_UZUN_ALAN),
    orneklem: kisalt(girdi.orneklem, EN_UZUN_ALAN),
    yontem: kisalt(girdi.yontem, EN_UZUN_ALAN),
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
      return { bulgular: onceki.bulgular, kirpilanlar, kayitId: onceki.id, kayitliCevap: { tarih: onceki.created_at } };
  }

  // Hak yalnızca modele gidilecekse yanar.
  const hakHatasi = await asistanHakkiVar(kapi.kullaniciId);
  if (hakHatasi) return { hata: hakHatasi };

  const basladi = Date.now();

  try {
    const yanit = await sor(mesajlar, { yetenek: "analiz", jsonBekle: true, sicaklik: 0.1, enFazlaJeton: 3000 });
    const bulgular = bulgulariCozumle(yanit.metin);
    if (!bulgular.length) {
      await asistanKaydet({ kullaniciId: kapi.kullaniciId, yetenek: "analiz", durum: "rejected", redNedeni: "bos", model: yanit.model, baglam: kaynak, cikti: yanit.metin, basladi });
      return {
        hata: "Asistan denetlenebilir bir yapı bulamadı. Çıktıyı test adı ve değerleriyle birlikte yapıştırmayı deneyin.",
        kirpilanlar,
      };
    }

    /*
      Uydurma sayı denetimi (lib/ai/sayi-denetimi.ts). Bir kısmı doğru olan
      listeye güvenmek en tehlikelisi: hangi değerin uydurulduğunu kullanıcı
      ayıklayamaz. Bu yüzden tek bir uydurma sayıda cevabın tamamı düşer.
    */
    const dogrulama = bulgulariDogrula(bulgular, kaynak, { ekKaynaklar: apaSatirlari });
    if (!dogrulama.gecti) {
      console.error("[ai] analiz denetimi uydurma sayı içerdi", { model: yanit.model, uydurulan: dogrulama.uydurulan });
      await asistanKaydet({ kullaniciId: kapi.kullaniciId, yetenek: "analiz", durum: "rejected", redNedeni: "uydurma_sayi", model: yanit.model, baglam: kaynak, cikti: yanit.metin, bulgular, basladi });
      return {
        hata: "Asistan verilmeyen sayılar ürettiği için cevap gösterilmedi. Bu bir güvenlik kontrolüdür; tekrar deneyebilirsiniz.",
        kirpilanlar,
      };
    }

    const kayitId = await asistanKaydet({ kullaniciId: kapi.kullaniciId, yetenek: "analiz", durum: "completed", model: yanit.model, baglam: kaynak, cikti: yanit.metin, bulgular, basladi });
    return { bulgular, kirpilanlar, model: yanit.model, kayitId };
  } catch (hata) {
    const mesaj = hata instanceof Error ? hata.message : "Asistan yanıt veremedi.";
    console.error("[ai] analiz denetimi başarısız", mesaj);
    await asistanKaydet({ kullaniciId: kapi.kullaniciId, yetenek: "analiz", durum: "failed", baglam: kaynak, basladi });
    return { hata: mesaj, kirpilanlar };
  }
}
