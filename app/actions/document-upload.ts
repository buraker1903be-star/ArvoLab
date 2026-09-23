"use server";

import { listeBasarili, listeOkunamadi, type ListeSonucu } from "@/lib/liste-sonucu";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { detectDocType, extractTextFromBuffer, splitBodyAndReferences } from "@/lib/document-extract";
import { checkGuidelineCompliance, type GuidelineComplianceResult } from "@/lib/guideline-check";
import {
  parseReferenceList,
  extractInTextCitations,
  crossCheck,
  computeComplianceScore,
} from "@/lib/apa7";
import { isSubscriptionBlocked, SUBSCRIPTION_BLOCKED_MESSAGE } from "@/lib/access";

/*
  20 MB. Buradaki kontrol istemcinin BİLDİRDİĞİ boyuta bakar ve dosya o
  noktada zaten yüklenmiştir; yani erken ve nazik bir uyarıdır, güvenlik
  sınırı değil. Gerçek sınır kovanın kendisinde:
  supabase/migrations/20260924100000_project_files_bucket_limits.sql
  (eskiden bu satırda "Supabase Storage tarafındaki gerçek sınır" yazıyordu,
  oysa kovada hiçbir sınır tanımlı değildi).
*/
const MAX_FILE_SIZE = 20 * 1024 * 1024;

export interface UploadResult {
  error?: string;
  documentId?: string;
  analysis?: {
    complianceScore: number | null;
    referenceSectionFound: boolean;
    references: unknown[];
    crossCheck: {
      citationsWithoutReference: unknown[];
      referencesWithoutCitation: unknown[];
    };
    guidelineCompliance?: GuidelineComplianceResult | null;
  };
}

/**
 * ÖNEMLİ MİMARİ NOT:
 * Dosyanın kendisi bu server action'a GÖNDERİLMEZ. Vercel'in
 * sunucu fonksiyonlarında platform seviyesinde, next.config.ts
 * ile aşılamayan sabit bir istek boyutu sınırı (~4.5 MB) vardır;
 * gerçek bir tez/makale dosyası bunu kolayca aşar ve
 * "413 FUNCTION_PAYLOAD_TOO_LARGE" hatasına yol açar.
 *
 * Bunun yerine: dosya, TARAYICIDAN DOĞRUDAN Supabase Storage'a
 * yüklenir (bkz. document-upload-form.tsx — browser Supabase
 * istemcisi kullanır). Bu server action'a yalnızca depolama
 * yolu (storagePath) gibi küçük metin verileri gelir; dosyanın
 * kendisini bu fonksiyon Supabase'ten SUNUCU TARAFINDA indirir
 * (bu, gelen istek boyutu sınırına tabi değildir).
 */
export async function analyzeUploadedDocument(params: {
  storagePath: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  projectId: string | null;
  projectTitle: string | null;
}): Promise<UploadResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Oturum bulunamadı. Lütfen tekrar giriş yapın." };
  }
  /* Abonelik kapısı: Belge çözümleme hem depolama hem işlem maliyeti üretir.
     Silme ve listeleme açık kalır: kullanıcı kendi verisine erişebilmeli. */
  const abonelikKapali = await isSubscriptionBlocked();
  const boyutAsimi = params.fileSize > MAX_FILE_SIZE;
  const docType = detectDocType(params.fileName, params.mimeType);

  /*
    Yol kullanıcıdan geliyor: yalnızca kendi klasöründeki dosya okunabilir.
    Depolama politikası controller ve üstü rollere bütün kovayı açtığı için,
    bu denetim olmadan o roldeki biri başkasının dosyasının yolunu vererek
    metnini kendi kaydına kopyalayabilirdi (bkz. manuscript-import.ts).
  */
  const ownFile = params.storagePath.startsWith(`${user.id}/`) && !params.storagePath.includes("..");
  if (!ownFile) {
    return { error: "Geçersiz dosya yolu." };
  }

  /*
    Dosya bu noktadan önce tarayıcıdan depoya yüklenmiş oluyor. Aşağıdaki
    denetimlerden biri reddederse dosya depoda sahipsiz kalıyordu (aboneliği
    biten kullanıcı hata mesajı alıyor ama dosya yer kaplamaya devam ediyordu).
    Reddedilen her yolda dosya siliniyor; silme başarısız olursa akış durmaz.
  */
  const dosyayiSil = async () => {
    const { error } = await supabase.storage.from("project-files").remove([params.storagePath]);
    if (error) console.error("Reddedilen yükleme silinemedi:", params.storagePath, error.message);
  };
  const reddet = async (mesaj: string): Promise<UploadResult> => {
    await dosyayiSil();
    return { error: mesaj };
  };

  if (abonelikKapali) return reddet(SUBSCRIPTION_BLOCKED_MESSAGE);
  if (boyutAsimi) return reddet("Dosya boyutu 20 MB sınırını aşıyor.");
  if (!docType) return reddet("Yalnızca .docx ve .pdf dosyaları desteklenir.");

  /*
    project_id de kullanıcıdan geliyor ve doğrulanmıyordu. document_uploads
    INSERT politikası yalnızca "uploaded_by = auth.uid()" istiyor, yani satır
    BAŞKASININ projesine bağlanabiliyordu: kurban, kendi çalışmasının altında
    yabancı bir dosyayı, çıkarılmış metnini ve analizini görüyordu. (Depolama
    yolu denetimi yukarıda ayrı bir açığı kapatıyor; bu onun eşi.)

    Okuma RLS'e tabi, yani göremediği bir çalışmanın kimliğini veren kullanıcı
    burada durur.
  */
  if (params.projectId) {
    const { data: ownProject, error: projectError } = await supabase
      .from("academic_projects")
      .select("id")
      .eq("id", params.projectId)
      .maybeSingle();
    if (projectError) {
      console.error(projectError);
      return reddet("Çalışma doğrulanamadı.");
    }
    if (!ownProject) return reddet("Bu çalışmaya belge ekleyemezsiniz.");
  }

  // Dosyayı Supabase Storage'dan SUNUCU TARAFINDA indir
  const { data: fileBlob, error: downloadError } = await supabase.storage
    .from("project-files")
    .download(params.storagePath);

  if (downloadError || !fileBlob) {
    console.error(downloadError);
    return reddet("Yüklenen dosya depodan okunamadı.");
  }

  const arrayBuffer = await fileBlob.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  let extractedText = "";
  let status: "analyzed" | "failed" = "analyzed";
  let errorMessage: string | null = null;
  let analysis: Record<string, unknown> | null = null;
  let referenceText = "";

  try {
    extractedText = await extractTextFromBuffer(buffer, docType);
    const split = splitBodyAndReferences(extractedText);
    referenceText = split.referenceText;

    let guidelineCompliance: GuidelineComplianceResult | null = null;
    if (params.projectId) {
      const { data: project } = await supabase
        .from("academic_projects")
        .select("guideline_id, citation_style")
        .eq("id", params.projectId)
        .single();

      if (project?.guideline_id) {
        const { data: guideline } = await supabase
          .from("thesis_guidelines")
          .select("required_sections, citation_style")
          .eq("id", project.guideline_id)
          .single();

        if (guideline) {
          guidelineCompliance = checkGuidelineCompliance(
            split.bodyText,
            guideline.required_sections ?? [],
            guideline.citation_style,
            project.citation_style ?? null
          );
        }
      }
    }

    if (referenceText.trim().length > 0) {
      const references = parseReferenceList(referenceText);
      const citations = extractInTextCitations(split.bodyText);
      const cross = crossCheck(citations, references);
      const score = computeComplianceScore(references, cross);
      analysis = {
        references,
        citations,
        crossCheck: cross,
        complianceScore: score,
        referenceSectionFound: true,
        guidelineCompliance,
      };
    } else {
      analysis = {
        references: [],
        citations: [],
        crossCheck: { citationsWithoutReference: [], referencesWithoutCitation: [] },
        complianceScore: null,
        referenceSectionFound: false,
        guidelineCompliance,
      };
    }
  } catch (err) {
    console.error(err);
    status = "failed";
    errorMessage = "Dosyadan metin çıkarılırken bir hata oluştu.";
  }

  const { data: inserted, error: insertError } = await supabase
    .from("document_uploads")
    .insert({
      project_id: params.projectId,
      project_title: params.projectTitle,
      uploaded_by: user.id,
      file_name: params.fileName,
      storage_path: params.storagePath,
      mime_type: params.mimeType || null,
      file_size: params.fileSize,
      extracted_text: extractedText || null,
      reference_text: referenceText || null,
      analysis,
      status,
      error_message: errorMessage,
    })
    .select("id")
    .single();

  if (insertError) {
    console.error(insertError);
    return { error: "Analiz sonucu kaydedilirken hata oluştu." };
  }

  revalidatePath("/dashboard/documents");
  return {
    documentId: inserted?.id,
    analysis: analysis as UploadResult["analysis"],
  };
}

export interface DocumentUploadRecord {
  id: string;
  project_title: string | null;
  file_name: string;
  status: "processing" | "analyzed" | "failed";
  error_message: string | null;
  analysis: {
    complianceScore: number | null;
    referenceSectionFound: boolean;
    references: { raw: string; issues: { field: string; message: string; severity: string }[] }[];
    crossCheck: {
      citationsWithoutReference: { raw: string }[];
      referencesWithoutCitation: { raw: string }[];
    };
    guidelineCompliance?: GuidelineComplianceResult | null;
  } | null;
  created_at: string;
}

// Kaydı ve depodaki dosyayı siler. Orijinallik taramaları ve AI geri
// bildirimleri veritabanında ON DELETE CASCADE ile birlikte silinir.
/**
 * Başarısız bir çözümlemeyi yeniden dener.
 *
 * Eskiden başarısız satırın TEK eylemi "Belgeyi sil"di: kullanıcı ilk
 * denediği şeyde hata alıyor ve ürün ona çıkış yolu sunmuyordu. Dosya
 * depoda duruyor, çözümleme geçici bir sebepten düşmüş olabiliyor
 * (ağ, boyut, o anki yük) — yeniden yüklemeye zorlamak gereksiz.
 *
 * Yalnızca "failed" satırlarda: başarılı bir çözümlemeyi tekrarlamak
 * listede ikinci bir kayıt üretirdi.
 *
 * Sıra önemli: önce yeni çözümleme, SONRA eski satırın silinmesi. Tersi
 * olsaydı yeniden deneme de düştüğünde kullanıcı kaydını tamamen
 * kaybederdi.
 */
export async function reanalyzeDocument(documentId: string): Promise<UploadResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı. Lütfen tekrar giriş yapın." };

  const { data: belge, error: okumaHatasi } = await supabase
    .from("document_uploads")
    .select("id, storage_path, file_name, mime_type, file_size, project_id, project_title, status")
    .eq("id", documentId)
    .eq("uploaded_by", user.id)
    .maybeSingle();
  if (okumaHatasi) {
    console.error(okumaHatasi);
    return { error: "Belge okunamadı. Sayfayı yenileyip tekrar deneyin." };
  }
  if (!belge) return { error: "Belge bulunamadı ya da size ait değil." };
  if (belge.status !== "failed") {
    return { error: "Yalnızca çözümlenemeyen belgeler yeniden denenebilir." };
  }

  const sonuc = await analyzeUploadedDocument({
    storagePath: belge.storage_path,
    fileName: belge.file_name,
    mimeType: belge.mime_type ?? "",
    fileSize: Number(belge.file_size ?? 0),
    projectId: belge.project_id ?? null,
    projectTitle: belge.project_title ?? null,
  });
  if (sonuc.error) return sonuc;

  // Yeni kayıt oluştu; eski başarısız satır listede kalmasın.
  const { error: silmeHatasi } = await supabase
    .from("document_uploads")
    .delete()
    .eq("id", documentId)
    .eq("uploaded_by", user.id);
  if (silmeHatasi) console.error(silmeHatasi);

  revalidatePath("/dashboard/documents");
  return sonuc;
}

export async function deleteDocumentUpload(documentId: string): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı. Lütfen tekrar giriş yapın." };

  const { data: document } = await supabase
    .from("document_uploads")
    .select("id, storage_path")
    .eq("id", documentId)
    .eq("uploaded_by", user.id)
    .maybeSingle();
  if (!document) return { error: "Belge bulunamadı ya da size ait değil." };

  const { error } = await supabase
    .from("document_uploads")
    .delete()
    .eq("id", documentId)
    .eq("uploaded_by", user.id);
  if (error) {
    console.error(error);
    return { error: "Belge silinirken bir hata oluştu." };
  }

  // Kayıt silindi; dosya depodan silinemezse yalnızca yer kaplar, kullanıcıya hata göstermiyoruz.
  const { error: storageError } = await supabase.storage.from("project-files").remove([document.storage_path]);
  if (storageError) console.error(storageError);

  revalidatePath("/dashboard/documents");
  return { success: true };
}

/* Okunamadı ile "belge yüklemediniz" ayrı; lib/liste-sonucu.ts. */
export async function getMyDocumentUploads(): Promise<ListeSonucu<DocumentUploadRecord>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return listeBasarili([]);

  const { data, error } = await supabase
    .from("document_uploads")
    .select("id, project_title, file_name, status, error_message, analysis, created_at")
    .eq("uploaded_by", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error(error);
    return listeOkunamadi();
  }
  return listeBasarili((data ?? []) as DocumentUploadRecord[]);
}
