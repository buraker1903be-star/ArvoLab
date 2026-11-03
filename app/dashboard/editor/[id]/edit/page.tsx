import { calismaAdresi } from "@/lib/calisma-karti";
import Link from "next/link";
import { aktifDil, ceviri } from "@/lib/dil-sunucu";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getProjectForEdit } from "@/app/actions/projects";
import { getAuthContext } from "@/lib/auth-guards";
import { CALISMA_OKUNAMADI } from "@/lib/calisma-ozeti";
import { isOversightRole, projectTypeLabel } from "@/lib/project-labels";
import CalismaDuzenleFormu from "../../_duzenle/calisma-duzenle-formu";
import { getUniversities } from "@/app/actions/universities";
import { calismaKilavuzu, kilavuzGorunenAdi } from "@/lib/guideline-rules";

export async function generateMetadata() {
  const t = await ceviri();
  return { title: t({ tr: "Çalışmayı düzenle", en: "Edit work" }) };
}

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await ceviri();
  const { id } = await params;
  const [project, ctx, { satirlar: universities }] = await Promise.all([getProjectForEdit(id), getAuthContext(), getUniversities()]);
  /* Okunamadı ile bulunamadı AYRI: çalışma merkezindeki (../page.tsx) ile
     aynı ayrım. Geçici bir arızada 404 çizmek, kullanıcıya tezinin
     olmadığını söylemekti. */
  if (project === CALISMA_OKUNAMADI) {
    return (
      <main className="dashboard-page">
        <article className="resume-card" role="alert">
          <span className="dashboard-kicker">{t({ tr: "Bağlantı sorunu", en: "Connection problem" })}</span>
          <div className="resume-heading">
            <h2>{t({ tr: "Çalışma yüklenemedi", en: "The work could not be loaded" })}</h2>
            <p>
              {t({
                tr: "Kaydınız yerinde duruyor. Sayfayı yenileyin; sorun sürerse destekten bildirin.",
                en: "Your record is safe. Refresh the page; if the problem persists, report it to support.",
              })}
            </p>
          </div>
          <div className="cluster">
            <Link href={calismaAdresi(id)} className="projects-filter-button">
              {t({ tr: "Çalışmalarım", en: "My works" })}
            </Link>
            <Link href="/dashboard/expert-requests" className="projects-filter-button">
              {t({ tr: "Uygulama Destek", en: "App Support" })}
            </Link>
          </div>
        </article>
      </main>
    );
  }
  if (!project || !ctx) notFound();
  const guideline = await calismaKilavuzu(ctx.supabase, project.id, project.guideline_id);

  const canOversee = isOversightRole(ctx.role);
  const canEdit = canOversee || project.owner_id === ctx.user.id || project.assignee_id === ctx.user.id;
  if (!canEdit) notFound();
  const guidelineLabel = guideline ? `${kilavuzGorunenAdi(guideline.label, await aktifDil())} · ${guideline.citationStyle.toUpperCase()}` : null;

  return (
    <main className="dashboard-page">
      <section className="projects-header">
        <div>
          <span className="dashboard-kicker">{t(projectTypeLabel(project.project_type))}</span>
          <h1>{t({ tr: "Çalışmayı düzenle", en: "Edit work" })}</h1>
          <p>{t({ tr: "Çalışmanın planlama bilgilerini, durumunu ve ilerlemesini güncelleyin.", en: "Update the work's planning details, status and progress." })}</p>
        </div>
        {/* Yazım ekranıyla aynı: çıkış çalışmanın kendi merkezine.
            Düzenlemeyi bitiren kullanıcı listeye değil, çalıştığı teze
            dönmek istiyor. */}
        <Link href={calismaAdresi(id)} className="projects-filter-button">
          <ArrowLeft size={17} aria-hidden="true" />
          {t({ tr: "Çalışmalarım", en: "My works" })}
        </Link>
      </section>

      {/* Form Çalışmalarım'daki "Bilgileri düzenle" penceresiyle ortak. */}
      <CalismaDuzenleFormu
        veri={{ project, universities, guidelineLabel, canOversee }}
        iptal={
          <Link href="/dashboard/editor" className="projects-filter-button">
            {t({ tr: "İptal", en: "Cancel" })}
          </Link>
        }
      />
    </main>
  );
}
