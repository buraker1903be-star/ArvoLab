/*
  Asistana çalışmanın kimliğini tanıtan bağlam parçası.

  Neden: asistan şimdiye kadar yalnızca kullanıcının o anda yapıştırdığı
  metni görüyordu. Oysa çalışmanın atıf stili, araştırma yöntemi ve türü
  veritabanında kayıtlı. Bunları bilmeden verilen denetim genel kalıyor:
  APA beklenen yerde Vancouver kuralı anlatılabiliyor, nitel bir çalışmada
  etki büyüklüğü aranabiliyor.

  Bilerek "use server" DEĞİL (AGENTS.md): yardımcılar böyle dosyalarda
  durmaz. Saf kısmı (metne çevirme) testi tests/unit/ai-calisma-baglami.ts.
*/

import { createClient } from "@/lib/supabase/server";
import { projectTypeLabel } from "@/lib/project-labels";
import { STIL_ETIKETLERI } from "@/lib/atif/stiller";
import { makaleProfiliMetni, type MakaleBaglami, type MakaleProfilSatiri } from "./makale-baglami";

const MAKALE_SUTUNLARI =
  "makale_turu, dil, arastirma_problemi, arastirma_sorusu, arastirma_tasarimi, disiplin, hedef_dergi, dergi_kurallari_adresi, dergi_kurallari_notu, raporlama_standardi, kelime_siniri, ozet_siniri, anahtar_en_az, anahtar_en_cok, veri_durumu";

export type CalismaBaglami = {
  id: string;
  metin: string;
  /** Çalışmanın atıf sistemi; sistem istemine giriyor. */
  atifStili: string | null;
  /**
   * Makale profili (yalnızca `makale: true` istenince ve çalışma makale
   * türündeyse). null: makale ama profil kayıtlı değil ya da okunamadı.
   */
  makale?: MakaleBaglami | null;
};



const YONTEM: Record<string, string> = {
  quantitative: "Nicel",
  qualitative: "Nitel",
  mixed: "Karma yöntem",
  review: "Derleme",
};

export type CalismaSatiri = {
  id: string;
  title: string;
  project_type: string;
  citation_style: string;
  research_method: string | null;
  university: string | null;
  department: string | null;
};

/** Çalışma kaydını modele okunur tek bir bloğa çevirir. Saf fonksiyon. */
export function calismaMetni(calisma: CalismaSatiri): string {
  const satirlar = [
    `Başlık: ${calisma.title}`,
    /* Asistan istemi Türkçe; bağlam da Türkçe kalır. */
    `Tür: ${projectTypeLabel(calisma.project_type).tr}`,
    `Atıf stili: ${STIL_ETIKETLERI[calisma.citation_style] ?? calisma.citation_style}`,
  ];
  if (calisma.research_method)
    satirlar.push(`Araştırma yöntemi: ${YONTEM[calisma.research_method] ?? calisma.research_method}`);
  if (calisma.university)
    satirlar.push(`Kurum: ${[calisma.university, calisma.department].filter(Boolean).join(" · ")}`);
  return satirlar.join("\n");
}

/**
 * Çalışmayı okur ve bağlam metnini üretir. Erişim RLS'e tabi: başkasının
 * çalışmasının kimliği gönderilse bile satır dönmez, bağlam da kurulmaz.
 * Bu aynı zamanda kaydın yabancı bir çalışmaya iliştirilmesini engeller.
 */
export async function calismaBaglami(projectId?: string | null, secenek: { makale?: boolean } = {}): Promise<CalismaBaglami | null> {
  if (!projectId) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("academic_projects")
    .select("id, title, project_type, citation_style, research_method, university, department")
    .eq("id", projectId)
    .maybeSingle();

  if (error) {
    // Okunamazsa akış durmaz: asistan çalışmasız bağlamla çalışır.
    console.error("[ai] çalışma bağlamı okunamadı:", error.message);
    return null;
  }
  if (!data) return null;
  /* Atıf stili AYRICA dönüyor: sistem istemi modelin kimliğini
     belirliyor ve bağlam metnindeki bir satır onu ezmiyor
     (lib/ai/kaynakca-denetimi'deki gerekçe). */
  const sonuc: CalismaBaglami = {
    id: data.id,
    metin: calismaMetni(data as CalismaSatiri),
    atifStili: (data as CalismaSatiri).citation_style ?? null,
  };
  /*
    Makale profili yalnızca İSTEYEN yetenekte okunur (bugün yazım
    asistanı). Analiz, kaynakça ve kanıt denetimleri sayı denetimiyle
    çalışıyor; profilin sınır sayıları onların denetim kaynağına girerse
    uydurma bir değeri "bağlamda var" diye geçirebilirdi.
    Profil AYNI çalışma kimliğiyle okunur (RLS de çalışmayı görebilene
    sınırlar): başka bir çalışmanın profili bağlama giremez.
  */
  if (secenek.makale && data.project_type === "article") {
    const { data: profil, error: profilHatasi } = await supabase.from("makale_profili").select(MAKALE_SUTUNLARI).eq("project_id", data.id).maybeSingle();
    if (profilHatasi) console.error("[ai] makale profili okunamadı:", profilHatasi.message);
    sonuc.makale = profil ? makaleProfiliMetni(profil as MakaleProfilSatiri) : null;
  }
  return sonuc;
}
