"use server";

import { createClient } from "@/lib/supabase/server";
import { ceviri } from "@/lib/dil-sunucu";
import { atifCikarmaStili, stilTanimi } from "@/lib/atif/stiller";
import { calismaBaglami } from "@/lib/ai/calisma-baglami";
import { KAYITLI_SAYFA, kayitliCevapOku, type KayitliCevap } from "@/lib/ai/kayitli-cevaplar";
import { SINIR, kutuphaneSatiri, yazimDenetle, type KutuphaneKaydi } from "@/lib/ai/yazim-asistani";

/*
  KAYITLI AI CEVAPLARI (19.11.2026, kabul turu 2). Kurallar:

  - YALNIZCA kullanıcının kendi, bu çalışmadaki kayıtları. RLS gözetim
    rollerine (controller, academic_manager) kendi kurumlarının kayıtlarını
    da açıyor (gozetim_kapsami); kayıtlı sekme bir "benim geçmişim"
    görünümü, o yüzden sorgu user_id = oturumdaki kullanıcı ile AÇIKÇA
    daraltılır. RLS yine asıl katman: başkasının satırı zaten gelmez.
  - Geçmişi açmak model çağırmaz ve hak tüketmez: asistanKapisi ve
    asistanHakkiVar çağrılmaz, ai_assistant_runs'a satır yazılmaz. Saatlik
    hak bu tablodaki satırlardan sayıldığı için okumak hakkı etkilemez.
  - Abonelik kapısı YOK (lib/access.ts "okumalar"): dış maliyet yok, yeni
    içerik üretilmiyor; aboneliği biten öğrenci kendi geçmişini görebilmeli.
  - Belgeye ekleme kullanıcının düğmesidir ve eklemeden ÖNCE güncel kaynak
    denetimi yeniden çalışır (kayitliCevabiDenetle): cevap üretildiği gün
    geçerli olan bir atıfın kaynağı sonradan Literatür'den silinmiş
    olabilir. Denetim üretimdekiyle aynı (yazimDenetle), kütüphane BUGÜNKÜ.
*/

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type KayitliListe = { hata?: string; cevaplar?: KayitliCevap[]; dahaVar?: boolean };

export async function kayitliYazimCevaplari(projectId: string, oncesi?: string | null): Promise<KayitliListe> {
  const t = await ceviri();
  if (!UUID.test(String(projectId ?? ""))) return { hata: t({ tr: "Çalışma bulunamadı.", en: "Work not found." }) };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { hata: t({ tr: "Oturumunuz kapanmış; yeniden giriş yapın.", en: "Your session has ended; sign in again." }) };

  let sorgu = supabase
    .from("ai_assistant_runs")
    .select("id, created_at, output, findings")
    .eq("user_id", user.id)
    .eq("project_id", projectId)
    .eq("capability", "yazim")
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(KAYITLI_SAYFA + 1);
  if (oncesi && !Number.isNaN(Date.parse(oncesi))) sorgu = sorgu.lt("created_at", oncesi);
  const { data, error } = await sorgu;
  if (error) {
    console.error("[ai-yazim-kayitlari] okunamadı:", error.message);
    return { hata: t({ tr: "Kayıtlı cevaplar okunamadı; tekrar deneyin.", en: "Saved answers could not be read; try again." }) };
  }
  const satirlar = data ?? [];
  const cevaplar = satirlar
    .slice(0, KAYITLI_SAYFA)
    .map((s) => kayitliCevapOku(s))
    .filter((c): c is KayitliCevap => Boolean(c));
  return { cevaplar, dahaVar: satirlar.length > KAYITLI_SAYFA };
}

export type KayitliDenetim = { hata?: string; metin?: string; gorev?: KayitliCevap["gorev"] };

export async function kayitliCevabiDenetle(projectId: string, kayitId: string): Promise<KayitliDenetim> {
  const t = await ceviri();
  if (!UUID.test(String(projectId ?? "")) || !UUID.test(String(kayitId ?? ""))) return { hata: t({ tr: "Kayıt bulunamadı.", en: "Record not found." }) };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { hata: t({ tr: "Oturumunuz kapanmış; yeniden giriş yapın.", en: "Your session has ended; sign in again." }) };

  const { data: satir, error } = await supabase
    .from("ai_assistant_runs")
    .select("id, created_at, output, findings, context")
    .eq("id", kayitId)
    .eq("user_id", user.id)
    .eq("project_id", projectId)
    .eq("capability", "yazim")
    .eq("status", "completed")
    .maybeSingle();
  if (error) {
    console.error("[ai-yazim-kayitlari] kayıt okunamadı:", error.message);
    return { hata: t({ tr: "Kayıt okunamadı; tekrar deneyin.", en: "The record could not be read; try again." }) };
  }
  const cevap = satir ? kayitliCevapOku(satir) : null;
  if (!satir || !cevap) return { hata: t({ tr: "Kayıt bulunamadı.", en: "Record not found." }) };
  if (!cevap.metin) return { hata: t({ tr: "Bu cevapta belgeye eklenecek metin yok.", en: "This answer has no text to insert." }) };

  const calisma = await calismaBaglami(projectId);
  if (!calisma) return { hata: t({ tr: "Çalışma okunamadı; sayfayı yenileyin.", en: "The work could not be read; refresh the page." }) };
  const { data: kaynaklar, error: kaynakHatasi } = await supabase
    .from("literature_sources")
    .select("title, authors, year, container_title, notes, project_id")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(200);
  if (kaynakHatasi) {
    /* Okunamayan kütüphane "boş kütüphane" sayılmaz; denetimsiz ekleme de yapılmaz. */
    console.error("[ai-yazim-kayitlari] kütüphane okunamadı:", kaynakHatasi.message);
    return { hata: t({ tr: "Kaynak kütüphaneniz okunamadı; metin eklenmedi.", en: "Your source library could not be read; the text was not inserted." }) };
  }
  const kutuphane: KutuphaneKaydi[] = [...(kaynaklar ?? [])]
    .sort((a, b) => Number(b.project_id === projectId) - Number(a.project_id === projectId))
    .slice(0, SINIR.kutuphane)
    .map((k) => ({
      yazarlar: k.authors ? String(k.authors).slice(0, 300) : null,
      yil: k.year ? String(k.year).slice(0, 10) : null,
      baslik: String(k.title ?? "").slice(0, 300),
      yayin: k.container_title ? String(k.container_title) : null,
      not: k.notes ? String(k.notes) : null,
    }));
  const stil = stilTanimi(calisma.atifStili);
  /* Sayı denetiminin bağlamı: cevabın üretildiği istem (context) ve bugünkü kütüphane. */
  const baglam = [String(satir.context ?? ""), ...kutuphane.map((k, i) => kutuphaneSatiri(k, i + 1))];
  const denetim = yazimDenetle(`${cevap.metin}\n${cevap.yanit}`, kutuphane, baglam, atifCikarmaStili(stil));
  if (!denetim.gecti) {
    const ayrinti = denetim.ayrinti.slice(0, 3).join(", ");
    return {
      hata:
        denetim.neden === "kunye"
          ? t({
              tr: `Bu cevaptaki bir atıfın kaynağı artık kütüphanenizde yok (${ayrinti}); metin eklenmedi. Kaynağı Literatür'e geri ekleyin ya da yeni bir cevap isteyin.`,
              en: `A source cited in this answer is no longer in your library (${ayrinti}); the text was not inserted. Add the source back to Literature or ask for a new answer.`,
            })
          : t({
              tr: `Bu cevaptaki bir sayı bugünkü bağlamda doğrulanamadı (${ayrinti}); metin eklenmedi.`,
              en: `A number in this answer could not be verified against the current context (${ayrinti}); the text was not inserted.`,
            }),
    };
  }
  return { metin: cevap.metin, gorev: cevap.gorev };
}
