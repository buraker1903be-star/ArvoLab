"use server";

import { getAuthContext, oturumYokMesaji } from "@/lib/auth-guards";
import { convertDocxToEditorHtml, type DocxImportStats } from "@/lib/docx-import";
import { IMAGE_BUCKET, SIGNED_URL_TTL_SECONDS } from "@/lib/manuscript-images";
import { isSubscriptionBlocked, abonelikKapaliMesaji } from "@/lib/access";
import { isOversightRole } from "@/lib/project-labels";
import { ceviri } from "@/lib/dil-sunucu";

// İstemcideki sınırla (import-dialog.tsx) aynı; eskiden 20 ve 25 MB diye iki ayrı mesaj veriliyordu.
const MAX_DOCX_BYTES = 20 * 1024 * 1024;

/**
 * Word dosyasını editör içeriğine çevirir. Dosya, Vercel'in istek boyutu sınırına
 * takılmamak için tarayıcıdan doğrudan depoya (<kullanıcı>/imports/) yüklenir; burada
 * yalnızca yolu alınır, dönüştürülür ve geçici dosya silinir. Metni kaydetmek editörün
 * işidir (otomatik kayıt), bu eylem veritabanına metin yazmaz.
 */
export async function importWordDocument(
  projectId: string,
  storagePath: string
): Promise<{ error?: string; html?: string; stats?: DocxImportStats }> {
  const ctx = await getAuthContext();
  if (!ctx) return { error: await oturumYokMesaji() };
  const t = await ceviri();
  const bucket = ctx.supabase.storage.from(IMAGE_BUCKET);
  const ownImport = storagePath.startsWith(`${ctx.user.id}/imports/`) && /\.docx$/i.test(storagePath) && !storagePath.includes("..");
  if (!ownImport) return { error: t({ tr: "Geçersiz dosya.", en: "Invalid file." }) };

  try {
    /* Abonelik kapısı: Word içe aktarma yeni içerik üretir; saveManuscript ile aynı kapı.
       try İÇİNDE: eskiden kapı try'dan önceydi, reddedilen yüklemenin geçici
       dosyası finally'deki silmeye hiç ulaşmıyor, depoda kalıyordu. */
    if (await isSubscriptionBlocked()) return { error: (await abonelikKapaliMesaji()) };

    const { data: project } = await ctx.supabase
      .from("academic_projects")
      .select("owner_id, assignee_id")
      .eq("id", projectId)
      .maybeSingle();
    // Kural metni kaydetme kuralıyla aynı (can_write_project): sahip, atanan
    // uzman ve denetim rolleri. Ayrı yazıldığı için sapmıştı — Kurucu
    // başkasının tezine Word aktaramıyordu.
    const yazabilir =
      project && (project.owner_id === ctx.user.id || project.assignee_id === ctx.user.id || isOversightRole(ctx.role));
    if (!yazabilir) {
      return { error: t({ tr: "Bu çalışmaya metin aktarma yetkiniz yok.", en: "You do not have permission to import text into this work." }) };
    }

    const { data: file, error: downloadError } = await bucket.download(storagePath);
    if (downloadError || !file) {
      console.error(downloadError);
      return { error: t({ tr: "Yüklenen dosya okunamadı.", en: "The uploaded file could not be read." }) };
    }
    if (file.size > MAX_DOCX_BYTES) return { error: t({ tr: "Word dosyası 20 MB sınırını aşıyor.", en: "The Word file exceeds the 20 MB limit." }) };

    const stamp = Date.now();
    const { html, stats } = await convertDocxToEditorHtml(Buffer.from(await file.arrayBuffer()), async (image, index) => {
      const extension = image.contentType === "image/png" ? "png" : image.contentType === "image/gif" ? "gif" : "jpg";
      const path = `${projectId}/editor-images/${stamp}-word-${index + 1}.${extension}`;
      const { error: uploadError } = await bucket.upload(path, image.data, { contentType: image.contentType, upsert: false });
      if (uploadError) {
        console.error(uploadError);
        return null;
      }
      const { data: signed } = await bucket.createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
      return signed?.signedUrl ?? null;
    });

    if (!html.replace(/<[^>]+>/g, "").trim() && stats.images === 0) {
      return { error: t({ tr: "Word dosyasında aktarılacak metin bulunamadı.", en: "No text to import was found in the Word file." }) };
    }
    return { html, stats };
  } catch (error) {
    console.error(error);
    return {
      error: t({
        tr: "Word dosyası dönüştürülemedi. Dosyanın bozuk olmadığından ve .docx biçiminde olduğundan emin olun.",
        en: "The Word file could not be converted. Make sure the file is not corrupted and is in .docx format.",
      }),
    };
  } finally {
    // Geçici yükleme her durumda silinir.
    await bucket.remove([storagePath]).catch(() => undefined);
  }
}
