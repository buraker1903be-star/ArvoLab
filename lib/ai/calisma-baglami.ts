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

export type CalismaBaglami = {
  id: string;
  metin: string;
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
    `Tür: ${projectTypeLabel(calisma.project_type)}`,
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
export async function calismaBaglami(projectId?: string | null): Promise<CalismaBaglami | null> {
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
  return { id: data.id, metin: calismaMetni(data as CalismaSatiri) };
}
