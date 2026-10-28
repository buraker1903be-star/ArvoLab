"use server";

import { revalidatePath } from "next/cache";
import { listeBasarili, listeOkunamadi, type ListeSonucu } from "@/lib/liste-sonucu";
import { getAuthContext, oturumYokMesaji, type ActionResult } from "@/lib/auth-guards";
import { isSubscriptionBlocked, abonelikKapaliMesaji } from "@/lib/access";
import { analizTuruMu } from "@/lib/analiz-turleri";

const PAGE_PATH = "/dashboard/analysis";
const EN_UZUN_BASLIK = 300;
const EN_UZUN_METIN = 20000;

export interface AnalizSonucu {
  id: string;
  project_id: string | null;
  analiz_turu: string;
  baslik: string;
  apa_metni: string;
  created_at: string;
}

/** Çalışmanın analizleri; teze ekleme sırası alanlarıyla (migration 20261026131044). */
export interface CalismaAnalizi extends AnalizSonucu {
  teze_eklenecek: boolean;
  teze_eklendi: string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const yenile = () => {
  revalidatePath(PAGE_PATH);
  revalidatePath("/dashboard/editor");
};

/*
  Analiz merkezi bugüne kadar hiçbir şey biriktirmiyordu: hesap tarayıcıda
  yapılıyor, sekme kapanınca sonuç kayboluyordu.

  HAM VERİ KAYDEDİLMİYOR. Yüklenen dosya sunucuya hiç gitmiyor; buraya
  yalnızca kullanıcının ekranda gördüğü APA metni ve hangi testin hangi
  değişkenlerle çalıştırıldığı yazılıyor. Kaydetme de otomatik değil:
  katılımcı verisiyle çalışan bir araştırmacının sonucu sunucuya taşıyıp
  taşımayacağına kendisi karar vermeli.
*/
export async function analizSonucuKaydet(girdi: {
  analizTuru: string;
  baslik: string;
  apaMetni: string;
  projectId: string | null;
  /** Çalışmalarım'daki Analiz penceresi: kaydederken teze ekleme sırasına da koyar. */
  tezeEklenecek?: boolean;
}): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { error: await oturumYokMesaji() };
  if (await isSubscriptionBlocked()) return { error: (await abonelikKapaliMesaji()) };

  const baslik = girdi.baslik.trim();
  const apaMetni = girdi.apaMetni.trim();
  if (!baslik || !apaMetni) return { error: "Kaydedilecek bir sonuç yok." };
  if (!analizTuruMu(girdi.analizTuru)) return { error: "Tanınmayan analiz türü." };
  // Veritabanındaki check kısıtı ham hata mesajı verirdi; sınır burada anlaşılır söyleniyor.
  if (baslik.length > EN_UZUN_BASLIK) return { error: "Başlık fazla uzun." };
  if (apaMetni.length > EN_UZUN_METIN) {
    return { error: "Sonuç metni kaydedilemeyecek kadar uzun; daha dar bir analiz seçin." };
  }

  /*
    project_id istemciden geliyor ve RLS onu denetlemiyor (insert politikası
    yalnızca owner_id'ye bakar): doğrulanmazsa kayıt BAŞKASININ çalışmasına
    bağlanabilirdi. Aynı açık document_uploads ve citation_checks'te
    yaşanmıştı; denetim oradakinin eşi. Veritabanı tarafında da tetikleyici
    var (20260924100025) — burası kullanıcıya anlaşılır cevap versin diye.
  */
  if (girdi.projectId) {
    const { data: calisma, error: calismaHatasi } = await ctx.supabase
      .from("academic_projects")
      .select("id")
      .eq("id", girdi.projectId)
      .maybeSingle();
    if (calismaHatasi) {
      console.error(calismaHatasi);
      return { error: "Çalışma doğrulanamadı." };
    }
    if (!calisma) return { error: "Bu çalışmaya analiz sonucu ekleyemezsiniz." };
  }

  const { error } = await ctx.supabase.from("analiz_sonuclari").insert({
    owner_id: ctx.user.id,
    project_id: girdi.projectId || null,
    analiz_turu: girdi.analizTuru,
    baslik,
    apa_metni: apaMetni,
    // Sıraya koymak çalışmaya bağlı bir kayıtta anlamlı: editör sırayı çalışmadan okuyor.
    teze_eklenecek: Boolean(girdi.tezeEklenecek && girdi.projectId),
  });

  if (error) {
    console.error(error);
    /*
      42501'i iki ayrı koruma üretiyor: abonelik kapısı ve çalışma bağı
      tetikleyicisi. İkisini aynı mesajla karşılamak, yanlış çalışmayı
      seçmiş kullanıcıya "aboneliğiniz bitti" dedirtirdi.
    */
    if (error.code === "42501") {
      return /çalışmaya kayıt/i.test(error.message ?? "")
        ? { error: "Bu çalışmaya analiz sonucu ekleyemezsiniz." }
        : { error: (await abonelikKapaliMesaji()) };
    }
    return { error: "Sonuç kaydedilemedi; metni kopyalayıp saklayabilirsiniz." };
  }

  yenile();
  return { success: true };
}

/*
  Bir çalışmanın analizleri (Analiz penceresi ve editörün "Analiz ekle"
  penceresi). Sınırsız: pencere düğmesindeki sayı bu listeden geliyor;
  .limit() ile kesilen listeden sayı çıkarmak sessizce eksik sayardı.
  Okunamazsa "okunamadı" ayrı taşınıyor (lib/liste-sonucu.ts): eskiden boş
  liste dönüyordu ve sayfa, pencere ve editörün "Analiz ekle"si geçici bir
  arızada "kaydedilmiş analiz yok" diyordu — öğrenci analizlerini kaybettiğini
  sanıyordu.
*/
export async function calismaAnalizleri(projectId: string): Promise<ListeSonucu<CalismaAnalizi>> {
  if (!UUID.test(projectId)) return listeBasarili([]);
  const ctx = await getAuthContext();
  if (!ctx) return listeBasarili([]);
  const { data, error } = await ctx.supabase
    .from("analiz_sonuclari")
    .select("id, project_id, analiz_turu, baslik, apa_metni, created_at, teze_eklenecek, teze_eklendi")
    .eq("project_id", projectId)
    .eq("owner_id", ctx.user.id)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[analiz] çalışma analizleri okunamadı:", error.message);
    return listeOkunamadi();
  }
  return listeBasarili(data ?? []);
}

/*
  Teze ekleme sırası: yalnızca iki durum sütunu güncellenir (sütun
  düzeyinde grant, migration 20261026131044); başlık ve APA metni hâlâ
  değiştirilemez. Mevcut kaydın güncellenmesi — abonelik kapısı bilerek
  yok (lib/access.ts): engellenen kullanıcı da sırasını yönetebilmeli.
*/
async function siraDurumu(id: string, alanlar: { teze_eklenecek?: boolean; teze_eklendi?: string | null }): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { error: await oturumYokMesaji() };
  if (!UUID.test(id)) return { error: "Kayıt bulunamadı." };
  const { data, error } = await ctx.supabase
    .from("analiz_sonuclari")
    .update(alanlar)
    .eq("id", id)
    .eq("owner_id", ctx.user.id)
    .select("id");
  if (error) {
    console.error("[analiz] sıra güncellenemedi:", error.message);
    return { error: "Güncellenemedi; tekrar deneyin." };
  }
  if (!data?.length) return { error: "Kayıt bulunamadı ya da size ait değil." };
  yenile();
  return { success: true };
}

export async function analizSirasi(id: string, sirada: boolean): Promise<ActionResult> {
  // Sıradan çıkarılan "eklendi" damgasını da bırakır: geri alınca yeniden sıraya girebilsin.
  return siraDurumu(id, sirada ? { teze_eklenecek: true, teze_eklendi: null } : { teze_eklenecek: false });
}

export async function analizTezeEklendi(id: string): Promise<ActionResult> {
  return siraDurumu(id, { teze_eklendi: new Date().toISOString() });
}

export async function getAnalizSonuclari(): Promise<ListeSonucu<AnalizSonucu>> {
  const ctx = await getAuthContext();
  if (!ctx) return listeBasarili([]);

  const { data, error } = await ctx.supabase
    .from("analiz_sonuclari")
    .select("id, project_id, analiz_turu, baslik, apa_metni, created_at")
    .eq("owner_id", ctx.user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error(error);
    return listeOkunamadi();
  }
  return listeBasarili(data);
}

/*
  Kayıt düzenlenemiyor (UPDATE yalnızca teze ekleme sırası sütunlarında):
  yapılmış bir hesabın tutanağı,
  sonradan değiştirilebilseydi iddiaya dönerdi. Yanlışsa silinir ve analiz
  yeniden çalıştırılır — silme de bu yüzden abonelik kapısının dışında.
*/
export async function analizSonucuSil(id: string): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { error: await oturumYokMesaji() };

  const { data, error } = await ctx.supabase
    .from("analiz_sonuclari")
    .delete()
    .eq("id", id)
    .eq("owner_id", ctx.user.id)
    .select("id");

  if (error) {
    console.error(error);
    return { error: "Silinirken bir hata oluştu." };
  }
  if (!data?.length) return { error: "Kayıt bulunamadı ya da size ait değil." };

  yenile();
  return { success: true };
}
