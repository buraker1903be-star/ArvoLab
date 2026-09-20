"use server";

import { createClient } from "@/lib/supabase/server";
import { aiYapilandirildi, sor } from "@/lib/ai/saglayici";
import { asistanKapisi } from "@/lib/ai/erisim";
import type { Bulgu } from "@/lib/ai/bulgu";
import { kunyeIzi, literaturIstemi, taramaCozumle, type KayitOzeti } from "@/lib/ai/literatur-taramasi";
import { asistanKaydet } from "@/lib/ai/kayit";

/*
  Asistanın literatür tarama yardımı. Kaynak listesi istemciden GELMEZ,
  burada okunur: hem RLS kendi kayıtlarıyla sınırlar hem de istem gövdesi
  dışarıdan şişirilemez.
*/

const EN_UZUN_SORU = 1_000;
const EN_FAZLA_KAYIT = 80;

export type LiteraturDenetimGirdisi = { arastirmaSorusu: string; projectId?: string | null };

export type LiteraturDenetimYaniti = {
  hata?: string;
  bulgular?: Bulgu[];
  /** Veri tabanına yapıştırılabilir arama dizeleri. */
  aramalar?: string[];
  kirpilanlar?: string[];
  model?: string;
  /** Çalışma kaydının kimliği; kullanıcı buna puan veriyor. */
  kayitId?: string | null;
};

export const literaturAsistaniAcik = async () => aiYapilandirildi();

export async function literaturTara(girdi: LiteraturDenetimGirdisi): Promise<LiteraturDenetimYaniti> {
  const arastirmaSorusu = String(girdi.arastirmaSorusu ?? "").slice(0, EN_UZUN_SORU).trim();
  if (arastirmaSorusu.length < 10)
    return { hata: "Tarama stratejisi için araştırma sorunuzu yazın (en az bir cümle)." };

  const kapi = await asistanKapisi();
  if (!kapi.ok) return { hata: kapi.hata };

  const supabase = await createClient();
  let sorgu = supabase
    .from("literature_sources")
    .select("title, authors, year, source_type, container_title")
    .order("created_at", { ascending: false })
    .limit(EN_FAZLA_KAYIT);
  if (girdi.projectId) sorgu = sorgu.eq("project_id", girdi.projectId);

  const { data, error } = await sorgu;
  // Liste okunamazsa akış durmaz: strateji kısmı kaynak listesi olmadan da
  // üretilebiliyor, kullanıcı elinin boş dönmesindense eksik dönsün.
  if (error) console.error("[ai] literatür kayıtları okunamadı:", error.message);

  const kayitlar: KayitOzeti[] = (data ?? []).map((satir) => ({
    baslik: String(satir.title ?? "").slice(0, 300),
    yazarlar: satir.authors ? String(satir.authors).slice(0, 200) : null,
    yil: satir.year ? String(satir.year).slice(0, 10) : null,
    tur: satir.source_type ? String(satir.source_type).slice(0, 40) : null,
    yayin: satir.container_title ? String(satir.container_title).slice(0, 200) : null,
  }));

  const { mesajlar, kaynak, kirpilanlar } = literaturIstemi({ arastirmaSorusu, kayitlar });

  const basladi = Date.now();

  try {
    const yanit = await sor(mesajlar, { jsonBekle: true, sicaklik: 0.3, enFazlaJeton: 3200 });
    const { bulgular, aramalar } = taramaCozumle(yanit.metin);
    if (!bulgular.length && !aramalar.length) {
      await asistanKaydet({ kullaniciId: kapi.kullaniciId, yetenek: "literatur", durum: "rejected", redNedeni: "bos", model: yanit.model, baglam: kaynak, cikti: yanit.metin, basladi });
      return { hata: "Asistan tarama stratejisi üretemedi. Araştırma sorusunu biraz daha açık yazmayı deneyin.", kirpilanlar };
    }

    /*
      İki ayrı koruma. Künye izi: modelin en zararlı hatası uydurma kaynak
      önermek; istemde yasak ama kodda da bakılır. Sayı denetimi yalnızca
      bulgulara uygulanır — arama dizesindeki "2015..2025" meşru bir yıl
      filtresidir, bağlamda geçmez ve kullanıcı çalıştırmadan önce görür.
    */
    if (kunyeIzi(bulgular)) {
      console.error("[ai] literatür yanıtı künye içeriyor", { model: yanit.model });
      await asistanKaydet({ kullaniciId: kapi.kullaniciId, yetenek: "literatur", durum: "rejected", redNedeni: "kunye", model: yanit.model, baglam: kaynak, cikti: yanit.metin, bulgular, basladi });
      return {
        hata: "Asistan kaynak künyesi ürettiği için cevap gösterilmedi. Kaynakları dizinden kendiniz doğrulamalısınız; tekrar deneyebilirsiniz.",
        kirpilanlar,
      };
    }

    const kayitId = await asistanKaydet({ kullaniciId: kapi.kullaniciId, yetenek: "literatur", durum: "completed", model: yanit.model, baglam: kaynak, cikti: yanit.metin, bulgular: { bulgular, aramalar }, basladi });
    return { bulgular, aramalar, kirpilanlar, model: yanit.model, kayitId };
  } catch (hata) {
    const mesaj = hata instanceof Error ? hata.message : "Asistan yanıt veremedi.";
    console.error("[ai] literatür taraması başarısız", mesaj);
    await asistanKaydet({ kullaniciId: kapi.kullaniciId, yetenek: "literatur", durum: "failed", baglam: kaynak, basladi });
    return { hata: mesaj, kirpilanlar };
  }
}
