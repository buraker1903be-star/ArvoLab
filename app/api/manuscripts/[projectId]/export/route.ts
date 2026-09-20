import { NextRequest, NextResponse } from "next/server";
import { Packer } from "docx";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSubscriptionBlocked, SUBSCRIPTION_BLOCKED_MESSAGE } from "@/lib/access";
import { buildDocxFromTiptap, type DocxImage } from "@/lib/tiptap-docx";
import { loadAppliedGuideline } from "@/lib/guideline-rules";
import { readImageInfo } from "@/lib/image-info";
import { downloadWriterImage, storagePathFromUrl } from "@/lib/manuscript-images";
import type { TiptapDoc } from "@/lib/tiptap-text";

// Büyük/resimli belgelerde Word oluşturma zaman alabilir.
export const maxDuration = 60;

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const WORD_TURU = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
/** Bu boyutun üstündeki dosya doğrudan yanıtla dönmez (Vercel ~4,5 MB sınırı). */
const DIREKT_YANIT_SINIRI = 3.5 * 1024 * 1024;

function toDocxImage(buffer: Buffer): DocxImage | null {
  if (buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES) return null;
  const info = readImageInfo(buffer);
  return info ? { data: buffer, ...info } : null;
}

// Word dosya adı: Türkçe karakterler korunur (RFC 5987), eski tarayıcılar için ASCII yedek.
/** "Tezimin adı.docx" — Türkçe karakterler korunur. */
function wordDosyaAdi(title: string) {
  const clean = title.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 120) || "arvolab-calisma";
  return `${clean}.docx`;
}

function contentDisposition(title: string) {
  const clean = title.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 120) || "arvolab-calisma";
  const ascii = clean
    .replace(/ı/g, "i")
    .replace(/İ/g, "I")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_ ]/g, "")
    .trim()
    .replace(/\s+/g, "_") || "arvolab-calisma";
  return `attachment; filename="${ascii}.docx"; filename*=UTF-8''${encodeURIComponent(`${clean}.docx`)}`;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 });
  }

  /*
    Abonelik kapısı: route handler app/dashboard/layout.tsx'i ÇALIŞTIRMAZ, bu
    yüzden buradaki kontrol şart. Deneme süresi bittikten sonra da tam Word
    çıktısı indirilmeye devam ediyordu.
  */
  if (await isSubscriptionBlocked()) {
    return NextResponse.json({ error: SUBSCRIPTION_BLOCKED_MESSAGE }, { status: 402 });
  }

  // RLS: çalışmayı göremeyen kullanıcı buradan öteye geçemez.
  const { data: project } = await supabase
    .from("academic_projects")
    .select("title, guideline_id, owner_id, assignee_id")
    .eq("id", projectId)
    .maybeSingle();

  if (!project) {
    return NextResponse.json({ error: "Çalışma bulunamadı." }, { status: 404 });
  }

  const { data: manuscript, error } = await supabase
    .from("project_manuscripts")
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle();

  if (error) {
    console.error(error);
    return NextResponse.json({ error: "Metin okunamadı." }, { status: 500 });
  }
  if (!manuscript) {
    return NextResponse.json({ error: "Bu çalışma için henüz kaydedilmiş bir metin yok." }, { status: 404 });
  }

  // Editörde görünen gövde yazı tipi/boyutu/satır aralığı kılavuzun son onaylı sürümünden gelir; Word'de de aynısı.
  const guideline = await loadAppliedGuideline(supabase, project.guideline_id);
  const textDefaults = guideline
    ? {
        fontFamily: guideline.settings.fontFamily,
        fontSizePt: guideline.settings.fontSizePt,
        lineSpacing: guideline.settings.lineSpacing,
        chapterUppercase: guideline.settings.chapterUppercase,
        chapterNewPage: guideline.settings.chapterNewPage,
      }
    : {};
  const writerIds = [project.owner_id, project.assignee_id];

  const doc = await buildDocxFromTiptap({
    title: project.title ?? "ArvoLab Çalışması",
    doc: manuscript.content as TiptapDoc,
    margins: {
      top: manuscript.margin_top_cm ?? 2.5,
      bottom: manuscript.margin_bottom_cm ?? 2.5,
      left: manuscript.margin_left_cm ?? 2.5,
      right: manuscript.margin_right_cm ?? 2.5,
    },
    showPageNumbers: manuscript.show_page_numbers ?? true,
    coverPage: manuscript.cover_page ?? null,
    textDefaults,
    includeToc: manuscript.include_toc ?? false,
    headingNumbering: manuscript.heading_numbering ?? false,
    // Resimler dış adresten değil, yalnızca metnin yazarlarının depo klasöründen alınır (SSRF yok);
    // böylece imzalı bağlantının süresi dolsa ya da çıktıyı atanan uzman alsa da resim Word'e girer.
    fetchImage: async (src: string) => {
      try {
        const dataUrl = src.match(/^data:image\/(?:png|jpeg|gif);base64,(.+)$/);
        if (dataUrl) return toDocxImage(Buffer.from(dataUrl[1], "base64"));

        const path = storagePathFromUrl(src);
        if (!path) return null;
        const data = await downloadWriterImage(path, writerIds);
        return data ? toDocxImage(data) : null;
      } catch {
        return null;
      }
    },
  });

  const buffer = await Packer.toBuffer(doc);
  const dosyaAdi = wordDosyaAdi(project.title ?? "arvolab-calisma");

  /*
    Vercel yanıt gövdesini ~4,5 MB ile sınırlıyor: resimli tezlerde Word
    dosyası bu sınırı aşınca indirme sessizce boş kalıyordu. Büyük dosya
    kullanıcının kendi klasörüne yazılır ve kısa ömürlü imzalı bağlantısı
    döner; tarayıcı doğrudan depodan indirir (app/dashboard/editor/[id]/write
    içindeki handleExport bu iki biçimi de anlar).
  */
  if (buffer.length > DIREKT_YANIT_SINIRI) {
    const admin = createAdminClient();
    const yol = `${user.id}/exports/${projectId}.docx`;
    const { error: yuklemeHatasi } = await admin.storage.from("project-files").upload(yol, new Uint8Array(buffer), {
      contentType: WORD_TURU,
      upsert: true,
    });
    if (yuklemeHatasi) {
      console.error("Word çıktısı depoya yazılamadı:", yuklemeHatasi.message);
      return NextResponse.json({ error: "Word dosyası çok büyük ve hazırlanamadı. Resimleri küçültüp tekrar deneyin." }, { status: 507 });
    }
    const { data: imzali, error: baglantiHatasi } = await admin.storage
      .from("project-files")
      .createSignedUrl(yol, 300, { download: dosyaAdi });
    if (baglantiHatasi || !imzali?.signedUrl) {
      console.error("Word çıktısı bağlantısı üretilemedi:", baglantiHatasi?.message);
      return NextResponse.json({ error: "Word dosyası hazırlandı ama indirme bağlantısı üretilemedi. Tekrar deneyin." }, { status: 500 });
    }
    return NextResponse.json({ downloadUrl: imzali.signedUrl, fileName: dosyaAdi }, { headers: { "Cache-Control": "no-store" } });
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": WORD_TURU,
      "Content-Disposition": contentDisposition(project.title ?? "arvolab-calisma"),
      "Cache-Control": "no-store",
    },
  });
}
