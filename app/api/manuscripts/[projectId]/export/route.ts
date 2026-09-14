import { NextRequest, NextResponse } from "next/server";
import { Packer } from "docx";
import { createClient } from "@/lib/supabase/server";
import { buildDocxFromTiptap, type DocxImage } from "@/lib/tiptap-docx";
import { loadAppliedGuideline } from "@/lib/guideline-rules";
import { readImageInfo } from "@/lib/image-info";
import type { TiptapDoc } from "@/lib/tiptap-text";

// Büyük/resimli belgelerde Word oluşturma zaman alabilir.
export const maxDuration = 60;

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const IMAGE_BUCKET = "project-files";

// Editördeki resimler kendi depomuzdaki imzalı bağlantılardır. Sunucu,
// verilen adrese körü körüne istek atmaz (SSRF): yalnızca kendi Supabase
// deposundaki dosya yolunu çıkarıp kullanıcının yetkisiyle indirir. Böylece
// imzalı bağlantının süresi dolsa bile resim Word'e aktarılır.
function storagePathFromUrl(src: string): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  try {
    const url = new URL(src);
    if (url.origin !== new URL(base).origin) return null;
    const match = url.pathname.match(/^\/storage\/v1\/object\/(?:sign|public|authenticated)\/project-files\/(.+)$/);
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

function toDocxImage(buffer: Buffer): DocxImage | null {
  if (buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES) return null;
  const info = readImageInfo(buffer);
  return info ? { data: buffer, ...info } : null;
}

// Word dosya adı: Türkçe karakterler korunur (RFC 5987), eski tarayıcılar için ASCII yedek.
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

  const { data: project } = await supabase
    .from("academic_projects")
    .select("title, guideline_id")
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
      }
    : {};

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
    fetchImage: async (src: string) => {
      try {
        const dataUrl = src.match(/^data:image\/(?:png|jpeg|gif);base64,(.+)$/);
        if (dataUrl) return toDocxImage(Buffer.from(dataUrl[1], "base64"));

        const path = storagePathFromUrl(src);
        if (!path) return null;
        const { data, error: downloadError } = await supabase.storage.from(IMAGE_BUCKET).download(path);
        if (downloadError || !data) return null;
        return toDocxImage(Buffer.from(await data.arrayBuffer()));
      } catch {
        return null;
      }
    },
  });

  const buffer = await Packer.toBuffer(doc);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": contentDisposition(project.title ?? "arvolab-calisma"),
      "Cache-Control": "no-store",
    },
  });
}
