import { NextRequest, NextResponse } from "next/server";
import { Packer } from "docx";
import { createClient } from "@/lib/supabase/server";
import { buildDocxFromTiptap } from "@/lib/tiptap-docx";
import type { TiptapDoc } from "@/lib/tiptap-text";

// Büyük/resimli belgelerde Word oluşturma zaman alabilir.
export const maxDuration = 60;

export async function GET(
  req: NextRequest,
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
    .select("title")
    .eq("id", projectId)
    .single();

  const { data: manuscript, error } = await supabase
    .from("project_manuscripts")
    .select("content, margin_top_cm, margin_bottom_cm, margin_left_cm, margin_right_cm, show_page_numbers")
    .eq("project_id", projectId)
    .maybeSingle();

  if (error || !manuscript) {
    return NextResponse.json({ error: "Bu çalışma için henüz kaydedilmiş bir metin yok." }, { status: 404 });
  }

  const doc = await buildDocxFromTiptap({
    title: project?.title ?? "ArvoLab Çalışması",
    doc: manuscript.content as TiptapDoc,
    margins: {
      top: manuscript.margin_top_cm ?? 2.5,
      bottom: manuscript.margin_bottom_cm ?? 2.5,
      left: manuscript.margin_left_cm ?? 2.5,
      right: manuscript.margin_right_cm ?? 2.5,
    },
    showPageNumbers: manuscript.show_page_numbers ?? true,
    fetchImage: async (url: string) => {
      try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const arrayBuffer = await res.arrayBuffer();
        // Görsel piksel boyutlarını basitçe tespit edemediğimiz için
        // makul bir varsayılan oran kullanılır; buildDocxFromTiptap
        // içindeki ölçekleme mantığı genişliği sınırlar.
        return { data: Buffer.from(arrayBuffer), width: 800, height: 600 };
      } catch {
        return null;
      }
    },
  });

  const buffer = await Packer.toBuffer(doc);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${(project?.title ?? "arvolab-calisma").replace(/[^a-zA-Z0-9-_]/g, "_")}.docx"`,
    },
  });
}
