import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashShareToken, isShareTokenFormat } from "@/lib/share-token";
import { loadAppliedGuideline } from "@/lib/guideline-rules";
import { refreshImageUrls } from "@/lib/manuscript-images";
import { buildPrintSheet } from "@/lib/print-sheet";
import type { CoverPage } from "@/app/actions/manuscript";
import type { TiptapDoc } from "@/lib/tiptap-text";
import ManuscriptSheet from "@/app/print/manuscript/manuscript-sheet";

// Danışmana salt okunur paylaşım: giriş gerekmez; bağlantı özetine göre sunucuda (service role)
// aranır, süresi dolmuş ya da iptal edilmişse metin gösterilmez. Arama motorlarına kapalıdır,
// başka siteye yönlendirmede adres (belirteç) gönderilmez. Çalışmanın iç bilgileri
// (notlar, atanan uzman, durum) gösterilmez; yalnızca kaydedilmiş metnin baskı görünümü.
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Paylaşılan çalışma · ArvoLab",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

function Unavailable() {
  return (
    <main className="share-unavailable">
      <h1>Bağlantı kullanılamıyor</h1>
      <p>Bu paylaşım bağlantısı geçersiz, süresi dolmuş ya da iptal edilmiş. Çalışmanın sahibinden yeni bir bağlantı isteyin.</p>
    </main>
  );
}

export default async function SharedManuscriptPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isShareTokenFormat(token)) return <Unavailable />;

  const admin = createAdminClient();
  const { data: link } = await admin
    .from("manuscript_share_links")
    .select("id, project_id, expires_at, view_count")
    .eq("token_hash", hashShareToken(token))
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!link) return <Unavailable />;

  const { data: project } = await admin
    .from("academic_projects")
    .select("title, guideline_id, owner_id, assignee_id")
    .eq("id", link.project_id)
    .maybeSingle();
  if (!project) return <Unavailable />;

  const [{ data: row }, guideline] = await Promise.all([
    admin.from("project_manuscripts").select("*").eq("project_id", link.project_id).maybeSingle(),
    loadAppliedGuideline(admin, project.guideline_id),
  ]);
  const manuscript = row
    ? {
        margins: {
          top: row.margin_top_cm ?? 2.5,
          bottom: row.margin_bottom_cm ?? 2.5,
          left: row.margin_left_cm ?? 2.5,
          right: row.margin_right_cm ?? 2.5,
        },
        showPageNumbers: row.show_page_numbers ?? true,
        coverPage: (row.cover_page as CoverPage | null) ?? null,
        headingNumbering: row.heading_numbering ?? false,
      }
    : null;
  // Resimler yalnızca metnin yazarlarının depo klasöründen imzalanır.
  const doc = row ? await refreshImageUrls(row.content as TiptapDoc, [project.owner_id, project.assignee_id], admin) : null;

  // Görüntülenme sayısı (en iyi çaba; sahibi pencerede görür)
  await admin
    .from("manuscript_share_links")
    .update({ view_count: (link.view_count ?? 0) + 1, last_viewed_at: new Date().toISOString() })
    .eq("id", link.id);

  const sheet = buildPrintSheet(manuscript, guideline, doc);
  const until = new Date(link.expires_at).toLocaleDateString("tr-TR", { dateStyle: "long" });

  return (
    <div className="print-page">
      <div className="print-toolbar no-print">
        <span className="print-hint">Salt okunur paylaşım · {until} tarihine kadar geçerli · Yazdırmak için tarayıcının yazdır komutunu kullanın.</span>
      </div>
      <ManuscriptSheet title={project.title ?? "Çalışma"} sheet={sheet} />
    </div>
  );
}
