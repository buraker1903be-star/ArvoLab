"use server";

import { createClient } from "@/lib/supabase/server";
import { aiYapilandirildi, sor } from "@/lib/ai/saglayici";
import { asistanHakkiVar, asistanKapisi } from "@/lib/ai/erisim";
import { asistanKaydet } from "@/lib/ai/kayit";
import { oncekiCevap } from "@/lib/ai/gecmis";
import { calismaBaglami } from "@/lib/ai/calisma-baglami";
import { baglamDisiKunye, bulgulariCozumle, bulgulariDogrula, type Bulgu } from "@/lib/ai/bulgu";
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

export type MakaleDenetimYaniti = {
  hata?: string;
  bulgular?: Bulgu[];
  kirpilanlar?: string[];
  model?: string;
  kayitId?: string | null;
  kayitliCevap?: { tarih: string } | null;
};

export const makaleAsistaniAcik = async () => aiYapilandirildi();

export async function makaleBolumDenetle(girdi: { projectId: string; bolumSirasi: number; zorla?: boolean }): Promise<MakaleDenetimYaniti> {
  if (!UUID.test(String(girdi.projectId ?? ""))) return { hata: "Çalışma bulunamadı." };

  const kapi = await asistanKapisi();
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
    return { hata: "Makale okunamadı. Birazdan tekrar deneyin." };
  }
  if (!proje.data) return { hata: "Çalışma bulunamadı." };
  if (proje.data.project_type !== "article") return { hata: "Bölüm denetimi makale türündeki çalışmalar içindir." };
  if (!profil.data || !makaleTuruMu(profil.data.makale_turu))
    return { hata: "Önce makale bilgilerini (tür, araştırma sorusu) kaydedin; denetim bunlara göre kuruluyor." };

  const bolumler = makaleBolumleri(musvedde.data?.content);
  const bolum = bolumler[Number(girdi.bolumSirasi)];
  if (!bolum) return { hata: "Bölüm bulunamadı. Müsveddeyi kaydettikten sonra sayfayı yenileyin." };
  if (bolum.metin.length < EN_KISA_BOLUM) return { hata: "Bu bölüm denetlenecek kadar uzun değil." };

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
  });

  if (!girdi.zorla) {
    const onceki = await oncekiCevap(kapi.kullaniciId, "makale", kaynak);
    if (onceki) return { bulgular: onceki.bulgular, kirpilanlar, kayitId: onceki.id, kayitliCevap: { tarih: onceki.created_at } };
  }

  // Hak yalnızca modele gidilecekse yanar.
  const hakHatasi = await asistanHakkiVar(kapi.kullaniciId);
  if (hakHatasi) return { hata: hakHatasi };

  const basladi = Date.now();
  const ortak = { kullaniciId: kapi.kullaniciId, calismaId: calisma?.id ?? null, yetenek: "makale" as const, baglam: kaynak, basladi };

  try {
    const yanit = await sor(mesajlar, { yetenek: "makale", jsonBekle: true, sicaklik: 0.2, enFazlaJeton: 3000 });
    const bulgular = bulgulariCozumle(yanit.metin);
    if (!bulgular.length) {
      await asistanKaydet({ ...ortak, durum: "rejected", redNedeni: "bos", model: yanit.model, cikti: yanit.metin });
      return { hata: "Asistan bu bölüm için denetlenebilir bir bulgu üretmedi. Tekrar deneyebilirsiniz.", kirpilanlar };
    }

    /*
      Künye: bölüm metninde geçen atıflara değinmek meşru, girdide
      olmayan bir künye ise uydurmadır (lib/ai/bulgu.ts, baglamDisiKunye).
    */
    const yabanci = bulgular.flatMap((b) => baglamDisiKunye(`${b.baslik} ${b.aciklama}`, kaynak));
    if (yabanci.length) {
      console.error("[ai] makale denetimi künye üretti", { model: yanit.model });
      await asistanKaydet({ ...ortak, durum: "rejected", redNedeni: "kunye", model: yanit.model, cikti: yanit.metin, bulgular });
      return { hata: "Asistan metinde olmayan bir kaynak künyesi ürettiği için cevap gösterilmedi.", kirpilanlar };
    }

    const dogrulama = bulgulariDogrula(bulgular, kaynak);
    if (!dogrulama.gecti) {
      console.error("[ai] makale denetimi uydurma sayı içerdi", { model: yanit.model, uydurulan: dogrulama.uydurulan });
      await asistanKaydet({ ...ortak, durum: "rejected", redNedeni: "uydurma_sayi", model: yanit.model, cikti: yanit.metin, bulgular });
      return { hata: "Asistan verilmeyen sayılar ürettiği için cevap gösterilmedi. Bu bir güvenlik kontrolüdür; tekrar deneyebilirsiniz.", kirpilanlar };
    }

    const kayitId = await asistanKaydet({ ...ortak, durum: "completed", model: yanit.model, cikti: yanit.metin, bulgular });
    return { bulgular, kirpilanlar, model: yanit.model, kayitId };
  } catch (hata) {
    const mesaj = hata instanceof Error ? hata.message : "Asistan yanıt veremedi.";
    console.error("[ai] makale denetimi başarısız", mesaj);
    await asistanKaydet({ ...ortak, durum: "failed" });
    return { hata: mesaj, kirpilanlar };
  }
}
