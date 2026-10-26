"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { aiYapilandirildi, sor } from "@/lib/ai/saglayici";
import { asistanHakkiVar, asistanKapisi } from "@/lib/ai/erisim";
import { asistanKaydet } from "@/lib/ai/kayit";
import { oncekiCevap } from "@/lib/ai/gecmis";
import { calismaBaglami } from "@/lib/ai/calisma-baglami";
import type { Bulgu } from "@/lib/ai/bulgu";
import {
  gerekceMetni,
  kanitCozumle,
  kanitDogrula,
  kanitIstemi,
  type HukumDuzeyi,
  type KanitDogrulamasi,
} from "@/lib/ai/kanit-degerlendirme";

/*
  İddia–kanıt uyumu. Bağlam istemciden GELMEZ: kayıt kimliğiyle
  veritabanından okunur. Hem RLS erişimi sınırlar hem de istemci başka
  bir metin göndererek kaydedilen hükmü değiştiremez — hüküm, kayıtta
  duran metne verilmiş olur.

  Kayıt akışı (AGENTS.md): her çalışma ai_assistant_runs'a yazılır.
  Hüküm kanıt kaydına ANCAK o kayıt yazılabildiyse işlenir; veritabanı
  tetikleyicisi "asistan değerlendirdi" diyen satırın tamamlanmış bir
  asistan kaydına bağlanmasını şart koşuyor.
*/

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type KanitDegerlendirmeYaniti = {
  hata?: string;
  /** Hüküm gösterildi ama kanıt kaydına işlenemedi. */
  uyari?: string;
  duzey?: HukumDuzeyi;
  alinti?: string;
  bulgular?: Bulgu[];
  kirpilanlar?: string[];
  model?: string;
  kayitId?: string | null;
  kayitliCevap?: { tarih: string } | null;
};

const RET_MESAJI: Record<Exclude<KanitDogrulamasi, { gecti: true }>["neden"], string> = {
  bos: "Asistan değerlendirilebilir bir cevap üretmedi. Tekrar deneyebilirsiniz.",
  alinti: "Asistanın gösterdiği alıntı incelenen metinde birebir geçmediği için cevap gösterilmedi. Bu bir güvenlik kontrolüdür; tekrar deneyebilir ya da kendiniz değerlendirebilirsiniz.",
  kunye: "Asistan metinde olmayan bir kaynak künyesi ürettiği için cevap gösterilmedi.",
  uydurma_sayi: "Asistan verilmeyen sayılar ürettiği için cevap gösterilmedi. Bu bir güvenlik kontrolüdür; tekrar deneyebilirsiniz.",
};

export const kanitAsistaniAcik = async () => aiYapilandirildi();

export async function kanitDegerlendir(girdi: { kanitId: string; zorla?: boolean }): Promise<KanitDegerlendirmeYaniti> {
  if (!UUID.test(String(girdi.kanitId ?? ""))) return { hata: "Kayıt bulunamadı." };

  const kapi = await asistanKapisi();
  if (!kapi.ok) return { hata: kapi.hata };

  const supabase = await createClient();
  const { data: kayit, error } = await supabase
    .from("kanit_kayitlari")
    .select("id, project_id, iddia, bolum, atif, kaynak_id, incelenen_metin, incelenen_kapsam")
    .eq("id", girdi.kanitId)
    .maybeSingle();
  if (error) {
    console.error("[ai] kanıt kaydı okunamadı:", error.message);
    return { hata: "Kayıt okunamadı. Birazdan tekrar deneyin." };
  }
  if (!kayit) return { hata: "Kayıt bulunamadı." };
  if (!kayit.incelenen_metin) return { hata: "Önce kaynaktan iddiayla ilgili metni ekleyin; asistan yalnızca eklenen metne bakar." };

  let kunye: string | null = null;
  if (kayit.kaynak_id) {
    const { data: kaynak } = await supabase
      .from("literature_sources")
      .select("title, authors, year, container_title")
      .eq("id", kayit.kaynak_id)
      .maybeSingle();
    if (kaynak) kunye = [kaynak.authors, kaynak.year ? `(${kaynak.year})` : null, kaynak.title, kaynak.container_title].filter(Boolean).join(" ");
  }

  const calisma = await calismaBaglami(kayit.project_id);
  const incelenenMetin = String(kayit.incelenen_metin);
  const { mesajlar, kaynak, kirpilanlar } = kanitIstemi({
    calisma: calisma?.metin,
    iddia: kayit.iddia,
    bolum: kayit.bolum,
    atif: kayit.atif,
    kunye,
    incelenenMetin,
    kapsam: kayit.incelenen_kapsam === "tam_metin" ? "tam_metin" : "bolum",
  });

  /*
    Aynı iddia ve aynı metin daha önce değerlendirildiyse modele
    gidilmez; kayıtlı hüküm YENİDEN denetlenip işlenir (denetim ucuz ve
    kuralı değişmiş olabilir).
  */
  if (!girdi.zorla) {
    const onceki = await oncekiCevap(kapi.kullaniciId, "kanit", kaynak);
    if (onceki) {
      const ham = (onceki.ham ?? {}) as { duzey?: unknown; alinti?: unknown };
      const dogrulama = kanitDogrula(
        kanitCozumle(JSON.stringify({ duzey: ham.duzey, alinti: ham.alinti, bulgular: onceki.bulgular })),
        { incelenenMetin, kaynak },
      );
      if (dogrulama.gecti) {
        const uyari = await hukmuIsle(kayit.id, kayit.project_id, onceki.id, dogrulama.sonuc);
        return {
          ...dogrulama.sonuc,
          ...(uyari ? { uyari } : {}),
          kirpilanlar,
          kayitId: onceki.id,
          kayitliCevap: { tarih: onceki.created_at },
        };
      }
    }
  }

  // Hak yalnızca modele gidilecekse yanar.
  const hakHatasi = await asistanHakkiVar(kapi.kullaniciId);
  if (hakHatasi) return { hata: hakHatasi };

  const basladi = Date.now();
  const ortak = { kullaniciId: kapi.kullaniciId, calismaId: calisma?.id ?? null, yetenek: "kanit" as const, baglam: kaynak, basladi };

  try {
    const yanit = await sor(mesajlar, { yetenek: "kanit", jsonBekle: true, sicaklik: 0, enFazlaJeton: 1500 });
    const sonuc = kanitCozumle(yanit.metin);
    const dogrulama = kanitDogrula(sonuc, { incelenenMetin, kaynak });

    if (!dogrulama.gecti) {
      console.error("[ai] kanıt değerlendirmesi reddedildi", { model: yanit.model, neden: dogrulama.neden, ayrinti: dogrulama.ayrinti });
      await asistanKaydet({ ...ortak, durum: "rejected", redNedeni: dogrulama.neden, model: yanit.model, cikti: yanit.metin, bulgular: { bulgular: sonuc.bulgular, duzey: sonuc.duzey, alinti: sonuc.alinti } });
      return { hata: RET_MESAJI[dogrulama.neden], kirpilanlar };
    }

    const kayitId = await asistanKaydet({
      ...ortak,
      durum: "completed",
      model: yanit.model,
      cikti: yanit.metin,
      bulgular: { bulgular: dogrulama.sonuc.bulgular, duzey: dogrulama.sonuc.duzey, alinti: dogrulama.sonuc.alinti },
    });

    const uyari = kayitId
      ? await hukmuIsle(kayit.id, kayit.project_id, kayitId, dogrulama.sonuc)
      : "Değerlendirme gösterildi ama asistan kaydı yazılamadığı için kanıt matrisine işlenmedi.";

    return { ...dogrulama.sonuc, ...(uyari ? { uyari } : {}), kirpilanlar, model: yanit.model, kayitId };
  } catch (hata) {
    const mesaj = hata instanceof Error ? hata.message : "Asistan yanıt veremedi.";
    console.error("[ai] kanıt değerlendirmesi başarısız", mesaj);
    await asistanKaydet({ ...ortak, durum: "failed" });
    return { hata: mesaj, kirpilanlar };
  }
}

/** Hükmü kanıt kaydına yazar. Yazılamazsa kullanıcıya gösterilecek uyarıyı döner. */
async function hukmuIsle(
  kanitId: string,
  projectId: string,
  asistanKaydi: string,
  sonuc: { duzey: HukumDuzeyi; alinti: string; bulgular: Bulgu[] },
): Promise<string | null> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("kanit_kayitlari")
    .update({
      destek_duzeyi: sonuc.duzey,
      // "Doğrulanamadı"da alıntı yok; kullanıcının kendi seçtiği alıntı korunur.
      ...(sonuc.duzey !== "dogrulanamadi" ? { alinti: sonuc.alinti } : {}),
      degerlendiren: "asistan",
      gerekce: gerekceMetni(sonuc.bulgular),
      asistan_kaydi: asistanKaydi,
      degerlendirildi: new Date().toISOString(),
      insan_incelemesi: "bekliyor",
    })
    .eq("id", kanitId);
  if (error) {
    console.error("[ai] kanıt hükmü işlenemedi:", error.code, error.message);
    return "Değerlendirme gösterildi ama kanıt matrisine işlenemedi (yazma yetkiniz olmayabilir).";
  }
  revalidatePath(`/dashboard/editor/${projectId}/kanit`);
  revalidatePath(`/dashboard/editor/${projectId}/makale`);
  revalidatePath("/dashboard/editor");
  return null;
}
