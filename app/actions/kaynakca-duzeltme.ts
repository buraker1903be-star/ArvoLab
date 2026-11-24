"use server";

import { getAuthContext, oturumYokMesaji } from "@/lib/auth-guards";
import { aktifDil, ceviri } from "@/lib/dil-sunucu";
import { eksikKaynakcaGirdileri, hazirDuzeltmeler, type DuzeltmeOzeti, type KutuphaneKaynagi } from "@/lib/atif/hazir-duzeltme";
import { YEREL } from "@/lib/dil";
import { calismaKilavuzuOku } from "@/lib/guideline-rules";
import { belgeDili } from "@/lib/belge-dili";

/*
  DENETİM SONUNDAKİ HAZIR KAYNAKÇA DÜZELTMELERİ (23.11.2026).

  Denetim neyin yanlış olduğunu söylüyordu, düzeltmeyi öğrenci elle
  yapıyordu. Burada okunan şey YENİ bir denetim değil: son denetimin
  kendi kaydı (citation_checks.parsed_references) ve kaydın stili.
  Böylece "denetimi çalıştırmak tek başına belgeyi değiştirmesin" kuralı
  korunuyor — bu eylem de değiştirmiyor, yalnızca "şu satır şu hâle
  gelir" listesini üretiyor; belgeye yazma editörde ve kullanıcının
  düğmesiyle (tek geri alma adımı).

  Abonelik kapısı YOK (lib/access.ts listesiyle tutarlı): dış maliyet
  üretmiyor, yeni içerik yazmıyor; kullanıcının kendi verisini kendi
  stilinde biçimlendirip gösteriyor. Okuma RLS'e tabi.
*/

export type DuzeltmeSonucu =
  | { hata: string }
  | {
      ozet: DuzeltmeOzeti;
      /** Düzeltmelerin hangi stile göre yazıldığı — DENETİMİN stili. */
      stil: string;
      /*
        ÇALIŞMANIN kayıtlı stili. Düzeltmelerinkinden ayrı tutuluyor:
        tek seferlik bir denetim stili seçilmiş olabilir ve kaynakçaya
        YENİ eklenen künye her zaman çalışmanın stiliyle yazılır
        (editördeki atıf eklemeyle aynı kural).
      */
      calismaStili: string;
      /* Metinde anılan ama kaynakçada olmayan kaynaklar: "Kaynakçaya ekle". */
      eklenecekler: KutuphaneKaynagi[];
      /** Denetim hiç yapılmadıysa liste değil, bu bayrak. */
      denetimYok?: boolean;
    };

export async function hazirKaynakcaDuzeltmeleri(projectId: string): Promise<DuzeltmeSonucu> {
  const ctx = await getAuthContext();
  if (!ctx) return { hata: await oturumYokMesaji() };
  const t = await ceviri();
  const dil = await aktifDil();

  const { data: calisma, error: calismaHatasi } = await ctx.supabase
    .from("academic_projects")
    .select("id, citation_style, guideline_id")
    .eq("id", projectId)
    .maybeSingle();
  if (calismaHatasi) {
    console.error("[kaynakça-düzeltme] çalışma okunamadı:", calismaHatasi.message);
    return { hata: t({ tr: "Çalışma okunamadı; tekrar deneyin.", en: "The work couldn't be read; please try again." }) };
  }
  if (!calisma) return { hata: t({ tr: "Çalışma bulunamadı.", en: "Work not found." }) };

  const { data: denetim, error: denetimHatasi } = await ctx.supabase
    .from("citation_checks")
    .select("parsed_references, in_text_citations, citation_style")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (denetimHatasi) {
    console.error("[kaynakça-düzeltme] denetim okunamadı:", denetimHatasi.message);
    return { hata: t({ tr: "Son denetim okunamadı; tekrar deneyin.", en: "The last check couldn't be read; please try again." }) };
  }
  if (!denetim) {
    return {
      ozet: { duzeltmeler: [], eksikler: [], eslesmeyen: [] },
      stil: "",
      calismaStili: (calisma.citation_style as string) ?? "apa7",
      eklenecekler: [],
      denetimYok: true,
    };
  }

  const { data: kaynaklar, error: kaynakHatasi } = await ctx.supabase
    .from("literature_sources")
    .select("id, title, authors, year, container_title, volume, issue, pages, publisher, publication_place, doi_or_url, source_type")
    .eq("project_id", projectId);
  if (kaynakHatasi) {
    console.error("[kaynakça-düzeltme] kaynaklar okunamadı:", kaynakHatasi.message);
    return { hata: t({ tr: "Kaynaklarınız okunamadı; tekrar deneyin.", en: "Your sources couldn't be read; please try again." }) };
  }

  /*
    Künyenin DİLİ çalışmanın dili ("n.d." / "t.y.", "pp." / "ss."),
    arayüzün değil: İngilizce arayüzle Türkçe tez yazan öğrencinin
    kaynakçası Türkçe kalmalı (lib/belge-dili.ts'teki kuralla aynı).
  */
  const kunyeDili = await belgeDili(ctx.supabase, projectId, dil);
  /*
    KILAVUZUN İNTERNET ÖRNEKLERİ. Kılavuz okunamazsa akış DÜŞMÜYOR:
    örnekler boş kalır ve panel bugünkü uyarıyı gösterir — geçici bir
    arıza, düzeltmeleri tümden engellememeli.
  */
  const kilavuz = await calismaKilavuzuOku(ctx.supabase, projectId, (calisma.guideline_id as string | null) ?? null).catch(() => null);
  const internetOrnekleri = kilavuz?.kilavuz?.internetOrnekleri ?? [];
  const bugun = new Date().toLocaleDateString(YEREL[kunyeDili], {
    timeZone: "Europe/Istanbul",
    ...(kunyeDili === "en" ? { day: "numeric", month: "long", year: "numeric" } : { day: "2-digit", month: "2-digit", year: "numeric" }),
  });

  /* Düzeltmeler DENETİMİN stiline göre: kullanıcı o denetimde başka bir
     stil seçtiyse düzeltme de o stilde olmalı, yoksa önizlediği biçimden
     başkası belgeye girerdi. Eski kayıtta stil yok; çalışmanınki. */
  const stil = (denetim.citation_style as string | null) ?? (calisma.citation_style as string) ?? "apa7";
  const ozet = hazirDuzeltmeler({
    kunyeler: (denetim.parsed_references ?? []) as { raw: string; issues?: { message: string }[] }[],
    kaynaklar: (kaynaklar ?? []) as unknown as KutuphaneKaynagi[],
    stil,
    dil: kunyeDili,
    erisimTarihi: bugun,
    internetOrnekleri,
  });
  const kutuphane = (kaynaklar ?? []) as unknown as KutuphaneKaynagi[];
  return {
    ozet,
    stil,
    calismaStili: (calisma.citation_style as string) ?? "apa7",
    eklenecekler: eksikKaynakcaGirdileri({
      atiflar: (denetim.in_text_citations ?? []) as { raw: string; authorKey?: string | null; year?: string | null }[],
      kunyeler: (denetim.parsed_references ?? []) as { raw: string }[],
      kaynaklar: kutuphane,
    }),
  };
}
