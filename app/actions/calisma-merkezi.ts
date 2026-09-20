"use server";

import { createClient } from "@/lib/supabase/server";
import type { AsistanBulgusu, CalismaOzeti } from "@/lib/calisma-ozeti";
import { calismaKilavuzu } from "@/app/actions/guidelines";

/*
  Çalışma merkezinin verisi: bir çalışmaya bağlı bütün birimler tek yerde.

  Neden gerekti: ArvoLab'ın birimleri (literatür, kaynakça denetimi, belgeler,
  müsvedde, danışmanlık) veritabanında zaten academic_projects'e bağlıydı ama
  arayüzde birbirini görmüyordu. Kullanıcı literatürü bir sayfada topluyor,
  kaynakçayı başka sayfada denetliyor, ikisinin aynı teze ait olduğunu
  yalnızca kendi aklında tutuyordu.

  Okumalar RLS'e tabi; çalışma erişimi orada kararlaştırılıyor. Burada
  yalnızca sayım ve son kayıt var, yazma yok.
*/

/** Kayıtlı bulgular iki biçimde olabilir: dizi ya da {bulgular,aramalar}. */
function sonBulgular(findings: unknown): AsistanBulgusu[] {
  const liste = Array.isArray(findings) ? findings : (findings as { bulgular?: unknown })?.bulgular;
  return Array.isArray(liste) ? (liste as AsistanBulgusu[]).slice(0, 3) : [];
}

export async function calismaOzeti(projectId: string): Promise<CalismaOzeti | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !projectId) return null;

  const { data: calisma, error } = await supabase
    .from("academic_projects")
    .select(
      "id, title, project_type, status, progress, university, institute, department, citation_style, research_method, due_date, priority, assignee_name, updated_at",
    )
    .eq("id", projectId)
    .maybeSingle();

  // Erişimi olmayan kullanıcıya RLS satırı hiç göstermiyor: hata değil, boş.
  if (error) console.error("[merkez] çalışma okunamadı:", error.message);
  if (!calisma) return null;

  const sayim = (tablo: string) =>
    supabase.from(tablo).select("id", { count: "exact", head: true }).eq("project_id", projectId);

  const [musvedde, literatur, okunan, kullanilan, denetim, belgeler, danismanlik, asistan, kilavuz] = await Promise.all([
    supabase.from("project_manuscripts").select("word_count, updated_at").eq("project_id", projectId).maybeSingle(),
    sayim("literature_sources"),
    supabase
      .from("literature_sources")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .eq("status", "read"),
    supabase
      .from("literature_sources")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .eq("status", "used"),
    supabase
      .from("citation_checks")
      .select("id, compliance_score, created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    sayim("document_uploads"),
    sayim("consultancy_requests"),
    supabase
      .from("ai_assistant_runs")
      .select("created_at, findings", { count: "exact" })
      .eq("project_id", projectId)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(1),
    calismaKilavuzu(calisma.university, calisma.institute),
  ]);

  for (const sonuc of [literatur, okunan, kullanilan, belgeler, danismanlik, denetim, musvedde, asistan])
    if (sonuc.error) console.error("[merkez] birim okunamadı:", sonuc.error.message);

  return {
    calisma,
    musvedde: musvedde.data ? { kelime: musvedde.data.word_count ?? 0, guncellendi: musvedde.data.updated_at } : null,
    literatur: {
      toplam: literatur.count ?? 0,
      okunan: okunan.count ?? 0,
      kullanilan: kullanilan.count ?? 0,
    },
    kaynakca: denetim.data
      ? { id: denetim.data.id, skor: denetim.data.compliance_score, tarih: denetim.data.created_at }
      : null,
    belgeSayisi: belgeler.count ?? 0,
    danismanlikSayisi: danismanlik.count ?? 0,
    asistan: {
      toplam: asistan.count ?? 0,
      sonTarih: asistan.data?.[0]?.created_at ?? null,
      sonBulgular: sonBulgular(asistan.data?.[0]?.findings),
    },
    kilavuz: kilavuz
      ? {
          id: kilavuz.id,
          baslik: kilavuz.document_title,
          surum: kilavuz.version_label,
          kurum: kilavuz.university_name,
          enstitu: kilavuz.institute_name,
          atifStili: kilavuz.citation_style,
        }
      : null,
  };
}
