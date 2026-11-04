"use server";

import { seciliKurum } from "@/lib/kurum-secimi-sunucu";
import { yeniCalismaAdresi } from "@/lib/calisma-karti";
import { CALISMA_OKUNAMADI } from "@/lib/calisma-ozeti";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { listeBasarili, listeOkunamadi, type ListeSonucu } from "@/lib/liste-sonucu";
import { calismaOzeti } from "@/app/actions/calisma-merkezi";
import { onayUyarisi } from "@/lib/onay-uyarisi";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext, requireRole, oturumYokMesaji, type ActionResult } from "@/lib/auth-guards";
import { calismaKilavuzu, kilavuzGorunenAdi } from "@/lib/guideline-rules";
import { getUniversities, type University } from "@/app/actions/universities";
import { isSubscriptionBlocked, abonelikKapaliMesaji } from "@/lib/access";
import { STILLER } from "@/lib/atif/stiller";
import { cslCoz } from "@/lib/atif/csl-kimlik";
import { cslBul } from "@/lib/atif/csl-dizin";
import { aktifDil, ceviri } from "@/lib/dil-sunucu";
import type { Metin } from "@/lib/dil";
import {
  OVERSIGHT_ONLY_STATUSES,
  OVERSIGHT_ROLES,
  PROJECT_STATUSES,
  isOversightRole,
} from "@/lib/project-labels";

const OVERSIGHT_ONLY: Metin = {
  tr: "Bu işlem için Kontrolör veya üzeri bir role sahip olmalısınız.",
  en: "You need the Controller role or higher for this action.",
};
const PRIORITIES = ["low", "normal", "high", "urgent"];
const RESEARCH_METHODS = ["quantitative", "qualitative", "mixed", "review"];
// Stil listesi tek yerde: lib/atif/stiller.ts. Kopyalanınca yeni stil
// eklendiğinde burası unutuluyor ve seçim sessizce APA'ya düşüyordu.
const CITATION_STYLES: string[] = Object.keys(STILLER);
/* CSL stili (03.11.2026): desen yetmez, dizinde gerçekten bulunmalı (elle yazılmış kimlik atıf üretemez). */
const stilGecerli = (stil: string) => {
  if (CITATION_STYLES.includes(stil)) return true;
  const csl = cslCoz(stil);
  return csl !== null && cslBul(csl.ad, csl.kod) !== null;
};

/*
  Veritabanının kabul ettiği stil listesi bir migration'la genişliyor
  (ör. MLA: 20260924100020). Uygulama önce yayına çıkar, migration SQL
  Editor'den elle uygulanır; arada kalan pencerede yeni stili seçen
  kullanıcı "Kaydedilirken bir hata oluştu" görüyordu ve neyin yanlış
  olduğunu anlamasının yolu yoktu. CHECK ihlali (23514) bu yüzden ayrı
  yazılıyor.
*/
const stilKisiti = (error: { code?: string; message?: string } | null): Metin | null =>
  error?.code === "23514" && /citation_style/.test(error.message ?? "")
    ? {
        tr: "Bu kaynakça sistemi veritabanında henüz tanımlı değil; sistem yöneticinize bildirin. Şimdilik başka bir sistem seçebilirsiniz.",
        en: "This citation system is not defined in the database yet; please notify your system administrator. For now you can choose another system.",
      }
    : null;

export interface AcademicProject {
  id: string;
  owner_id: string;
  organization_id: string | null;
  assignee_id: string | null;
  guideline_id: string | null;
  title: string;
  project_type: string;
  university: string | null;
  institute: string | null;
  department: string | null;
  citation_style: string;
  research_method: string | null;
  assignee_name: string | null;
  due_date: string | null;
  priority: string;
  status: string;
  notes: string | null;
  progress: number;
  controller_approved_by: string | null;
  controller_approved_at: string | null;
  created_at: string;
}

const PROJECT_TYPES = ["thesis", "article", "project", "associate-professorship"];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Kurum alanları: ad (kapak sayfası ve listeler için) + kimlik (kılavuz eşleştirmesi için).
// Kılavuzu (guideline_id) veritabanı tetikleyicisi bu kimliklerden belirler.
function readInstitution(formData: FormData) {
  const text = (name: string) => String(formData.get(name) ?? "").trim().slice(0, 240) || null;
  const id = (name: string) => {
    const value = String(formData.get(name) ?? "").trim();
    return UUID_PATTERN.test(value) ? value : null;
  };
  const university_id = id("universityId");
  const academic_unit_id = university_id ? id("academicUnitId") : null;
  const department_id = academic_unit_id ? id("departmentId") : null;
  return {
    university: text("university"),
    institute: text("institute"),
    department: text("department"),
    university_id,
    academic_unit_id,
    department_id,
  };
}

/*
  Kaydın kendisi; iki giriş noktası paylaşıyor. createProject (personelin
  tam formu, /dashboard/editor/new) kayıttan sonra yönlendiriyor;
  yeniCalisma (öğrencinin "Yeni çalışma" penceresi) kimliği geri veriyor,
  pencere açık kalıp kılavuz yükleme adımına geçiyor.
*/
async function calismaKaydet(
  formData: FormData,
): Promise<{ error: string } | { id: string; tur: string; kilavuzVar: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: (await oturumYokMesaji()) };
  /* Paneldeki kapı yalnızca ekranı kapatıyor; sunucu işlemi doğrudan
     çağrılabildiği için abonelik burada da denetlenmeli. */
  if (await isSubscriptionBlocked()) return { error: (await abonelikKapaliMesaji()) };
  const t = await ceviri();

  const title = String(formData.get("title") ?? "").trim();
  const type = String(formData.get("type") ?? "");

  if (title.length < 3 || title.length > 240) {
    return { error: t({ tr: "Çalışma başlığı 3 ile 240 karakter arasında olmalıdır.", en: "The title must be between 3 and 240 characters." }) };
  }
  if (!PROJECT_TYPES.includes(type)) {
    return { error: t({ tr: "Lütfen çalışma türünü seçin.", en: "Please choose the type of work." }) };
  }

  const dueDateRaw = String(formData.get("dueDate") ?? "").trim();

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();

  const citationStyle = String(formData.get("citationStyle") ?? "apa7");
  const method = String(formData.get("method") ?? "");
  const priority = String(formData.get("priority") ?? "normal");

  // Tezlerde kılavuz ve kaynakça sistemi, kurum kimliklerinden veritabanında belirlenir.
  const { data: created, error } = await supabase
    .from("academic_projects")
    .insert({
      owner_id: user.id,
      organization_id: profile?.organization_id ?? null,
      title,
      project_type: type,
      ...readInstitution(formData),
      citation_style: stilGecerli(citationStyle) ? citationStyle : "apa7",
      research_method: RESEARCH_METHODS.includes(method) ? method : null,
      due_date: /^\d{4}-\d{2}-\d{2}$/.test(dueDateRaw) ? dueDateRaw : null,
      priority: PRIORITIES.includes(priority) ? priority : "normal",
      notes: String(formData.get("notes") ?? "").trim() || null,
      status: "new",
    })
    .select("id, guideline_id")
    .single();

  if (error || !created) {
    console.error(error);
    return { error: t(stilKisiti(error) ?? { tr: "Kaydedilirken bir hata oluştu, lütfen tekrar deneyin.", en: "An error occurred while saving; please try again." }) };
  }

  revalidatePath("/dashboard/editor");
  revalidatePath("/dashboard");
  return { id: created.id, tur: type, kilavuzVar: Boolean(created.guideline_id) };
}

// Hatalar formun içinde gösterilir (yazılanlar kaybolmaz); başarıda editör açılır.
export async function createProject(formData: FormData): Promise<ActionResult> {
  const sonuc = await calismaKaydet(formData);
  if ("error" in sonuc) return sonuc;
  /* Kılavuzu eşleşen tez doğrudan editöre; eşleşmeyen tez kılavuz
     penceresine, makale dergi bilgilerine (lib/calisma-karti.ts). */
  redirect(yeniCalismaAdresi(sonuc));
}

/*
  Öğrencinin "Yeni çalışma" penceresi (editor/yeni-calisma-penceresi.tsx).
  Yönlendirmiyor: pencere açık kalıyor ve ikinci adımda öğrenci kendi tez
  yazım kılavuzunu bu çalışmaya yüklüyor (kılavuz yükleme çalışmanın
  kimliğini istiyor; depo yolu ve yetki ona bağlı).
*/
export async function yeniCalisma(formData: FormData): Promise<{ error?: string; id?: string }> {
  const sonuc = await calismaKaydet(formData);
  return "error" in sonuc ? { error: sonuc.error } : { id: sonuc.id };
}

/**
 * Kullanıcının görebildiği çalışmalar.
 *
 * Dönüş tipi bilerek dizi DEĞİL: okuma başarısızken de boş dizi dönmek,
 * arayüzde "hiç çalışmanız yok" yalanına dönüşüyordu (lib/liste-sonucu.ts).
 */
/*
  KOMUT MERKEZİ İÇİN ÇALIŞMALAR (Phase 3, 04.11.2026). Ctrl+K'da "çalışma
  aç": yalnızca kimlik, başlık ve tür; son düzenlenen önce. Yalnızca okuma;
  hangi satırların döneceğine RLS karar verir (kullanıcının gördüğü
  çalışmalar). Liste bir sayım değil, en çok 50 satırlık bir atlama
  listesi: daha eskisi Çalışmalarım'daki aramada.
*/
export async function komutCalismalari(): Promise<{ id: string; title: string; project_type: string }[]> {
  const ctx = await getAuthContext();
  if (!ctx) return [];
  const { data, error } = await ctx.supabase
    .from("academic_projects")
    .select("id, title, project_type")
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) {
    console.error("[komut merkezi] çalışmalar okunamadı:", error.message);
    return [];
  }
  return data ?? [];
}

export async function getProjects(): Promise<ListeSonucu<AcademicProject>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Oturum yoksa gerçekten kayıt yoktur; bu bir okuma arızası değil.
  if (!user) return listeBasarili([]);
  /* İç ekibin kurum seçimi (lib/kurum-secimi.ts): yalnızca görünümü süzer. */
  const kurum = await seciliKurum();

  let sorgu = supabase
    .from("academic_projects")
    .select(
      "id, owner_id, organization_id, assignee_id, guideline_id, title, project_type, university, institute, department, citation_style, research_method, assignee_name, due_date, priority, status, notes, progress, controller_approved_by, controller_approved_at, created_at"
    );
  /* organization_id'siz eski satırlar sahibinin kurumuyla eşlenir (RLS'teki kuralın aynısı). */
  if (kurum)
    sorgu = kurum.kullanicilar.length
      ? sorgu.or(`organization_id.eq.${kurum.id},owner_id.in.(${kurum.kullanicilar.join(",")})`)
      : sorgu.eq("organization_id", kurum.id);
  const { data, error } = await sorgu.order("created_at", { ascending: false });

  if (error) {
    console.error("[projeler] liste okunamadı:", error.message);
    return listeOkunamadi();
  }
  return listeBasarili(data);
}

export interface ProjectEditData {
  id: string;
  owner_id: string;
  assignee_id: string | null;
  guideline_id: string | null;
  title: string;
  project_type: string;
  university: string | null;
  institute: string | null;
  department: string | null;
  university_id: string | null;
  academic_unit_id: string | null;
  department_id: string | null;
  citation_style: string;
  research_method: string | null;
  due_date: string | null;
  priority: string;
  status: string;
  notes: string | null;
  progress: number;
}

/*
  Eskiden okuma hatasında da null dönüyordu ve düzenleme sayfası notFound()
  çiziyordu: geçici bir arızada kullanıcıya tezinin olmadığı söyleniyordu.
  Aynı ayrım çalışma merkezinde zaten var (lib/calisma-ozeti.ts); sabit
  oradan geliyor ki panelde tek bir "okunamadı" kavramı olsun.
*/
export async function getProjectForEdit(
  projectId: string
): Promise<ProjectEditData | null | typeof CALISMA_OKUNAMADI> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("academic_projects")
    .select(
      "id, owner_id, assignee_id, guideline_id, title, project_type, university, institute, department, university_id, academic_unit_id, department_id, citation_style, research_method, due_date, priority, status, notes, progress"
    )
    .eq("id", projectId)
    .maybeSingle();

  if (error) {
    console.error(error);
    return CALISMA_OKUNAMADI;
  }
  return data;
}

/*
  "Bilgileri düzenle" PENCERESİNİN VERİSİ (03.11.2026). Çalışmalarım'daki
  her kart için formu önceden çizmek, sayfa açılırken çalışma başına bir
  çalışma okuması ve bütün üniversite listesi demekti; pencere açılınca
  istenir. Yetki kararı düzenleme sayfasıyla aynı (sahip, atanan personel,
  denetim rolleri) — RLS asıl katman, bu yalnızca anlaşılır mesaj için.
*/
export async function calismaDuzenlemeVerisi(
  projectId: string,
): Promise<
  | { veri: { project: ProjectEditData; universities: University[]; guidelineLabel: string | null; canOversee: boolean } }
  | { error: string }
> {
  const ctx = await getAuthContext();
  if (!ctx) return { error: await oturumYokMesaji() };
  const t = await ceviri();
  const [project, { satirlar: universities, okunamadi }] = await Promise.all([getProjectForEdit(projectId), getUniversities()]);
  if (project === CALISMA_OKUNAMADI || okunamadi) {
    return { error: t({ tr: "Çalışma yüklenemedi; tekrar deneyin.", en: "The work could not be loaded; try again." }) };
  }
  if (!project) return { error: t({ tr: "Çalışma bulunamadı.", en: "Work not found." }) };
  const canOversee = isOversightRole(ctx.role);
  if (!canOversee && project.owner_id !== ctx.user.id && project.assignee_id !== ctx.user.id) {
    return { error: t({ tr: "Bu çalışmayı düzenleyemezsiniz.", en: "You can't edit this work." }) };
  }
  const guideline = await calismaKilavuzu(ctx.supabase, project.id, project.guideline_id);
  const guidelineLabel = guideline
    ? `${kilavuzGorunenAdi(guideline.label, await aktifDil())} · ${guideline.citationStyle.toUpperCase()}`
    : null;
  return { veri: { project, universities, guidelineLabel, canOversee } };
}

// Çalışmanın sahibi, atanan personel ve Kontrolör+ roller düzenleyebilir.
// "Teslime hazır / Teslim edildi" durumlarına geçiş (ve bu durumlardan çıkış)
// Kontrolör onayı gerektirir; veritabanı tetikleyicisi de bunu zorunlu kılar.
/*
  ATIF STİLİNİ KILAVUZA UYDUR.

  UYUŞMAZLIK NEREDEN ÇIKIYOR. Çalışma kurulurken (ve kurum alanları
  değişince) veritabanı tetikleyicisi hem kılavuzu bağlıyor hem atıf
  stilini kılavuzun onaylı sürümünden yazıyor
  (20260924100034_kilavuz_eslestirme_kurumu_gozetir.sql). Yani yeni
  çalışmada uyuşmazlık OLMUYOR.

  Sonradan oluşuyor: kılavuzun yeni bir sürümü farklı bir atıf stiliyle
  onaylandığında, o kılavuza bağlı çalışmaların satırı DEĞİŞMEDİĞİ için
  tetikleyici yeniden koşmuyor ve çalışma eski stilde kalıyor.

  Önceki davranış bir TUZAKTI: Çalışma Merkezi uyarıyor ve "çalışma
  ayarlarından düzeltin" diyordu, ama ayarlardaki alan kılavuz bağlıyken
  DEVRE DIŞI ve sunucu da gönderilen değeri yok sayıyor (aşağıda,
  bilerek: kılavuzun kuralı elle seçimle bozulmasın). Uygulama,
  düzeltmesini istediği şeyi düzeltmeyi engelliyordu; kaynakça denetimi
  de bu arada eski stile göre çalışıyordu.

  Bu işlem tek bir şey yapıyor: stili KILAVUZUN istediğine çeviriyor.
  Serbest seçim değil — "ayarlardan elle seç" kapısı bilerek kapalı
  kalıyor, çünkü uyuşmazlığın doğru çözümü kılavuza uymaktır.
  Kılavuzun bu çalışma için geçerli olmadığını düşünen kullanıcının
  yolu ayrı: kurumu düzeltmek.
*/
export async function atifStiliniKilavuzaUydur(projectId: string): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { error: await oturumYokMesaji() };
  const t = await ceviri();

  const current = await getProjectForEdit(projectId);
  if (current === CALISMA_OKUNAMADI) {
    return { error: t({ tr: "Çalışma okunamadı; değişiklik kaydedilmedi. Tekrar deneyin.", en: "The work could not be read; the change was not saved. Try again." }) };
  }
  if (!current) return { error: t({ tr: "Çalışma bulunamadı.", en: "Work not found." }) };

  const canOversee = isOversightRole(ctx.role);
  if (!canOversee && current.owner_id !== ctx.user.id && current.assignee_id !== ctx.user.id) {
    return { error: t({ tr: "Bu çalışmayı düzenleme yetkiniz yok.", en: "You don't have permission to edit this work." }) };
  }
  /* Uygulanan kılavuz: katalogdaki ya da öğrencinin yüklediği (uyarıyla aynı kaynak). */
  const kilavuz = await calismaKilavuzu(ctx.supabase, projectId, current.guideline_id);
  if (!kilavuz) return { error: t({ tr: "Bu çalışmaya uygulanan bir kılavuz yok.", en: "No guideline is applied to this work." }) };
  const stil = kilavuz.citationStyle;
  if (!stil) return { error: t({ tr: "Kılavuzun atıf stili okunamadı; sayfayı yenileyip tekrar deneyin.", en: "The guideline's citation style could not be read; refresh the page and try again." }) };
  if (!stilGecerli(stil)) return { error: t({ tr: "Kılavuzun atıf stili tanınmıyor.", en: "The guideline's citation style is not recognized." }) };
  if (stil === current.citation_style) return { success: true };

  const { error } = await ctx.supabase
    .from("academic_projects")
    .update({ citation_style: stil })
    .eq("id", projectId);
  if (error) {
    console.error("[calisma] atıf stili kılavuza uydurulamadı:", error.message);
    return { error: t({ tr: "Atıf stili güncellenemedi. Tekrar deneyin.", en: "The citation style could not be updated. Try again." }) };
  }

  revalidatePath("/dashboard/editor");
  return { success: true };
}

export async function updateProject(projectId: string, formData: FormData): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { error: await oturumYokMesaji() };
  const t = await ceviri();

  const current = await getProjectForEdit(projectId);
  // Okunamayan kaydın üzerine yazmak, yetki denetimini de atlatırdı.
  if (current === CALISMA_OKUNAMADI) {
    return { error: t({ tr: "Çalışma okunamadı; değişiklik kaydedilmedi. Tekrar deneyin.", en: "The work could not be read; the change was not saved. Try again." }) };
  }
  if (!current) return { error: t({ tr: "Çalışma bulunamadı.", en: "Work not found." }) };

  const canOversee = isOversightRole(ctx.role);
  if (!canOversee && current.owner_id !== ctx.user.id && current.assignee_id !== ctx.user.id) {
    return { error: t({ tr: "Bu çalışmayı düzenleme yetkiniz yok.", en: "You don't have permission to edit this work." }) };
  }

  const title = String(formData.get("title") ?? "").trim();
  if (title.length < 3 || title.length > 240) {
    return { error: t({ tr: "Başlık 3 ile 240 karakter arasında olmalı.", en: "The title must be between 3 and 240 characters." }) };
  }

  const priority = String(formData.get("priority") ?? current.priority);
  if (!PRIORITIES.includes(priority)) return { error: t({ tr: "Geçersiz öncelik.", en: "Invalid priority." }) };

  const method = String(formData.get("method") ?? "");
  if (method && !RESEARCH_METHODS.includes(method)) return { error: t({ tr: "Geçersiz araştırma yöntemi.", en: "Invalid research method." }) };

  const dueDate = String(formData.get("dueDate") ?? "").trim();
  if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return { error: t({ tr: "Geçersiz teslim tarihi.", en: "Invalid due date." }) };

  const progress = Number(formData.get("progress"));
  if (!Number.isInteger(progress) || progress < 0 || progress > 100) {
    return { error: t({ tr: "İlerleme 0 ile 100 arasında bir tam sayı olmalı.", en: "Progress must be a whole number between 0 and 100." }) };
  }

  // Devre dışı (disabled) alanlar forma eklenmez; o durumda mevcut değer korunur.
  const statusField = formData.get("status");
  const status = statusField === null ? current.status : String(statusField);
  if (!PROJECT_STATUSES.includes(status)) return { error: t({ tr: "Geçersiz durum.", en: "Invalid status." }) };
  if (
    !canOversee &&
    status !== current.status &&
    (OVERSIGHT_ONLY_STATUSES.includes(status) || OVERSIGHT_ONLY_STATUSES.includes(current.status))
  ) {
    return { error: t({ tr: "Bu durum değişikliğini yalnızca Kontrolör ve üzeri roller yapabilir.", en: "Only Controller and higher roles can make this status change." }) };
  }

  const citationField = formData.get("citationStyle");
  const citationStyle =
    current.guideline_id || citationField === null ? current.citation_style : String(citationField);
  if (!stilGecerli(citationStyle)) return { error: t({ tr: "Geçersiz kaynakça sistemi.", en: "Invalid citation system." }) };

  const { data, error } = await ctx.supabase
    .from("academic_projects")
    .update({
      title,
      priority,
      research_method: method || null,
      due_date: dueDate || null,
      progress,
      status,
      citation_style: citationStyle,
      notes: String(formData.get("notes") ?? "").trim() || null,
      // Kurum değişirse kılavuz veritabanında yeniden eşleştirilir.
      ...(formData.has("universityId") ? readInstitution(formData) : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId)
    .select("id");

  if (error) {
    console.error(error);
    return {
      error:
        error.code === "42501"
          ? t({ tr: "Bu değişiklik için yetkiniz yok.", en: "You don't have permission for this change." })
          : t(stilKisiti(error) ?? { tr: "Kaydedilirken bir hata oluştu.", en: "An error occurred while saving." }),
    };
  }
  if (!data?.length) return { error: t({ tr: "Bu çalışmayı düzenleme yetkiniz yok.", en: "You don't have permission to edit this work." }) };

  revalidatePath("/dashboard/editor");
  revalidatePath("/dashboard");
  // Düzenleme sayfası da yeni değerlerle çizilsin; form kayıttan sonra bu değerlerle yeniden kurulur (action-form.tsx).
  revalidatePath(`/dashboard/editor/${projectId}/edit`);
  return { success: true };
}


// Yalnızca Kontrolör / Yönetici / Sistem Yöneticisi / Kurucu rolleri
// bir çalışmayı onaylayabilir (proje dosyası 6.2 "Biçim" aşaması onayı).
// Veritabanında guard_academic_project_update tetikleyicisi de bunu zorunlu
// kılar; buradaki kontrol kullanıcıya erken/anlaşılır bir hata mesajı vermek içindir.
export async function approveProject(projectId: string): Promise<ActionResult> {
  const auth = await requireRole(OVERSIGHT_ROLES, OVERSIGHT_ONLY);
  if ("error" in auth) return { error: auth.error };
  const t = await ceviri();

  const { data, error } = await auth.supabase
    .from("academic_projects")
    .update({
      controller_approved_by: auth.user.id,
      controller_approved_at: new Date().toISOString(),
      status: "ready",
    })
    .eq("id", projectId)
    .select("id");

  if (error) {
    console.error(error);
    return { error: t({ tr: "Onaylanırken bir hata oluştu.", en: "An error occurred while approving." }) };
  }
  if (!data?.length) return { error: t({ tr: "Çalışma bulunamadı.", en: "Work not found." }) };

  revalidatePath("/dashboard/editor");
  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/editor/${projectId}`);

  /*
    Onay verildi; şimdi kontrolöre ekosistemin bulduklarını söylüyoruz.
    Denetimler zaten yapılmış durumda ama çalışma merkezinde duruyor ve onay
    listeden veriliyor — merkeze girmediyse hiçbirini görmemiş oluyor.
    Uyarı ENGELLEMEZ: kuralın dışına çıkmayı bilerek seçmiş olabilir.
    Okunamazsa sessiz geçilir, onay zaten verildi.
  */
  try {
    const ozet = await calismaOzeti(projectId);
    // Okunamadıysa uyarı hesaplanmaz; onay zaten verildi, sessiz geçiliyor.
    const uyari = ozet && ozet !== CALISMA_OKUNAMADI
      ? onayUyarisi({ tutarsizliklar: ozet.tutarsizliklar, hazirlik: ozet.hazirlik, dil: await aktifDil() })
      : null;
    if (uyari) return { success: true, warning: uyari };
  } catch (hata) {
    console.error("[onay] uyarı hesaplanamadı:", hata instanceof Error ? hata.message : hata);
  }

  return { success: true };
}

export async function revokeApproval(projectId: string): Promise<ActionResult> {
  const auth = await requireRole(OVERSIGHT_ROLES, OVERSIGHT_ONLY);
  if ("error" in auth) return { error: auth.error };
  const t = await ceviri();

  const { data, error } = await auth.supabase
    .from("academic_projects")
    .update({
      controller_approved_by: null,
      controller_approved_at: null,
      status: "revision",
    })
    .eq("id", projectId)
    .select("id");

  if (error) {
    console.error(error);
    return { error: t({ tr: "İşlem sırasında bir hata oluştu.", en: "An error occurred during the operation." }) };
  }
  if (!data?.length) return { error: t({ tr: "Çalışma bulunamadı.", en: "Work not found." }) };

  revalidatePath("/dashboard/editor");
  revalidatePath("/dashboard");
  return { success: true };
}

/*
  SORUMLU ATAMASI (assignProject, getAssignableStaff) 03.11.2026'da
  kaldırıldı: kurumun bütün personeli Kontrolör ve üstü, çalışmalara zaten
  yazabiliyor. "use server" dosyasında kullanılmayan her export dışarıdan
  çağrılabilir bir uç nokta olarak kalırdı. Sütun (assignee_id) ve RLS
  kuralı yerinde; eski atamalar yetki vermeye devam ediyor.
*/

// Silme yetkisi RLS'te zaten tanımlı: çalışmanın sahibi ya da
// Yönetici/Sistem Yöneticisi/Kurucu rolleri silebilir
// (bkz. "Owner or oversight-role can delete projects" politikası).
// İlişkili kayıtlar (kaynakça kontrolleri, belge yüklemeleri, panelde
// yazma metni vb.) veritabanında ON DELETE CASCADE ile otomatik silinir.
export async function deleteProject(projectId: string): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { error: await oturumYokMesaji() };
  const t = await ceviri();

  const { data, error } = await ctx.supabase.from("academic_projects").delete().eq("id", projectId).select("id");

  if (error) {
    console.error(error);
    return { error: t({ tr: "Silme sırasında bir hata oluştu.", en: "An error occurred while deleting." }) };
  }
  if (!data?.length) return { error: t({ tr: "Bu çalışmayı silme yetkiniz yok.", en: "You don't have permission to delete this work." }) };

  revalidatePath("/dashboard/editor");
  revalidatePath("/dashboard");
  return { success: true };
}
