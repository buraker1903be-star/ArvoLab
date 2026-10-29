import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashShareToken, isShareTokenFormat } from "@/lib/share-token";
import { recordShareView } from "@/lib/share-views";
import { calismaKilavuzu } from "@/lib/guideline-rules";
import { refreshImageUrls } from "@/lib/manuscript-images";
import { buildPrintSheet } from "@/lib/print-sheet";
import type { CoverPage } from "@/app/actions/manuscript";
import type { TiptapDoc } from "@/lib/tiptap-text";
import ManuscriptSheet from "@/app/print/manuscript/manuscript-sheet";
import { aktifDil, ceviri, tarihler } from "@/lib/dil-sunucu";
import { belgeDili } from "@/lib/belge-dili";
import { kagitOku } from "@/lib/kagit-boyutu";

// Danışmana salt okunur paylaşım: giriş gerekmez; bağlantı özetine göre sunucuda (service role)
// aranır, süresi dolmuş ya da iptal edilmişse metin gösterilmez. Arama motorlarına kapalıdır,
// başka siteye yönlendirmede adres (belirteç) gönderilmez. Çalışmanın iç bilgileri
// (notlar, atanan uzman, durum) gösterilmez; yalnızca kaydedilmiş metnin baskı görünümü.
export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const t = await ceviri();
  return {
    title: t({ tr: "Paylaşılan çalışma", en: "Shared work" }),
    robots: { index: false, follow: false },
    referrer: "no-referrer",
  };
}

async function Unavailable() {
  const t = await ceviri();
  return (
    <main className="share-unavailable">
      <h1>{t({ tr: "Bağlantı kullanılamıyor", en: "Link unavailable" })}</h1>
      <p>
        {t({
          tr: "Bu paylaşım bağlantısı geçersiz, süresi dolmuş ya da iptal edilmiş. Çalışmanın sahibinden yeni bir bağlantı isteyin.",
          en: "This share link is invalid, has expired or has been revoked. Ask the owner of the work for a new link.",
        })}
      </p>
    </main>
  );
}

/*
  Okuma hatası "geçersiz bağlantı" DEĞİLDİR. Üç sorgunun da error'ı
  okunmuyordu; service_role izinleri verilmediği için her geçerli bağlantı
  "permission denied" alıyor, kullanıcı ise "süresi dolmuş" görüyordu.
  Özellik uçtan uca ölüydü ve sebebi hiçbir yerde görünmüyordu. İki durumu
  ayırmak, aynı sınıftan bir hatanın bir daha sessizce yaşamasını engeller.
*/
async function TemporarilyUnavailable() {
  const t = await ceviri();
  return (
    <main className="share-unavailable">
      <h1>{t({ tr: "Bağlantı şu anda açılamıyor", en: "The link cannot be opened right now" })}</h1>
      <p>{t({ tr: "Geçici bir sorun oluştu. Lütfen birkaç dakika sonra tekrar deneyin.", en: "A temporary problem occurred. Please try again in a few minutes." })}</p>
    </main>
  );
}

export default async function SharedManuscriptPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isShareTokenFormat(token)) return <Unavailable />;

  const admin = createAdminClient();
  const { data: link, error: linkError } = await admin
    .from("manuscript_share_links")
    .select("id, project_id, expires_at, view_count, created_by, label")
    .eq("token_hash", hashShareToken(token))
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (linkError) {
    console.error("[share] bağlantı okunamadı", { code: linkError.code, message: linkError.message });
    return <TemporarilyUnavailable />;
  }
  if (!link) return <Unavailable />;

  const { data: project, error: projectError } = await admin
    .from("academic_projects")
    .select("title, guideline_id, owner_id, assignee_id")
    .eq("id", link.project_id)
    .maybeSingle();
  if (projectError) {
    console.error("[share] çalışma okunamadı", { code: projectError.code, message: projectError.message });
    return <TemporarilyUnavailable />;
  }
  if (!project) return <Unavailable />;

  const [{ data: row, error: manuscriptError }, guideline] = await Promise.all([
    admin.from("project_manuscripts").select("*").eq("project_id", link.project_id).maybeSingle(),
    /* Öğrencinin PDF'iyle aynı kılavuz; eskiden yalnızca katalog okunuyor,
       yüklenen kılavuzla yazılan çalışma danışmana biçimsiz görünüyordu. */
    calismaKilavuzu(admin, link.project_id, project.guideline_id),
  ]);
  if (manuscriptError) {
    console.error("[share] metin okunamadı", { code: manuscriptError.code, message: manuscriptError.message });
    return <TemporarilyUnavailable />;
  }
  const manuscript = row
    ? {
        margins: {
          top: row.margin_top_cm ?? 2.5,
          bottom: row.margin_bottom_cm ?? 2.5,
          left: row.margin_left_cm ?? 2.5,
          right: row.margin_right_cm ?? 2.5,
        },
        pageSize: kagitOku(row.page_size),
        showPageNumbers: row.show_page_numbers ?? true,
        coverPage: (row.cover_page as CoverPage | null) ?? null,
        headingNumbering: row.heading_numbering ?? false,
        includeToc: row.include_toc ?? false,
      }
    : null;
  // Resimler yalnızca bu çalışmaya ait depo klasörlerinden imzalanır (çalışma, sahibi, atanan uzman).
  const doc = row ? await refreshImageUrls(row.content as TiptapDoc, [link.project_id, project.owner_id, project.assignee_id], admin) : null;

  // Görüntülenme sayısı; ilk açılışta bağlantıyı oluşturana panel içi bildirim (en iyi çaba)
  await recordShareView(admin, link, project.title ?? "Çalışma");

  const t = await ceviri();
  const { uzunTarih } = await tarihler();
  const dil = await belgeDili(admin, link.project_id, await aktifDil());
  const sheet = buildPrintSheet(manuscript, guideline, doc, dil);
  const until = uzunTarih(link.expires_at);

  return (
    <div className="print-page">
      <div className="print-toolbar no-print">
        <span className="print-hint">
          {t({
            tr: `Salt okunur paylaşım · ${until} tarihine kadar geçerli · Yazdırmak için tarayıcının yazdır komutunu kullanın.`,
            en: `Read-only share · valid until ${until} · Use your browser's print command to print.`,
          })}
        </span>
      </div>
      <ManuscriptSheet title={project.title ?? t({ tr: "Çalışma", en: "Work" })} sheet={sheet} dil={dil} />
    </div>
  );
}
