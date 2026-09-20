"use server";

import { aiYapilandirildi, sor } from "@/lib/ai/saglayici";
import { asistanKapisi } from "@/lib/ai/erisim";
import { bulgulariCozumle, bulgulariDogrula, type Bulgu } from "@/lib/ai/bulgu";
import { kaynakcaIstemi, type KaynakDurumu, type KaynakSatiri } from "@/lib/ai/kaynakca-denetimi";
import { asistanKaydet } from "@/lib/ai/kayit";

/*
  Asistanın kaynakça denetimi. Mekanik denetimin (lib/apa7.ts +
  lib/academic-reference-verification.ts) sonuçlarını alır; yeniden dizin
  sorgusu yapmaz. Kapılar ortak (lib/ai/erisim.ts).
*/

const EN_UZUN_KAYNAK = 600;
const EN_FAZLA_KAYNAK = 60;
const EN_FAZLA_LISTE = 40;
const EN_FAZLA_ATIF = 120;
const DURUMLAR = new Set<KaynakDurumu>(["verified", "possible_match", "not_found", "insufficient_data"]);

export type KaynakcaDenetimGirdisi = {
  kaynaklar: KaynakSatiri[];
  eksikKaynaklar?: string[];
  kullanilmayanKaynaklar?: string[];
  /** Metindeki bütün atıflar (ham); atıf–kaynakça eşleştirmesi için. */
  atiflar?: string[];
};

export type KaynakcaDenetimYaniti = {
  hata?: string;
  bulgular?: Bulgu[];
  kirpilanlar?: string[];
  model?: string;
  /** Çalışma kaydının kimliği; kullanıcı buna puan veriyor. */
  kayitId?: string | null;
};

const kisalt = (deger: unknown, sinir: number) => String(deger ?? "").slice(0, sinir).trim();
const liste = (deger: string[] | undefined, adet: number, sinir: number) =>
  (deger ?? []).slice(0, adet).map((satir) => kisalt(satir, sinir)).filter(Boolean);

export const kaynakcaAsistaniAcik = async () => aiYapilandirildi();

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
  if (!kaynaklar.some((kaynak) => kaynak.ham)) return { hata: "Denetlenecek kaynak bulunamadı." };

  const kapi = await asistanKapisi();
  if (!kapi.ok) return { hata: kapi.hata };

  const { mesajlar, kaynak, kirpilanlar } = kaynakcaIstemi({
    kaynaklar,
    eksikKaynaklar: liste(girdi.eksikKaynaklar, EN_FAZLA_LISTE, 300),
    kullanilmayanKaynaklar: liste(girdi.kullanilmayanKaynaklar, EN_FAZLA_LISTE, EN_UZUN_KAYNAK),
    // Aynı atıf metinde onlarca kez geçebiliyor; tekrarı göndermek bütçeyi
    // yiyor ve eşleştirmeye hiçbir şey katmıyor.
    atiflar: [...new Set(liste(girdi.atiflar, 300, 120))].slice(0, EN_FAZLA_ATIF),
  });

  const basladi = Date.now();

  try {
    const yanit = await sor(mesajlar, { yetenek: "kaynakca", jsonBekle: true, sicaklik: 0.1, enFazlaJeton: 3000 });
    const bulgular = bulgulariCozumle(yanit.metin);
    if (!bulgular.length) {
      await asistanKaydet({ kullaniciId: kapi.kullaniciId, yetenek: "kaynakca", durum: "rejected", redNedeni: "bos", model: yanit.model, baglam: kaynak, cikti: yanit.metin, basladi });
      return { hata: "Asistan kaynakçada denetlenecek bir şey bulamadı.", kirpilanlar };
    }

    /*
      Uydurma sayı denetimi: kaynakçada en sık uydurulan şey yıl, cilt, sayı
      ve sayfa aralığıdır. Bir tanesi bile bağlamda geçmiyorsa cevabın
      tamamı düşer — kullanıcı hangisinin uydurma olduğunu ayıklayamaz.
    */
    const dogrulama = bulgulariDogrula(bulgular, kaynak);
    if (!dogrulama.gecti) {
      console.error("[ai] kaynakça denetimi uydurma sayı içerdi", { model: yanit.model, uydurulan: dogrulama.uydurulan });
      await asistanKaydet({ kullaniciId: kapi.kullaniciId, yetenek: "kaynakca", durum: "rejected", redNedeni: "uydurma_sayi", model: yanit.model, baglam: kaynak, cikti: yanit.metin, bulgular, basladi });
      return {
        hata: "Asistan verilmeyen künye bilgileri ürettiği için cevap gösterilmedi. Bu bir güvenlik kontrolüdür; tekrar deneyebilirsiniz.",
        kirpilanlar,
      };
    }

    const kayitId = await asistanKaydet({ kullaniciId: kapi.kullaniciId, yetenek: "kaynakca", durum: "completed", model: yanit.model, baglam: kaynak, cikti: yanit.metin, bulgular, basladi });
    return { bulgular, kirpilanlar, model: yanit.model, kayitId };
  } catch (hata) {
    const mesaj = hata instanceof Error ? hata.message : "Asistan yanıt veremedi.";
    console.error("[ai] kaynakça denetimi başarısız", mesaj);
    await asistanKaydet({ kullaniciId: kapi.kullaniciId, yetenek: "kaynakca", durum: "failed", baglam: kaynak, basladi });
    return { hata: mesaj, kirpilanlar };
  }
}
