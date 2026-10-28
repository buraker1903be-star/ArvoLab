import type { Metadata } from "next";
import { isSubscriptionBlocked, abonelikKapaliMesaji } from "@/lib/access";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getManuscript } from "@/app/actions/manuscript";
import { calismaKilavuzu } from "@/lib/guideline-rules";
import { refreshImageUrls } from "@/lib/manuscript-images";
import { buildPrintSheet } from "@/lib/print-sheet";
import ManuscriptSheet from "../manuscript-sheet";
import PrintActions from "./print-actions";
import SayfaliBaski from "../sayfali-baski";
import { aktifDil, ceviri } from "@/lib/dil-sunucu";
import { belgeDili } from "@/lib/belge-dili";

/*
  Sekme başlığı, "PDF olarak kaydet"in önerdiği DOSYA ADI. Eskiden sabit
  "Yazdır · ArvoLab" idi: öğrencinin tezi o adla iniyordu. Başlık okunamazsa
  (RLS, silinmiş kayıt) sayfanın kendisi zaten 404 veriyor.
*/
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("academic_projects").select("title").eq("id", id).maybeSingle();
  const t = await ceviri();
  return { title: { absolute: data?.title?.trim() || t({ tr: "Çalışma", en: "Work" }) }, robots: { index: false } };
}

// Yazdırmaya hazır A4 görünümü: kılavuzun yazı tipi, boyutu, satır aralığı ve
// metnin kenar boşlukları; tarayıcının yazdır penceresinden "PDF olarak kaydet".
export default async function PrintManuscriptPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ auto?: string }>;
}) {
  const [{ id }, { auto }] = await Promise.all([params, searchParams]);
  const supabase = await createClient();

  /*
    Abonelik kapısı: bu sayfa /dashboard DIŞINDA olduğu için paneldeki kapıya
    takılmıyordu. Deneme süresi bittikten sonra metnin tamamı yazdırma
    görünümünde açılmaya devam ediyordu.
  */
  if (await isSubscriptionBlocked()) {
    return (
      <div className="print-page">
        <p style={{ padding: "2rem", textAlign: "center" }}>{(await abonelikKapaliMesaji())}</p>
      </div>
    );
  }

  const { data: project } = await supabase
    .from("academic_projects")
    .select("id, title, guideline_id, owner_id, assignee_id")
    .eq("id", id)
    .maybeSingle();
  if (!project) notFound();

  const [manuscript, guideline, dil] = await Promise.all([
    getManuscript(id),
    calismaKilavuzu(supabase, id, project.guideline_id),
    aktifDil().then((arayuz) => belgeDili(supabase, id, arayuz)),
  ]);
  // Resim bağlantıları depo yolundan tazelenir (süresi dolmuş imzalı bağlantılar çıktıda kaybolmasın).
  const doc = manuscript ? await refreshImageUrls(manuscript.content, [project.id, project.owner_id, project.assignee_id]) : null;
  const sheet = buildPrintSheet(manuscript, guideline, doc, dil);

  return (
    <div className="print-page">
      {/* Otomatik yazdırma sayfalama bitince (sayfali-baski.tsx); erken basılırsa yarım sayfalar çıkar. */}
      <PrintActions backHref={`/dashboard/editor/${id}/write`} autoPrint={false} />
      <ManuscriptSheet title={project.title ?? ""} sheet={sheet} dil={dil} />
      <SayfaliBaski otomatikYazdir={auto === "1"} />
    </div>
  );
}
