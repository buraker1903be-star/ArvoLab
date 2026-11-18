"use server";

import { createClient } from "@/lib/supabase/server";
import { aiHataMesaji, aiYapilandirildi, sor } from "@/lib/ai/saglayici";
import { aktifDil, ceviri } from "@/lib/dil-sunucu";
import { asistanHakkiVar, asistanKapisi } from "@/lib/ai/erisim";
import type { Bulgu } from "@/lib/ai/bulgu";
import { kayitliLiteraturCevabi, kunyeIzi, literaturIstemi, taramaCozumle, yazarOnerileriniAyikla, type KayitOzeti } from "@/lib/ai/literatur-taramasi";
import { asistanKaydet } from "@/lib/ai/kayit";
import { oncekiCevap } from "@/lib/ai/gecmis";
import { calismaBaglami } from "@/lib/ai/calisma-baglami";

/*
  Asistanın literatür tarama yardımı. Kaynak listesi istemciden GELMEZ,
  burada okunur: hem RLS kendi kayıtlarıyla sınırlar hem de istem gövdesi
  dışarıdan şişirilemez.
*/

const EN_UZUN_SORU = 1_000;
const EN_FAZLA_KAYIT = 80;

export type LiteraturDenetimGirdisi = {
  /** true: kayıtlı cevap atlanır, modele yeniden sorulur. */
  zorla?: boolean; arastirmaSorusu: string; projectId?: string | null };

export type LiteraturDenetimYaniti = {
  hata?: string;
  /** Deneme hakkı bitti: hata kutusunda Abonelik düğmesi (lib/ai/erisim.ts). */
  odemeGerekli?: boolean;
  bulgular?: Bulgu[];
  /** Veri tabanına yapıştırılabilir arama dizeleri. */
  aramalar?: string[];
  kirpilanlar?: string[];
  /** Kredi azalıyorsa kullanıcıya gösterilecek not (lib/ai/erisim.ts). */
  krediUyarisi?: string;
  model?: string;
  /** Çalışma kaydının kimliği; kullanıcı buna puan veriyor. */
  kayitId?: string | null;
  /** Kayıtlı cevap gösterildi: model çağrılmadı, hak yanmadı. */
  kayitliCevap?: { tarih: string } | null;
  /** Nötr duyuru (ör. kayıtlı cevabın eski biçimli bulguları gösterilmedi). */
  bilgi?: string;
};

export const literaturAsistaniAcik = async () => aiYapilandirildi();

export async function literaturTara(girdi: LiteraturDenetimGirdisi): Promise<LiteraturDenetimYaniti> {
  const arastirmaSorusu = String(girdi.arastirmaSorusu ?? "").slice(0, EN_UZUN_SORU).trim();
  const t = await ceviri();
  const dil = await aktifDil();
  if (arastirmaSorusu.length < 10)
    return { hata: t({ tr: "Tarama stratejisi için araştırma sorunuzu yazın (en az bir cümle).", en: "Write your research question for the search strategy (at least one sentence)." }) };

  const kapi = await asistanKapisi(dil);
  if (!kapi.ok) return { hata: kapi.hata, odemeGerekli: kapi.odemeGerekli };

  /*
    Çalışma bağlamı: atıf stili, araştırma yöntemi ve tür. Bunları bilmeden
    verilen denetim genel kalıyordu — APA beklenen yerde Vancouver kuralı,
    nitel çalışmada etki büyüklüğü. Erişim RLS'e tabi: yabancı bir çalışmanın
    kimliği gönderilse satır dönmez, kayıt da ona iliştirilemez.
  */
  const calisma = await calismaBaglami(girdi.projectId);

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

  const { mesajlar, kaynak, kirpilanlar } = literaturIstemi({ calisma: calisma?.metin, arastirmaSorusu, kayitlar, dil });

  /*
    Aynı bağlam daha önce sorulduysa modele gidilmez. Aynı analizi ikinci kez
    denetletmek kimseye bir şey kazandırmıyor: kullanıcı bekliyor, hesaptan
    para çıkıyor, cevap zaten kayıtlı. Kullanıcı "yeniden sorgula" ile
    zorlayabilir.
  */
  if (!girdi.zorla) {
    const onceki = await oncekiCevap(kapi.kullaniciId, "literatur", kaynak);
    /*
      Kayıtlı cevap da kod → şablon yolundan geçer (kayitliLiteraturCevabi).
      Kod taşımayan eski bulgular GÖSTERİLMEZ ve bu yüzden modele
      KENDİLİĞİNDEN gidilmez: ücretli çağrı kullanıcının "yeniden sorgula"
      kararıdır. Eskiden süzgeçten bir şey kalmazsa akış sessizce yeni bir
      model çağrısına düşüyordu.
    */
    if (onceki) {
      const kayitli = kayitliLiteraturCevabi({ bulgular: onceki.bulgular, aramalar: onceki.aramalar }, kaynak, dil);
      const eksik = kayitli.dusenBulgu > 0 || kayitli.dusenArama > 0;
      return {
        krediUyarisi: kapi.uyari ?? undefined,
        bulgular: kayitli.bulgular,
        aramalar: kayitli.aramalar,
        kirpilanlar,
        kayitId: onceki.id,
        kayitliCevap: { tarih: onceki.created_at },
        bilgi: eksik
          ? t({
              tr: "Bu kayıtlı cevabın bir kısmı eski biçimde olduğu için gösterilmiyor. Güncel bir tarama için yeniden sorgulayabilirsiniz.",
              en: "Part of this saved answer is in an older format and isn't shown. You can ask again for an up-to-date search.",
            })
          : undefined,
      };
    }
  }

  // Hak yalnızca modele gidilecekse yanar.
  const hakHatasi = await asistanHakkiVar(kapi.kullaniciId, dil);
  if (hakHatasi) return { hata: hakHatasi };

  const basladi = Date.now();

  try {
    const yanit = await sor(mesajlar, { yetenek: "literatur", jsonBekle: true, sicaklik: 0.3, enFazlaJeton: 3200 });
    const cozulen = taramaCozumle(yanit.metin, dil);
    if (!cozulen.bulgular.length && !cozulen.aramalar.length) {
      await asistanKaydet({ kullaniciId: kapi.kullaniciId, calismaId: calisma?.id ?? null, yetenek: "literatur", durum: "rejected", redNedeni: "bos", model: yanit.model, baglam: kaynak, cikti: yanit.metin, basladi });
      return { hata: t({ tr: "Asistan tarama stratejisi üretemedi. Araştırma sorusunu biraz daha açık yazmayı deneyin.", en: "The assistant couldn't produce a search strategy. Try writing your research question a bit more clearly." }), kirpilanlar };
    }

    /*
      İki ayrı koruma. Künye izi: modelin en zararlı hatası uydurma kaynak
      önermek; istemde yasak ama kodda da bakılır. Bulgunun BAŞLIĞI ve
      açıklaması ile arama dizelerinin hepsi taranır. Sayı denetimi ise
      yalnızca bulgulara uygulanır — arama dizesindeki "2015..2025" meşru
      bir yıl filtresidir, bağlamda geçmez ve kullanıcı çalıştırmadan önce
      görür. Künyede bu gerekçe yok: arama dizesinde APA künye biçimi,
      olmayan bir çalışmayı varmış gibi göstermektir.
    */
    /*
      Üçüncü koruma, yazar önerisi (yazarOnerileriniAyikla): künye biçimi
      taşımayan "Peplau & Perlman, Weiss vb." gibi öneriler. Önerinin geçtiği
      bulgu/dize ayıklanır; kullanıcının girdisinde geçen adlar serbest.
      Ayıklamadan sonra hiçbir şey kalmazsa künye gibi reddedilir.
    */
    const { sonuc: ayiklanmis, ayiklanan } = yazarOnerileriniAyikla(cozulen, kaynak);
    const { bulgular, aramalar } = ayiklanmis;
    if (ayiklanan.length) console.error("[ai] literatür yanıtından yazar önerisi ayıklandı", { model: yanit.model, adet: ayiklanan.length });
    if (kunyeIzi(cozulen) || (!bulgular.length && !aramalar.length)) {
      console.error("[ai] literatür yanıtı künye içeriyor", { model: yanit.model });
      await asistanKaydet({ kullaniciId: kapi.kullaniciId, calismaId: calisma?.id ?? null, yetenek: "literatur", durum: "rejected", redNedeni: "kunye", model: yanit.model, baglam: kaynak, cikti: yanit.metin, bulgular: cozulen.bulgular, basladi });
      return {
        hata: t({
          tr: "Asistan kaynak künyesi ürettiği için cevap gösterilmedi. Kaynakları dizinden kendiniz doğrulamalısınız; tekrar deneyebilirsiniz.",
          en: "The response wasn't shown because the assistant produced a source reference. You should verify sources in the index yourself; you can try again.",
        }),
        kirpilanlar,
      };
    }

    const kayitId = await asistanKaydet({ kullaniciId: kapi.kullaniciId, calismaId: calisma?.id ?? null, yetenek: "literatur", durum: "completed", model: yanit.model, baglam: kaynak, cikti: yanit.metin, bulgular: { bulgular, aramalar }, basladi });
    return { krediUyarisi: kapi.uyari ?? undefined, bulgular, aramalar, kirpilanlar, model: yanit.model, kayitId };
  } catch (hata) {
    const mesaj = aiHataMesaji(hata, dil) ?? t({ tr: "Asistan yanıt veremedi.", en: "The assistant couldn't respond." });
    console.error("[ai] literatür taraması başarısız", mesaj);
    await asistanKaydet({ kullaniciId: kapi.kullaniciId, calismaId: calisma?.id ?? null, yetenek: "literatur", durum: "failed", baglam: kaynak, basladi });
    return { hata: mesaj, kirpilanlar };
  }
}
