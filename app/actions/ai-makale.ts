"use server";

import { createClient } from "@/lib/supabase/server";
import { aiHataMesaji, aiYapilandirildi, sor } from "@/lib/ai/saglayici";
import { aktifDil, ceviri } from "@/lib/dil-sunucu";
import type { Metin } from "@/lib/dil";
import { asistanHakkiVar, asistanKapisi } from "@/lib/ai/erisim";
import { asistanKaydet } from "@/lib/ai/kayit";
import { oncekiCevap } from "@/lib/ai/gecmis";
import { calismaBaglami } from "@/lib/ai/calisma-baglami";
import { baglamDisiKunye, bulgulariCozumle, bulgulariDogrula, type Bulgu, bosListeMi } from "@/lib/ai/bulgu";
import { makaleIstemi } from "@/lib/ai/makale-denetimi";
import { makaleBolumleri } from "@/lib/makale/bolumler";
import { makaleTuruMu, yontemAilesi } from "@/lib/makale/sablonlar";

/*
  Makale bölüm denetimi. Bölüm metni istemciden GELMEZ: kaydedilmiş
  müsvedde okunur ve sıra numarasıyla seçilir. Kullanıcı ekranda gördüğü
  bölümü denetletiyor; istem gövdesi dışarıdan şişirilemez.
*/

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EN_KISA_BOLUM = 80;
const CALISMA_YOK: Metin = { tr: "Çalışma bulunamadı.", en: "Work not found." };

export type MakaleDenetimYaniti = {
  hata?: string;
  bulgular?: Bulgu[];
  kirpilanlar?: string[];
  /** Kredi azalıyorsa kullanıcıya gösterilecek not (lib/ai/erisim.ts). */
  krediUyarisi?: string;
  model?: string;
  kayitId?: string | null;
  kayitliCevap?: { tarih: string } | null;
};

export const makaleAsistaniAcik = async () => aiYapilandirildi();

export async function makaleBolumDenetle(girdi: { projectId: string; bolumSirasi: number; zorla?: boolean }): Promise<MakaleDenetimYaniti> {
  const dil = await aktifDil();
  const t = await ceviri();
  if (!UUID.test(String(girdi.projectId ?? ""))) return { hata: t(CALISMA_YOK) };

  const kapi = await asistanKapisi(dil);
  if (!kapi.ok) return { hata: kapi.hata };

  const supabase = await createClient();
  const [proje, profil, musvedde] = await Promise.all([
    supabase.from("academic_projects").select("id, project_type, research_method").eq("id", girdi.projectId).maybeSingle(),
    supabase
      .from("makale_profili")
      .select("makale_turu, arastirma_sorusu, arastirma_problemi, arastirma_tasarimi, hedef_dergi")
      .eq("project_id", girdi.projectId)
      .maybeSingle(),
    supabase.from("project_manuscripts").select("content").eq("project_id", girdi.projectId).maybeSingle(),
  ]);
  if (proje.error || profil.error || musvedde.error) {
    console.error("[ai] makale bağlamı okunamadı", proje.error?.message, profil.error?.message, musvedde.error?.message);
    return { hata: t({ tr: "Makale okunamadı. Birazdan tekrar deneyin.", en: "The article could not be read. Try again shortly." }) };
  }
  if (!proje.data) return { hata: t(CALISMA_YOK) };
  if (proje.data.project_type !== "article") return { hata: t({ tr: "Bölüm denetimi makale türündeki çalışmalar içindir.", en: "Section review is for article-type works." }) };
  if (!profil.data || !makaleTuruMu(profil.data.makale_turu))
    return {
      hata: t({
        tr: "Önce makale bilgilerini (tür, araştırma sorusu) kaydedin; denetim bunlara göre kuruluyor.",
        en: "First save the article details (type, research question); the review is built on them.",
      }),
    };

  const bolumler = makaleBolumleri(musvedde.data?.content);
  const bolum = bolumler[Number(girdi.bolumSirasi)];
  if (!bolum) return { hata: t({ tr: "Bölüm bulunamadı. Müsveddeyi kaydettikten sonra sayfayı yenileyin.", en: "Section not found. Save the manuscript, then refresh the page." }) };
  if (bolum.metin.length < EN_KISA_BOLUM) return { hata: t({ tr: "Bu bölüm denetlenecek kadar uzun değil.", en: "This section is not long enough to review." }) };

  const tur = profil.data.makale_turu;
  const bulgularBolumu = bolum.tur === "tartisma" || bolum.tur === "sonuc" ? bolumler.find((b) => b.tur === "bulgular") : undefined;
  const calisma = await calismaBaglami(girdi.projectId);
  const { mesajlar, kaynak, kirpilanlar } = makaleIstemi({
    tur,
    bolumTuru: bolum.tur,
    aile: yontemAilesi(proje.data.research_method, tur),
    calisma: calisma?.metin,
    arastirmaSorusu: profil.data.arastirma_sorusu,
    arastirmaProblemi: profil.data.arastirma_problemi,
    tasarim: profil.data.arastirma_tasarimi,
    hedefDergi: profil.data.hedef_dergi,
    bolumBasligi: bolum.baslik,
    bolumMetni: bolum.metin,
    bulgularMetni: bulgularBolumu?.metin ?? null,
    dil,
  });

  if (!girdi.zorla) {
    const onceki = await oncekiCevap(kapi.kullaniciId, "makale", kaynak);
    if (onceki) return { krediUyarisi: kapi.uyari ?? undefined, bulgular: onceki.bulgular, kirpilanlar, kayitId: onceki.id, kayitliCevap: { tarih: onceki.created_at } };
  }

  // Hak yalnızca modele gidilecekse yanar.
  const hakHatasi = await asistanHakkiVar(kapi.kullaniciId, dil);
  if (hakHatasi) return { hata: hakHatasi };

  const basladi = Date.now();
  const ortak = { kullaniciId: kapi.kullaniciId, calismaId: calisma?.id ?? null, yetenek: "makale" as const, baglam: kaynak, basladi };

  try {
    const yanit = await sor(mesajlar, { yetenek: "makale", jsonBekle: true, sicaklik: 0.2, enFazlaJeton: 3000 });
    const bulgular = bulgulariCozumle(yanit.metin);
    /* Bilerek boş liste: denetlenen metinde işaretlenecek bir şey yok. Hata değil, sonuç. */
    if (!bulgular.length && bosListeMi(yanit.metin)) {
      const kayitId = await asistanKaydet({ ...ortak, durum: "completed", model: yanit.model, cikti: yanit.metin, bulgular });
      return { krediUyarisi: kapi.uyari ?? undefined, bulgular, kirpilanlar, model: yanit.model, kayitId };
    }
    if (!bulgular.length) {
      await asistanKaydet({ ...ortak, durum: "rejected", redNedeni: "bos", model: yanit.model, cikti: yanit.metin });
      return {
        hata: t({
          tr: "Asistan bu bölüm için denetlenebilir bir bulgu üretmedi. Tekrar deneyebilirsiniz.",
          en: "The assistant did not produce any reviewable findings for this section. You can try again.",
        }),
        kirpilanlar,
      };
    }

    /*
      Künye: bölüm metninde geçen atıflara değinmek meşru, girdide
      olmayan bir künye ise uydurmadır (lib/ai/bulgu.ts, baglamDisiKunye).
    */
    const yabanci = bulgular.flatMap((b) => baglamDisiKunye(`${b.baslik} ${b.aciklama}`, kaynak));
    if (yabanci.length) {
      console.error("[ai] makale denetimi künye üretti", { model: yanit.model });
      await asistanKaydet({ ...ortak, durum: "rejected", redNedeni: "kunye", model: yanit.model, cikti: yanit.metin, bulgular });
      return {
        hata: t({
          tr: "Asistan metinde olmayan bir kaynak künyesi ürettiği için cevap gösterilmedi.",
          en: "The answer was not shown because the assistant produced a reference that is not in the text.",
        }),
        kirpilanlar,
      };
    }

    const dogrulama = bulgulariDogrula(bulgular, kaynak, { dil });
    if (!dogrulama.gecti) {
      console.error("[ai] makale denetimi uydurma sayı içerdi", { model: yanit.model, uydurulan: dogrulama.uydurulan });
      await asistanKaydet({ ...ortak, durum: "rejected", redNedeni: "uydurma_sayi", model: yanit.model, cikti: yanit.metin, bulgular });
      return {
        hata: t({
          tr: "Asistan verilmeyen sayılar ürettiği için cevap gösterilmedi. Bu bir güvenlik kontrolüdür; tekrar deneyebilirsiniz.",
          en: "The answer was not shown because the assistant produced numbers that were not provided. This is a safety check; you can try again.",
        }),
        kirpilanlar,
      };
    }

    const kayitId = await asistanKaydet({ ...ortak, durum: "completed", model: yanit.model, cikti: yanit.metin, bulgular });
    return { krediUyarisi: kapi.uyari ?? undefined, bulgular, kirpilanlar, model: yanit.model, kayitId };
  } catch (hata) {
    const mesaj = aiHataMesaji(hata, dil) ?? t({ tr: "Asistan yanıt veremedi.", en: "The assistant could not respond." });
    console.error("[ai] makale denetimi başarısız", hata instanceof Error ? hata.message : hata);
    await asistanKaydet({ ...ortak, durum: "failed" });
    return { hata: mesaj, kirpilanlar };
  }
}
