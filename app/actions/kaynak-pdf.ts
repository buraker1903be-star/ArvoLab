"use server";

import { calismaListeleriniYenile } from "@/lib/liste-yenileme";
import { getAuthContext, oturumYokMesaji } from "@/lib/auth-guards";
import { isSubscriptionBlocked, abonelikKapaliMesaji } from "@/lib/access";
import { varsayilanGetir } from "@/lib/kanit/dizin";
import { guvenliIndir, indirmeHatasiTuru } from "@/lib/guvenli-indir";
import { extractTextFromBuffer } from "@/lib/document-extract";
import {
  PDF_EN_FAZLA_BAYT,
  agirSorun,
  bosIndirmeSorunlari,
  pdfBaslangicKarari,
  pdfHazirMi,
  baslikPdfteGeciyor,
  kaynakRaporu,
  kunyeAnahtari,
  paketDosyalari,
  pdfAdaylari,
  pdfMi,
  type DogrulamaDurumu,
  type IndirmeSorunlari,
  type IndirmeSorunu,
  type KaynakPdfSatiri,
  type PdfDurumu,
} from "@/lib/kaynak-pdf";
import { aktifDil, aktifSaatDilimi, ceviri } from "@/lib/dil-sunucu";
import { yuklemeYoluMu } from "@/lib/kaynak-pdf-yolu";
import { baglamayiGeriAl, baglantiyiDogrula, otomatikSonucuYaz, otomatikYol, sahipsizseSil, yolKullaniliyorMu, yuklemeyiYaz } from "@/lib/kaynak-pdf-yazimi";
import { YEREL } from "@/lib/dil";
import { kaynakPdfSayfalari, SECIM_RET_METNI } from "@/lib/kaynak-pdf-okuma";
import { secimiDogrula } from "@/lib/pdf-secim";

/*
  KAYNAK PDF'LERİ (kaynak_pdfleri, migration 20261026110024).

  "PDF'leri bul" her künye için açık erişimli PDF'i arar, indirir, ilk
  baytlarından gerçekten PDF olduğunu doğrular ve çalışmanın klasörüne
  koyar. Bulunamayanı öğrenci yükler. Yetki RLS'te ve depolama
  politikasında (calisma_klasoru); buradaki denetim anlaşılır mesaj için.

  Bir çağrıda en fazla PARTI künye: her biri dış sunuculara gidiyor ve
  indirme sürüyor; uzun kaynakçayı istemci parça parça gönderiyor, ilerleme
  ekranda görünüyor.
*/

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PARTI = 3;
/*
  Bir çağrının süre bütçesi. Sayfanın maxDuration'ı 60 sn; yavaş bir
  arşiv sunucusu partinin tamamını yemesin. Bütçe dolunca kalan künyelere
  bu çağrıda bakılmaz (satır dönmez, "henüz bakılmadı" kalır); öğrenci
  düğmeye yeniden basınca yalnızca onlar sorulur.
*/
const SURE_BUTCESI_MS = 40_000;
const KOVA = "project-files";

const SECIM = "id, kunye_anahtari, kunye, doi, durum, depo_yolu, kaynak_adres, baslik_eslesti, bakildi, kaynak_id";

const yenile = () => calismaListeleriniYenile();

/** Çalışmanın bütün PDF kayıtları (sınırsız: ZIP de buradan kuruluyor). */
export async function kaynakPdfleri(projectId: string): Promise<KaynakPdfSatiri[]> {
  if (!UUID.test(projectId)) return [];
  const ctx = await getAuthContext();
  if (!ctx) return [];
  const { data, error } = await ctx.supabase.from("kaynak_pdfleri").select(SECIM).eq("project_id", projectId);
  if (error) {
    console.error("[kaynak-pdf] okunamadı:", error.message);
    return [];
  }
  return (data ?? []) as KaynakPdfSatiri[];
}

/*
  YAZIM STÜDYOSU (16.11.2026): editörün yanındaki PDF görüntüleyicinin
  listesi. kaynakPdfleri okunamayan listeyi boş döndürüyor (kaynakça
  penceresi bunu "henüz bakılmadı" diye çiziyor); görüntüleyicide boş liste
  "bu çalışmada PDF yok" demek olurdu. Okunamazsa hata ayrı döner.
  Yalnızca PDF'i hazır olan (depoda dosyası bulunan) satırlar.
*/
export async function goruntuleyiciKaynaklari(projectId: string): Promise<{ satirlar: KaynakPdfSatiri[] } | { hata: string }> {
  const t = await ceviri();
  if (!UUID.test(projectId)) return { hata: t({ tr: "Çalışma bulunamadı.", en: "Work not found." }) };
  const ctx = await getAuthContext();
  if (!ctx) return { hata: await oturumYokMesaji() };
  const { data, error } = await ctx.supabase.from("kaynak_pdfleri").select(SECIM).eq("project_id", projectId).not("depo_yolu", "is", null).order("kunye");
  if (error) {
    console.error("[kaynak-pdf] görüntüleyici listesi okunamadı:", error.message);
    return { hata: t({ tr: "Kaynak PDF'leri okunamadı; sayfayı yenileyin.", en: "Source PDFs couldn't be read; refresh the page." }) };
  }
  return { satirlar: ((data ?? []) as KaynakPdfSatiri[]).filter((r) => pdfHazirMi(r.durum)) };
}

/*
  GÖRÜNTÜLEYİCİDE SEÇİLEN PASAJIN DOĞRULANMASI (16.11.2026). Alıntı belgeye
  girmeden önce: seçim sunucunun sayfa metninde aranır (lib/pdf-secim.ts) ve
  belgeye istemcinin seçimi değil, kaynağın KENDİ metninden kesilen parça
  gider. PDF'in metni çıkarıldığı için (ağır çözümleme) abonelik kapısından
  geçer. Sayfa yalnızca PDF sayfasıdır; basılı sayfa numarasını kullanıcı
  yazar (atıf penceresi).
*/
export async function kaynakSecimiDogrula(girdi: { projectId: string; pdfId: string; sayfa: number; metin: string }): Promise<{ sayfa: number; metin: string; sonrakiSayfaya: boolean } | { hata: string }> {
  const t = await ceviri();
  if (!UUID.test(String(girdi.projectId ?? "")) || !UUID.test(String(girdi.pdfId ?? ""))) return { hata: t({ tr: "Kaynak bulunamadı.", en: "Source not found." }) };
  const ctx = await getAuthContext();
  if (!ctx) return { hata: await oturumYokMesaji() };
  if (await isSubscriptionBlocked()) return { hata: await abonelikKapaliMesaji() };
  const okuma = await kaynakPdfSayfalari(ctx.supabase, ctx.user.id, girdi.projectId, girdi.pdfId, "[kaynak-secimi]");
  if (!okuma.ok) return { hata: t(okuma.hata) };
  const sonuc = secimiDogrula(String(girdi.metin ?? ""), okuma.sayfalar, Number(girdi.sayfa));
  if (!sonuc.gecti) return { hata: t(SECIM_RET_METNI[sonuc.neden]) };
  return { sayfa: sonuc.sayfa, metin: sonuc.kanonik, sonrakiSayfaya: Boolean(sonuc.sonrakiSayfaya) };
}

type Kunye = { kunye: string; doi?: string | null; dogrulama?: DogrulamaDurumu | null };

/**
 * Künyelerin açık erişimli PDF'lerini arar ve indirir (en fazla PARTI).
 * Öğrencinin yüklediği PDF'in üzerine yazmaz.
 */
export async function kaynakPdfleriniBul(
  projectId: string,
  kunyeler: Kunye[],
): Promise<{ error?: string; satirlar?: KaynakPdfSatiri[]; sorunlar?: IndirmeSorunlari }> {
  const ctx = await getAuthContext();
  if (!ctx) return { error: await oturumYokMesaji() };
  // Dış sunuculara gidiyor ve depolamaya yazıyor: kapı burada da.
  if (await isSubscriptionBlocked()) return { error: (await abonelikKapaliMesaji()) };
  const t = await ceviri();
  if (!UUID.test(projectId)) return { error: t({ tr: "Çalışma bulunamadı.", en: "Work not found." }) };
  const { supabase, user } = ctx;

  const parti = kunyeler.slice(0, PARTI).filter((k) => typeof k?.kunye === "string" && k.kunye.trim());
  const anahtarlar = parti.map((k) => kunyeAnahtari(k.kunye)).filter(Boolean);
  const { data: mevcut, error: okumaHatasi } = await supabase
    .from("kaynak_pdfleri")
    .select("kunye_anahtari, durum, depo_yolu")
    .eq("project_id", projectId)
    .in("kunye_anahtari", anahtarlar);
  if (okumaHatasi) {
    console.error("[kaynak-pdf] okunamadı:", okumaHatasi.message);
    return { error: t({ tr: "PDF kayıtları okunamadı; tekrar deneyin.", en: "Couldn't read the PDF records; please try again." }) };
  }
  /* PDF'i hazır olan künyeye boşuna gidilmez. Bu küme yalnızca bir KISAYOL:
     arama sürerken durum değişebilir, asıl koruma yazmadaki koşul
     (lib/kaynak-pdf-yazimi.ts → otomatikSonucuYaz). */
  const hazir = new Set((mevcut ?? []).filter((m) => pdfHazirMi(m.durum as PdfDurumu)).map((m) => m.kunye_anahtari));

  const satirlar: KaynakPdfSatiri[] = [];
  const sorunlar = bosIndirmeSorunlari();
  const butceSonu = Date.now() + SURE_BUTCESI_MS;
  for (const k of parti) {
    if (Date.now() > butceSonu) break;
    const anahtar = kunyeAnahtari(k.kunye);
    if (!anahtar || hazir.has(anahtar)) continue;
    const doi = k.doi?.trim().slice(0, 300) || null;
    // Başlangıç kararı saf ve testli (lib/kaynak-pdf.ts). "ertele": hüküm yazılmaz.
    const baslangic = pdfBaslangicKarari(k.dogrulama ?? null, doi);
    if (baslangic === "ertele") continue;
    const kayit = {
      project_id: projectId,
      olusturan: user.id,
      kunye_anahtari: anahtar,
      kunye: k.kunye.trim().slice(0, 2000),
      doi,
      bakildi: new Date().toISOString(),
      baslik_eslesti: null as boolean | null,
    };

    let durum: PdfDurumu;
    let yol: string | null = null;
    let yolBayti: Uint8Array | null = null;
    let kaynakAdres: string | null = null;
    let sorun: IndirmeSorunu | null = null;

    if (baslangic === "kayit_yok") {
      durum = "kayit_yok";
    } else if (baslangic === "bulunamadi") {
      durum = "bulunamadi";
    } else {
      // DOI'nin açık erişim konumları OpenAlex'ten; ağ hatası "bulunamadı" sayılmaz.
      let adaylar: string[] = [];
      let dizinHatasi = false;
      try {
        const yanit = await varsayilanGetir(`https://api.openalex.org/works/doi:${encodeURIComponent(doi!)}`);
        if (yanit.durum >= 200 && yanit.durum < 300) adaylar = pdfAdaylari(yanit.veri);
        else if (yanit.durum !== 404) dizinHatasi = true;
      } catch {
        dizinHatasi = true;
      }

      durum = adaylar.length ? "erisilemedi" : dizinHatasi ? "erisilemedi" : "bulunamadi";
      if (!adaylar.length && dizinHatasi) sorun = "erisim";
      for (const aday of adaylar) {
        if (Date.now() > butceSonu) break;
        try {
          const indirilen = await guvenliIndir(aday, PDF_EN_FAZLA_BAYT);
          /* Yayınevinin giriş sayfası ya da "erişiminiz yok" HTML'i PDF değil.
             Adres yine saklanır: öğrenci "Kaynağa git" ile açıp kendisi
             indirebilsin (eskiden bu durumda bağlantı da kayboluyordu). */
          if (!pdfMi(indirilen.bayt)) {
            sorun = agirSorun(sorun, "pdf_degil");
            kaynakAdres = indirilen.sonAdres;
            continue;
          }
          const hedef = otomatikYol(projectId, anahtar);
          const { error: yuklemeHatasi } = await supabase.storage
            .from(KOVA)
            .upload(hedef, indirilen.bayt, { contentType: "application/pdf", upsert: false });
          if (yuklemeHatasi) {
            // PDF indi ama BİZİM depomuza yazılamadı: öğrenciye "yayıncı izin vermedi" denmez.
            console.error("[kaynak-pdf] depoya yazılamadı:", yuklemeHatasi.message);
            sorun = agirSorun(sorun, "depo");
            kaynakAdres = indirilen.sonAdres;
            continue;
          }
          durum = "indirildi";
          yol = hedef;
          yolBayti = indirilen.bayt;
          kaynakAdres = indirilen.sonAdres;
          break;
        } catch (hata) {
          const tur = indirmeHatasiTuru(hata);
          // Beklenmeyen hata BİZİM sorunumuz: uyarı değil hata olarak log'a gider.
          (tur === "beklenmeyen" ? console.error : console.warn)("[kaynak-pdf] indirilemedi:", tur, aday, hata instanceof Error ? hata.message : hata);
          sorun = agirSorun(sorun, tur);
          kaynakAdres = aday;
        }
      }
    }
    if (durum !== "indirildi" && sorun) sorunlar[sorun] += 1;

    const sonuc = await otomatikSonucuYaz<KaynakPdfSatiri>(
      supabase,
      { ...kayit, durum, depo_yolu: yol, kaynak_adres: kaynakAdres },
      SECIM,
    );
    if (sonuc.tur !== "yazildi" && yol) {
      /* Bu çağrının indirdiği dosya kayda bağlanamadı (yazma düştü ya da
         arada hazır bir PDF geldi): yalnızca kendi dosyamızı, o da hiçbir
         kayıt göstermiyorsa temizleriz. Eskiden yazma düşünce dosya yetim
         kalıyordu (denetim B-DB-1). */
      await sahipsizseSil(supabase, projectId, yol, "otomatik indirme kayda bağlanamadı", yolBayti ?? undefined);
    }
    if (sonuc.tur === "hata") {
      console.error("[kaynak-pdf] kaydedilemedi:", sonuc.hata?.message);
      return { error: sonuc.hata?.code === "42501" ? t({ tr: "Bu çalışmaya yazma yetkiniz yok.", en: "You don't have permission to write to this work." }) : t({ tr: "PDF durumu kaydedilemedi; tekrar deneyin.", en: "Couldn't save the PDF status; please try again." }) };
    }
    // Kayıt yazıldı: dosya hâlâ depoda mı (telafi yarışı, lib/kaynak-pdf-yazimi.ts → baglantiyiDogrula).
    if (sonuc.tur === "yazildi" && yol && yolBayti && (await baglantiyiDogrula(supabase, yol, yolBayti, "otomatik indirme bağlandı")) === "kayip") {
      /* Dosya depoda yok ve geri yüklenemedi. Eskiden bu sonuç okunmuyordu:
         satır "PDF hazır" diye listeye giriyor, öğrenci açamadığı bir PDF
         görüyor, sonraki aramalar da künyeyi hazır sayıp atlıyordu. Artık
         bu künye BAŞARI listesine girmez; kayıt, hâlâ bizim yolumuzu
         gösteriyorsa "erişilemedi"ye döner (adres korunur: "Kaynağa git").
         Sorun "depo" sayılır: kullanıcı "bizim tarafımızdaki bir sorun"
         hatasını görür (lib/kaynak-pdf → indirmeSorunuBildirimleri). */
      sorunlar.depo += 1;
      const geri = await baglamayiGeriAl<KaynakPdfSatiri>(
        supabase,
        projectId,
        anahtar,
        yol,
        { durum: "erisilemedi", depo_yolu: null, kaynak_adres: kaynakAdres, baslik_eslesti: null, bakildi: kayit.bakildi },
        SECIM,
      );
      if (geri.tur === "hata") {
        return { error: t({ tr: "PDF depoya ulaşmadı ve durumu düzeltilemedi; tekrar deneyin.", en: "The PDF didn't reach storage and its status couldn't be corrected; please try again." }) };
      }
      if (geri.tur === "geri_alindi" && geri.satir) satirlar.push(geri.satir);
      if (geri.tur === "degismis") {
        // Arada daha yeni bir yazma oldu: onu olduğu gibi göster, dokunma.
        const { data: guncel } = await supabase.from("kaynak_pdfleri").select(SECIM).eq("project_id", projectId).eq("kunye_anahtari", anahtar).maybeSingle();
        if (guncel) satirlar.push(guncel as KaynakPdfSatiri);
      }
      continue;
    }
    if (sonuc.satir) satirlar.push(sonuc.satir);
    /* Eskiden burada "önceki indirme" siliniyordu. Hazır olmayan satırın
       dosyası yok (tablonun check kısıtı), hazır satıra da artık
       dokunulmuyor: silinecek eski dosya kalmadı. */
  }

  yenile();
  return { satirlar, sorunlar };
}

/**
 * Öğrencinin yüklediği PDF. Dosya tarayıcıdan çalışmanın klasörüne
 * yüklenmiş oluyor; burada gerçekten PDF mi ve künyenin başlığını taşıyor
 * mu bakılıyor. PDF değilse dosya silinir, kayıt yazılmaz.
 */
export async function kaynakPdfiYuklendi(
  projectId: string,
  girdi: { kunye: string; doi?: string | null; depoYolu: string },
): Promise<{ error?: string; satir?: KaynakPdfSatiri }> {
  const ctx = await getAuthContext();
  if (!ctx) return { error: await oturumYokMesaji() };
  if (await isSubscriptionBlocked()) return { error: (await abonelikKapaliMesaji()) };
  const t = await ceviri();
  const { supabase, user } = ctx;
  const anahtar = typeof girdi?.kunye === "string" ? kunyeAnahtari(girdi.kunye) : "";
  /* Yol TAM kalıba uymalı ve yükleyen bu oturumun kullanıcısı olmalı
     (lib/kaynak-pdf-yolu.ts). Eskiden yalnızca önek denetleniyordu: aynı
     çalışmadaki başka bir künyenin dosyası da kabul ediliyordu. Geçersiz
     yolda dosyaya HİÇ dokunulmaz: kimin olduğu bilinmiyor. */
  if (!UUID.test(projectId) || !anahtar || !yuklemeYoluMu(girdi.depoYolu, projectId, user.id)) {
    // Dağıtımdan önce açılmış bir sekme eski biçimde yol üretir: yenilemek yeter.
    return { error: t({ tr: "Dosya yolu geçersiz. Sayfayı yenileyip yeniden yükleyin.", en: "Invalid file path. Reload the page and upload again." }) };
  }
  const yol = girdi.depoYolu;

  // Başka bir künyenin kaydı bu dosyayı gösteriyorsa onu bu künyeye bağlamak ikisini birbirine düğümler.
  const baskasinda = await yolKullaniliyorMu(supabase, projectId, yol, anahtar);
  if (baskasinda === null) return { error: t({ tr: "Kaydedilemedi; tekrar deneyin.", en: "Couldn't save; please try again." }) };
  if (baskasinda) return { error: t({ tr: "Bu dosya başka bir kaynağa bağlı.", en: "This file is attached to another source." }) };

  const { data: dosya, error: indirmeHatasi } = await supabase.storage.from(KOVA).download(yol);
  if (indirmeHatasi || !dosya) {
    console.error("[kaynak-pdf] yüklenen dosya okunamadı:", indirmeHatasi?.message);
    return { error: t({ tr: "Yüklenen dosya okunamadı; tekrar deneyin.", en: "Couldn't read the uploaded file; please try again." }) };
  }
  const bayt = new Uint8Array(await dosya.arrayBuffer());
  if (!pdfMi(bayt)) {
    await sahipsizseSil(supabase, projectId, yol, "yüklenen dosya PDF değil", bayt);
    return { error: t({ tr: "Dosya PDF değil. Kaynağın PDF'ini yükleyin.", en: "The file isn't a PDF. Upload the source's PDF." }) };
  }

  /* Başlık eşleşmesi bir uyarı, engel değil: taranmış PDF'ten metin
     çıkmayabilir, başlık kapakta resim olabilir. */
  let baslikEslesti: boolean | null = null;
  try {
    const metin = await extractTextFromBuffer(Buffer.from(bayt), "pdf");
    baslikEslesti = metin.trim() ? baslikPdfteGeciyor(girdi.kunye, metin) : null;
  } catch {
    baslikEslesti = null;
  }

  const sonuc = await yuklemeyiYaz<KaynakPdfSatiri>(
    supabase,
    {
      project_id: projectId,
      olusturan: user.id,
      kunye_anahtari: anahtar,
      kunye: girdi.kunye.trim().slice(0, 2000),
      doi: girdi.doi?.trim().slice(0, 300) || null,
      durum: "yuklendi",
      depo_yolu: yol,
      kaynak_adres: null,
      baslik_eslesti: baslikEslesti,
      bakildi: new Date().toISOString(),
    },
    SECIM,
  );
  if (sonuc.tur !== "yazildi") {
    // Telafi: dosya bu işlemin; hiçbir kayıt göstermiyorsa silinir (eskiden yetim kalıyordu).
    await sahipsizseSil(supabase, projectId, yol, "yükleme kayda bağlanamadı", bayt);
    if (sonuc.tur === "hata") console.error("[kaynak-pdf] kaydedilemedi:", sonuc.hata?.message);
    return {
      error:
        sonuc.tur === "hata" && sonuc.hata?.code === "42501"
          ? t({ tr: "Bu çalışmaya yazma yetkiniz yok.", en: "You don't have permission to write to this work." })
          : t({ tr: "Kaydedilemedi; tekrar deneyin.", en: "Couldn't save; please try again." }),
    };
  }
  /* Yerine geçilen dosya: yalnızca artık hiçbir kayıt göstermiyorsa silinir.
     Eskiden koşulsuz siliniyordu; kayıt başka künyenin dosyasını
     gösteriyorsa onun PDF'i gidiyordu (denetim B-PATH-1). */
  // Kayıt yazıldı: dosya hâlâ depoda mı (telafi yarışı, lib/kaynak-pdf-yazimi.ts → baglantiyiDogrula).
  if ((await baglantiyiDogrula(supabase, yol, bayt, "yükleme bağlandı")) === "kayip") {
    /* Kayıt yazıldı ama dosya depoda yok ve geri yüklenemedi: "yüklendi"
       demek veri kaybını gizlemek olur. Kayıt da düzeltilir: hâlâ bizim
       yolumuzu gösteriyorsa ÖNCEKİ hâline döner (eski PDF henüz silinmedi,
       yerinde) ya da satırı biz açtıysak silinir. Daha yeni bir yazma
       varsa ona dokunulmaz. */
    await baglamayiGeriAl(supabase, projectId, anahtar, yol, sonuc.onceki, SECIM);
    yenile();
    return { error: t({ tr: "PDF depoya ulaşmadı; yeniden yükleyin.", en: "The PDF didn't reach storage; please upload it again." }) };
  }
  if (sonuc.eskiYol && sonuc.eskiYol !== yol) await sahipsizseSil(supabase, projectId, sonuc.eskiYol, "yerine yenisi yüklendi");

  yenile();
  return { satir: sonuc.satir };
}

/**
 * Teslim paketinin (ZIP) içeriği: kaynak PDF'lerinin ZIP'teki adları ve
 * kısa ömürlü indirme bağlantıları, kaynak raporu. ZIP tarayıcıda
 * kuruluyor: PDF'ler sunucunun tek yanıt sınırını (~4,5 MB) hızla aşar.
 *
 * Veriyi dışarı çıkardığı için abonelik kapısı var (Word dışa aktarımıyla
 * aynı). Çalışmayı görebilen (öğrenci, atanan uzman, kurumun gözetim
 * rolleri) paketi indirebiliyor: okuma RLS'te, PDF'ler çalışmanın
 * klasöründe (depolama politikası calisma_klasoru).
 */
export async function teslimPaketi(
  projectId: string,
): Promise<{ error?: string; baslik?: string; dosyalar?: { ad: string; url: string }[]; rapor?: string }> {
  const ctx = await getAuthContext();
  if (!ctx) return { error: await oturumYokMesaji() };
  if (await isSubscriptionBlocked()) return { error: (await abonelikKapaliMesaji()) };
  const t = await ceviri();
  if (!UUID.test(projectId)) return { error: t({ tr: "Çalışma bulunamadı.", en: "Work not found." }) };
  const { supabase } = ctx;

  const [{ data: calisma, error: calismaHatasi }, { data: satirlar, error: satirHatasi }] = await Promise.all([
    supabase.from("academic_projects").select("title").eq("id", projectId).maybeSingle(),
    supabase.from("kaynak_pdfleri").select(SECIM).eq("project_id", projectId),
  ]);
  if (calismaHatasi || satirHatasi) {
    console.error("[teslim-paketi] okunamadı:", calismaHatasi?.message ?? satirHatasi?.message);
    return { error: t({ tr: "Paket hazırlanamadı; tekrar deneyin.", en: "Couldn't prepare the package; please try again." }) };
  }
  if (!calisma) return { error: t({ tr: "Çalışma bulunamadı.", en: "Work not found." }) };

  const paket = paketDosyalari((satirlar ?? []) as KaynakPdfSatiri[]);
  const dosyali = paket.filter((d) => d.ad && d.satir.depo_yolu);
  let dosyalar: { ad: string; url: string }[] = [];
  if (dosyali.length) {
    const { data: imzali, error } = await supabase.storage
      .from(KOVA)
      .createSignedUrls(dosyali.map((d) => d.satir.depo_yolu!), 600);
    if (error) {
      console.error("[teslim-paketi] bağlantılar alınamadı:", error.message);
      return { error: t({ tr: "Kaynak PDF'lerine ulaşılamadı; tekrar deneyin.", en: "Couldn't reach the source PDFs; please try again." }) };
    }
    dosyalar = dosyali
      .map((d, i) => ({ ad: d.ad!, url: imzali?.[i]?.signedUrl ?? "" }))
      .filter((d) => d.url);
  }

  /* Rapor paketi indirenin dilinde: dosya adları (ZIP) da istemcide aynı dille kuruluyor. */
  const dil = await aktifDil();
  const tarih = new Intl.DateTimeFormat(YEREL[dil], { timeZone: await aktifSaatDilimi(), dateStyle: "long", timeStyle: "short" }).format(new Date());
  return { baslik: calisma.title, dosyalar, rapor: kaynakRaporu(calisma.title, paket, tarih, dil) };
}

/*
  PDF'İ KAYNAK KAYDINA BAĞLAMA (K2-A, 19.11.2026; migration 20261118125346).
  Yalnızca kullanıcının açık eylemiyle; eski satırlar toplu ya da tahminle
  bağlanmaz. Yetki yalnızca yabancı anahtara bırakılmaz: PDF'in bu çalışmaya,
  kaynağın da AYNI çalışmaya ve çağıranın görebildiği kayıtlara (RLS)
  ait olduğu burada okunarak denetlenir. Veritabanı aynı kuralı
  tetikleyiciyle ayrıca uygular (kaynak_pdf_bagi_denetle); buradaki
  denetim anlaşılır mesaj için. Mevcut kaydın güncellenmesi olduğu için
  abonelik kapısı yok (lib/access.ts).
*/
export async function pdfKaynaginiBagla(girdi: { projectId: string; pdfId: string; kaynakId: string | null }): Promise<{ ok: true } | { hata: string }> {
  const t = await ceviri();
  const { projectId, pdfId, kaynakId } = girdi;
  if (!UUID.test(String(projectId ?? "")) || !UUID.test(String(pdfId ?? "")) || (kaynakId !== null && !UUID.test(String(kaynakId)))) {
    return { hata: t({ tr: "Kaynak ya da PDF bulunamadı.", en: "Source or PDF not found." }) };
  }
  const ctx = await getAuthContext();
  if (!ctx) return { hata: await oturumYokMesaji() };

  const { data: pdf, error: pdfHatasi } = await ctx.supabase.from("kaynak_pdfleri").select("id, project_id").eq("id", pdfId).eq("project_id", projectId).maybeSingle();
  if (pdfHatasi) {
    console.error("[kaynak-pdf] bağ: PDF okunamadı:", pdfHatasi.message);
    return { hata: t({ tr: "PDF okunamadı; bağ kurulmadı. Tekrar deneyin.", en: "The PDF couldn't be read; nothing was linked. Try again." }) };
  }
  if (!pdf) return { hata: t({ tr: "Bu PDF bu çalışmada bulunamadı.", en: "This PDF wasn't found in this work." }) };

  if (kaynakId) {
    const { data: kaynak, error: kaynakHatasi } = await ctx.supabase.from("literature_sources").select("id, project_id").eq("id", kaynakId).maybeSingle();
    if (kaynakHatasi) {
      console.error("[kaynak-pdf] bağ: kaynak okunamadı:", kaynakHatasi.message);
      return { hata: t({ tr: "Kaynak okunamadı; bağ kurulmadı. Tekrar deneyin.", en: "The source couldn't be read; nothing was linked. Try again." }) };
    }
    if (!kaynak || kaynak.project_id !== projectId) {
      return { hata: t({ tr: "Bu kaynak bu çalışmaya ait değil; PDF bağlanmadı.", en: "This source doesn't belong to this work; the PDF wasn't linked." }) };
    }
  }

  const { data: guncel, error } = await ctx.supabase.from("kaynak_pdfleri").update({ kaynak_id: kaynakId }).eq("id", pdfId).eq("project_id", projectId).select("id");
  if (error) {
    console.error("[kaynak-pdf] bağ yazılamadı:", error.message);
    return { hata: t({ tr: "Bağ kaydedilemedi; tekrar deneyin.", en: "The link couldn't be saved; try again." }) };
  }
  // RLS satırı sessizce elerse "bağlandı" denmez.
  if (!guncel?.length) return { hata: t({ tr: "Bu çalışmada değişiklik yetkiniz yok.", en: "You don't have permission to change this work." }) };
  return { ok: true };
}

/*
  ATIF KARTININ KÜNYE SATIRI (K3-A). Kaynak başına en güçlü künye denetim
  sonucu, kanıt matrisinin gerçek kayıtlarından (kanit_kayitlari.kunye_durumu,
  Crossref/OpenAlex). Kayıt yoksa "denetlenmedi": tahmin yok. Okuma; kapısız.
*/
export type KunyeDurumOzeti = { kaynakId: string; durum: "dogrulandi" | "kismen" | "uyusmuyor" | "dogrulanamadi"; dizin: "crossref" | "openalex" | null };

export async function kaynakKunyeDurumlari(projectId: string): Promise<{ satirlar: KunyeDurumOzeti[] } | { hata: string }> {
  const t = await ceviri();
  if (!UUID.test(String(projectId ?? ""))) return { hata: t({ tr: "Çalışma bulunamadı.", en: "Work not found." }) };
  const ctx = await getAuthContext();
  if (!ctx) return { hata: await oturumYokMesaji() };
  const { data, error } = await ctx.supabase
    .from("kanit_kayitlari")
    .select("kaynak_id, kunye_durumu, kunye_kaynagi")
    .eq("project_id", projectId)
    .not("kaynak_id", "is", null)
    .neq("kunye_durumu", "bakilmadi");
  if (error) {
    console.error("[kaynak-pdf] künye durumları okunamadı:", error.message);
    return { hata: t({ tr: "Künye denetimleri okunamadı.", en: "Reference checks couldn't be read." }) };
  }
  const SIRA = ["dogrulandi", "kismen", "uyusmuyor", "dogrulanamadi"] as const;
  const enIyi = new Map<string, KunyeDurumOzeti>();
  for (const satir of data ?? []) {
    const durum = satir.kunye_durumu as KunyeDurumOzeti["durum"];
    if (!SIRA.includes(durum) || !satir.kaynak_id) continue;
    const onceki = enIyi.get(satir.kaynak_id);
    if (!onceki || SIRA.indexOf(durum) < SIRA.indexOf(onceki.durum)) {
      enIyi.set(satir.kaynak_id, { kaynakId: satir.kaynak_id, durum, dizin: (satir.kunye_kaynagi as KunyeDurumOzeti["dizin"]) ?? null });
    }
  }
  return { satirlar: [...enIyi.values()] };
}
