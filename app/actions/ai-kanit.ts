"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { aiHataMesaji, aiYapilandirildi, sor } from "@/lib/ai/saglayici";
import { aktifDil, ceviri } from "@/lib/dil-sunucu";
import type { Cevirici, Metin } from "@/lib/dil";
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
  /** Kredi azalıyor (lib/ai/erisim.ts); AsistanSonuc gösterir. */
  krediUyarisi?: string;
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

const RET_MESAJI: Record<Exclude<KanitDogrulamasi, { gecti: true }>["neden"], Metin> = {
  bos: {
    tr: "Asistan değerlendirilebilir bir cevap üretmedi. Tekrar deneyebilirsiniz.",
    en: "The assistant did not produce an answer that could be assessed. You can try again.",
  },
  alinti: {
    tr: "Asistanın gösterdiği alıntı incelenen metinde birebir geçmediği için cevap gösterilmedi. Bu bir güvenlik kontrolüdür; tekrar deneyebilir ya da kendiniz değerlendirebilirsiniz.",
    en: "The answer was not shown because the quote the assistant gave does not appear verbatim in the reviewed text. This is a safety check; you can try again or assess it yourself.",
  },
  kunye: {
    tr: "Asistan metinde olmayan bir kaynak künyesi ürettiği için cevap gösterilmedi.",
    en: "The answer was not shown because the assistant produced a reference that is not in the text.",
  },
  uydurma_sayi: {
    tr: "Asistan verilmeyen sayılar ürettiği için cevap gösterilmedi. Bu bir güvenlik kontrolüdür; tekrar deneyebilirsiniz.",
    en: "The answer was not shown because the assistant produced numbers that were not provided. This is a safety check; you can try again.",
  },
};
const KAYIT_YOK: Metin = { tr: "Kayıt bulunamadı.", en: "Record not found." };

export const kanitAsistaniAcik = async () => aiYapilandirildi();

export async function kanitDegerlendir(girdi: { kanitId: string; zorla?: boolean }): Promise<KanitDegerlendirmeYaniti> {
  const dil = await aktifDil();
  const t = await ceviri();
  if (!UUID.test(String(girdi.kanitId ?? ""))) return { hata: t(KAYIT_YOK) };

  const kapi = await asistanKapisi(dil);
  if (!kapi.ok) return { hata: kapi.hata };

  const supabase = await createClient();
  const { data: kayit, error } = await supabase
    .from("kanit_kayitlari")
    .select("id, project_id, iddia, bolum, atif, kaynak_id, incelenen_metin, incelenen_kapsam")
    .eq("id", girdi.kanitId)
    .maybeSingle();
  if (error) {
    console.error("[ai] kanıt kaydı okunamadı:", error.message);
    return { hata: t({ tr: "Kayıt okunamadı. Birazdan tekrar deneyin.", en: "The record could not be read. Try again shortly." }) };
  }
  if (!kayit) return { hata: t(KAYIT_YOK) };
  if (!kayit.incelenen_metin) {
    return {
      hata: t({
        tr: "Önce kaynaktan iddiayla ilgili metni ekleyin; asistan yalnızca eklenen metne bakar.",
        en: "First add the passage from the source that relates to the claim; the assistant only looks at the text you add.",
      }),
    };
  }

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
    dil,
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
        const uyari = await hukmuIsle(t, kayit.id, kayit.project_id, onceki.id, dogrulama.sonuc);
        return {
          ...dogrulama.sonuc,
          ...(uyari ? { uyari } : {}), krediUyarisi: kapi.uyari ?? undefined,
          kirpilanlar,
          kayitId: onceki.id,
          kayitliCevap: { tarih: onceki.created_at },
        };
      }
    }
  }

  // Hak yalnızca modele gidilecekse yanar.
  const hakHatasi = await asistanHakkiVar(kapi.kullaniciId, dil);
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
      return { hata: t(RET_MESAJI[dogrulama.neden]), kirpilanlar };
    }

    const kayitId = await asistanKaydet({
      ...ortak,
      durum: "completed",
      model: yanit.model,
      cikti: yanit.metin,
      bulgular: { bulgular: dogrulama.sonuc.bulgular, duzey: dogrulama.sonuc.duzey, alinti: dogrulama.sonuc.alinti },
    });

    const uyari = kayitId
      ? await hukmuIsle(t, kayit.id, kayit.project_id, kayitId, dogrulama.sonuc)
      : t({
          tr: "Değerlendirme gösterildi ama asistan kaydı yazılamadığı için kanıt matrisine işlenmedi.",
          en: "The assessment is shown, but it was not added to the evidence matrix because the assistant record could not be saved.",
        });

    return { ...dogrulama.sonuc, ...(uyari ? { uyari } : {}), krediUyarisi: kapi.uyari ?? undefined, kirpilanlar, model: yanit.model, kayitId };
  } catch (hata) {
    const mesaj = aiHataMesaji(hata, dil) ?? t({ tr: "Asistan yanıt veremedi.", en: "The assistant could not respond." });
    console.error("[ai] kanıt değerlendirmesi başarısız", hata instanceof Error ? hata.message : hata);
    await asistanKaydet({ ...ortak, durum: "failed" });
    return { hata: mesaj, kirpilanlar };
  }
}

/** Hükmü kanıt kaydına yazar. Yazılamazsa kullanıcıya gösterilecek uyarıyı döner. */
async function hukmuIsle(
  t: Cevirici,
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
    return t({
      tr: "Değerlendirme gösterildi ama kanıt matrisine işlenemedi (yazma yetkiniz olmayabilir).",
      en: "The assessment is shown, but it could not be added to the evidence matrix (you may not have write permission).",
    });
  }
  revalidatePath(`/dashboard/editor/${projectId}/kanit`);
  revalidatePath(`/dashboard/editor/${projectId}/makale`);
  revalidatePath("/dashboard/editor");
  return null;
}
