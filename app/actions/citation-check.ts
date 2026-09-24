"use server";

import { listeBasarili, listeOkunamadi, type ListeSonucu } from "@/lib/liste-sonucu";
import { createClient } from "@/lib/supabase/server";
import {
  extractInTextCitations,
  crossCheck,
  computeComplianceScore,
} from "@/lib/apa7";
import { kunyeleriAyristir, kunyeleriBol } from "@/lib/atif/kunye";
import { adlaEslesir, atifCikarmaStili, stilTanimi, yilaBakilir } from "@/lib/atif/stiller";
import { verifyAcademicReferences } from "@/lib/academic-reference-verification";
import { dogrulamaOnbellegi } from "@/lib/dogrulama-onbellegi";
import { isSubscriptionBlocked, SUBSCRIPTION_BLOCKED_MESSAGE } from "@/lib/access";

export interface MyProject {
  id: string;
  title: string;
  university: string | null;
  citation_style: string | null;
}

/*
  Eskiden okuma başarısızken de BOŞ LİSTE dönüyordu. Bu liste panelin dört
  ekranındaki "Bağlı çalışma" seçicisini besliyor; geçici bir arızada
  kullanıcı kendi tezini seçenekler arasında bulamıyor ve çalışmasının
  silindiğini sanıyordu.
*/
export async function getMyProjects(): Promise<ListeSonucu<MyProject>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return listeBasarili([]);

  const { data, error } = await supabase
    .from("academic_projects")
    .select("id, title, university, citation_style")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return listeOkunamadi();
  }
  return listeBasarili(data);
}

/*
  Seçilen çalışmanın müsveddesinde kaç kelime var.

  Metin alanı İSTEĞE BAĞLI olduğu için çoğu denetim metinsiz çalışıyordu ve
  çapraz kontrol (metin içi atıf ↔ kaynakça) sessizce devre dışı kalıyordu —
  denetimin elle yapılması en zor, en değerli yarısı. Oysa metin zaten
  ArvoLab'da duruyor. Sayı, kullanıcı "çalışmamın metnini kullan" demeden
  önce boş bir müsveddeyi görebilsin diye.
*/
export async function calismaMetniOzeti(
  projectId: string
): Promise<{ kelime: number; okunamadi: boolean }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { kelime: 0, okunamadi: false };

  // RLS erişimi belirler; burada ayrıca sahiplik aranmıyor çünkü danışman da görebilir.
  const { data, error } = await supabase
    .from("project_manuscripts")
    .select("word_count")
    .eq("project_id", projectId)
    .maybeSingle();

  if (error) {
    console.error(error);
    return { kelime: 0, okunamadi: true };
  }
  return { kelime: data?.word_count ?? 0, okunamadi: false };
}

/* Akademik doğrulama ağ üzerinden gidiyor (Crossref + OpenAlex, kaynak
   başına iki istek). Biçim ve çapraz kontrol ise yerelde ve anında.
   İkisini aynı sınıra bağlamak, 120 kaynaklı bir tezde HİÇBİR denetim
   yapılamaması demekti — eskiden 25'i aşan liste doğrudan hata
   veriyordu. Artık hepsi denetleniyor, ağ doğrulaması ilk N kaynakla
   sınırlı ve bu kullanıcıya yazılıyor. */
const DOGRULAMA_SINIRI = 25;

export async function runCitationCheck(input: {
  projectId: string | null;
  projectTitle: string | null;
  referenceList: string;
  bodyText: string;
  citationStyle?: string | null;
  /**
   * Metni kullanıcıdan değil, seçilen çalışmanın müsveddesinden al.
   * Tez gövdesi istemciye indirilip geri gönderilmiyor: yüz binlerce
   * karakteri iki kez taşımanın anlamı yok, üstelik kullanıcı metni
   * kendi editöründe zaten görüyor.
   */
  useProjectBody?: boolean;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Oturum bulunamadı. Lütfen tekrar giriş yapın." };
  }
  /* Abonelik kapısı: Atıf denetimi ücretli bir özellik ve sonucu veritabanına yazılıyor. */
  if (await isSubscriptionBlocked()) return { error: SUBSCRIPTION_BLOCKED_MESSAGE };

  /*
    project_id kullanıcıdan geliyordu ve doğrulanmıyordu: kayıt BAŞKASININ
    çalışmasına bağlanabiliyor, kurban kendi çalışmasının altında yabancı bir
    atıf denetimi görüyordu. document-upload.ts'teki denetimin eşi; okuma
    RLS'e tabi olduğu için göremediği çalışmanın kimliğini veren burada durur.
  */
  if (input.projectId) {
    const { data: ownProject, error: projectError } = await supabase
      .from("academic_projects")
      .select("id")
      .eq("id", input.projectId)
      .maybeSingle();
    if (projectError) {
      console.error(projectError);
      return { error: "Çalışma doğrulanamadı." };
    }
    if (!ownProject) return { error: "Bu çalışmaya atıf denetimi ekleyemezsiniz." };
  }

  /* Stil çalışmadan geliyor; seçilmemişse APA (kayıtların varsayılanı).
     Eskiden her kaynakça APA sanılarak ayrıştırılıyordu: Vancouver ya da
     Chicago kullanan biri, doğru yazdığı künyeler için biçim hatası
     alıyordu. */
  const stil = stilTanimi(input.citationStyle);
  const references = kunyeleriAyristir(kunyeleriBol(input.referenceList), stil.id);
  if (references.length === 0) {
    return { error: "Doğrulanabilecek bir kaynakça girdisi bulunamadı." };
  }

  /*
    Çalışmanın metni isteniyorsa sunucuda okunuyor. Sessizce metinsiz devam
    edilseydi sonuç "çapraz kontrol yapıldı, sorun yok" gibi görünürdü:
    kullanıcı metni kullanmayı AÇIKÇA istedi, olmadıysa bunu bilmeli.
  */
  let govde = input.bodyText ?? "";
  if (input.useProjectBody) {
    if (!input.projectId) return { error: "Metni almak için önce bir çalışma seçin." };
    const { data: musvedde, error: musveddeHatasi } = await supabase
      .from("project_manuscripts")
      .select("plain_text")
      .eq("project_id", input.projectId)
      .maybeSingle();
    if (musveddeHatasi) {
      console.error(musveddeHatasi);
      return { error: "Çalışmanın metni okunamadı; denetim çalıştırılmadı. Tekrar deneyin." };
    }
    govde = musvedde?.plain_text ?? "";
    if (!govde.trim()) {
      return { error: "Seçtiğiniz çalışmada henüz yazılmış metin yok. Metni yazım ekranından girin ya da buraya yapıştırın." };
    }
  }

  const govdeVar = Boolean(govde.trim());
  const citations = govdeVar ? extractInTextCitations(govde, { style: atifCikarmaStili(stil) }) : [];
  /*
    Çapraz kontrol yalnızca GÖVDE METNİ VARKEN yapılıyor.

    Eskiden metin boşken de çalışıyordu ve atıf listesi boş olduğu için
    kaynakçadaki HER künye "metinde atfı yok" diye listeleniyordu. Oysa
    kullanıcı yalnızca kaynakçasını denetletmiş olabilir — metni hiç
    yapıştırmadığı için o liste bir bulgu değil, sorunun kendisinin
    sorulmamış olmasıdır. (lib/calisma-tutarlilik.ts'te aynı koruma var.)

    Numara stillerinde atıf künyeyle adla değil sırayla eşleşir; çapraz
    kontrol orada zaten anlamsız. MLA'da eşleşme var ama YIL YOK.
  */
  const cross = govdeVar && adlaEslesir(stil)
    ? crossCheck(citations, references, { yilaBak: yilaBakilir(stil) })
    : { citationsWithoutReference: [], referencesWithoutCitation: [] };
  const score = computeComplianceScore(references, cross);
  /*
    Sınır artık AĞA GİDEN künye sayısı; önbellekten karşılananlar ondan
    düşmüyor. Eskiden ilk 25'in ötesine hiç bakılamıyordu — 120 kaynaklı
    bir tezde 95 künye kalıcı olarak "bakılmadı" kalıyordu. Artık her
    çalıştırma bakılmamış 25 künye daha kapatıyor.

    Önbellek kurulamazsa (sunucu anahtarı yok) doğrulama eskisi gibi
    çalışsın: hızlandırma yokluğu denetimi durdurmamalı.
  */
  let onbellek;
  try {
    onbellek = dogrulamaOnbellegi();
  } catch (sorun) {
    console.error("[atıf] doğrulama önbelleği kurulamadı", sorun instanceof Error ? sorun.message : sorun);
  }
  const academicVerification = await verifyAcademicReferences(references, DOGRULAMA_SINIRI, onbellek);
  const verificationSummary = {
    verified: academicVerification.filter((item) => item.status === "verified").length,
    possible: academicVerification.filter((item) => item.status === "possible_match").length,
    notFound: academicVerification.filter((item) => item.status === "not_found").length,
    insufficientData: academicVerification.filter((item) => item.status === "insufficient_data").length,
  };

  const { error } = await supabase.from("citation_checks").insert({
    project_id: input.projectId,
    project_title: input.projectTitle,
    raw_reference_list: input.referenceList,
    /*
      Çalışmanın müsveddesi buraya KOPYALANMIYOR. body_text'i okuyan hiçbir
      yer yok (yalnızca yazılıyor); bir tezin tamamını her denetimde ikinci
      bir tabloya yazmak saf maliyet olurdu — üstelik müsvedde değiştikçe
      buradaki kopya eskiyeceği için yanıltıcı da olurdu. Kayıt zaten
      project_id ile çalışmaya bağlı. Kullanıcının yapıştırdığı metin
      eskisi gibi saklanıyor: onun başka bir kaynağı yok.
    */
    body_text: input.useProjectBody ? null : (input.bodyText || null),
    parsed_references: references,
    in_text_citations: citations,
    cross_check: { ...cross, academicVerification, verificationSummary },
    compliance_score: score,
    created_by: user.id,
  });

  if (error) {
    console.error(error);
    return { error: "Sonuç kaydedilirken bir hata oluştu." };
  }

  return {
    references,
    citations,
    crossCheck: cross,
    complianceScore: score,
    academicVerification,
    verificationSummary,
    /* Ekran hangi stile göre denetlendiğini ve kaç kaynağın ağ üzerinden
       doğrulanabildiğini yazsın: "doğrulanamadı" ile "bakılmadı" aynı
       şey değil. */
    stil: { id: stil.id, ad: stil.ad, tur: stil.tur },
    dogrulananSayisi: academicVerification.length,
    toplamKaynak: references.length,
  };
}

/* Okunamadı ile "hiç denetim yapmadınız" ayrı; lib/liste-sonucu.ts. */
export type CitationCheckSatiri = {
  id: string;
  project_title: string | null;
  compliance_score: number | null;
  created_at: string;
  project_id: string | null;
};

export async function getMyCitationChecks(): Promise<ListeSonucu<CitationCheckSatiri>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return listeBasarili([]);

  const { data, error } = await supabase
    .from("citation_checks")
    .select("id, project_title, compliance_score, created_at, project_id")
    .eq("created_by", user.id)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error(error);
    return listeOkunamadi();
  }
  return listeBasarili(data);
}
