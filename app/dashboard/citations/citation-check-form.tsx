"use client";

import { asistanCagir } from "@/lib/asistan-istemci";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { kaynakcaDenetle, type KaynakcaDenetimYaniti } from "@/app/actions/ai-kaynakca";
import AsistanSonuc from "../_components/asistan-sonuc";
import PanelDrawer from "../_components/panel-drawer";
import YapilacagaEkle from "../_components/yapilacaga-ekle";
import type { GecmisKaydi } from "@/lib/ai/gecmis";
import { ClipboardPaste, FileSearch, History, Sparkles } from "lucide-react";
import KaynakPdfSatiri from "./kaynak-pdf-satiri";
import { showToast } from "../_components/toast-events";
import { kaynakPdfleriniBul } from "@/app/actions/kaynak-pdf";
import { kunyeAnahtari, type KaynakPdfSatiri as PdfSatiri } from "@/lib/kaynak-pdf";
import { runCitationCheck, calismaMetniOzeti } from "@/app/actions/citation-check";
import { literaturAramasiYap } from "@/app/actions/literatur-arama";
import type { AramaKaydi } from "@/lib/literatur-arama";
import type { Tone } from "@/lib/status-tone";
import { STIL_SECENEKLERI, type AtifTuru } from "@/lib/atif/stiller";
import { useCeviri, useDil, useTarihler } from "@/app/_components/dil-saglayici";
import { YEREL, type Metin } from "@/lib/dil";

interface Project {
  id: string;
  title: string;
  university: string | null;
  citation_style?: string | null;
}

interface CheckResultRef {
  raw: string;
  /* Ayrıştırıcıdan geliyor; alternatif arama sorgusu bundan kuruluyor
     (ham künye yerine başlıkla aramak çok daha isabetli). */
  title?: string | null;
  issues: { field: string; message: string; severity: string }[];
}

interface AcademicMatch {
  provider: "crossref" | "openalex";
  title: string;
  year: number | null;
  doi: string | null;
  authors: string[];
  venue: string | null;
  url: string;
  citedByCount: number | null;
  confidence: number;
}

interface AcademicVerification {
  reference: string;
  status: "verified" | "possible_match" | "not_found" | "insufficient_data";
  googleScholarUrl: string;
  bestMatch: AcademicMatch | null;
  matches: AcademicMatch[];
}

interface InTextCitation {
  raw: string;
}

export interface CheckResult {
  complianceScore: number;
  references: CheckResultRef[];
  citations: InTextCitation[];
  crossCheck: {
    citationsWithoutReference: { raw: string }[];
    referencesWithoutCitation: { raw: string }[];
  };
  academicVerification: AcademicVerification[];
  verificationSummary: {
    verified: number;
    possible: number;
    notFound: number;
    insufficientData: number;
  };
  stil: { id: string; ad: string; tur: AtifTuru };
  dogrulananSayisi: number;
  toplamKaynak: number;
  /* Kılavuz atıf kuralları (lib/atif/tyk.ts); metin yoksa ya da eski kayıtta null. */
  tyk?: { tur: "yilsiz" | "kalip" | "yil_uyusmazligi"; atif: string; aciklama: string }[] | null;
  ornekAtif?: string | null;
}

const STATUS_META: Record<AcademicVerification["status"], { label: Metin; tone: Tone }> = {
  verified: { label: { tr: "Doğrulandı", en: "Verified" }, tone: "success" },
  possible_match: { label: { tr: "Olası eşleşme", en: "Possible match" }, tone: "warning" },
  not_found: { label: { tr: "Kayıt bulunamadı", en: "No record found" }, tone: "danger" },
  insufficient_data: { label: { tr: "Yetersiz veri", en: "Insufficient data" }, tone: "neutral" },
};

/* Bu turda ağ doğrulamasına sıra gelmemiş künye. "Bulunamadı" DEĞİL. */
const BAKILMADI: { label: Metin; tone: Tone } = { label: { tr: "Bu turda bakılmadı", en: "Not checked this round" }, tone: "neutral" };

const ASISTAN_KAPALI: Metin = {
  tr: "Asistan bu kurulumda kapalı; yöneticinizin yapay zeka anahtarını tanımlaması gerekiyor.",
  en: "The assistant is turned off in this installation; your administrator needs to set up the AI key.",
};
const KUNYE_ORNEGI: Metin = {
  tr: "Yılmaz, A. (2020). Örnek makale başlığı. Dergi Adı, 12(3), 45-60. https://doi.org/...",
  en: "Smith, A. (2020). Sample article title. Journal Name, 12(3), 45-60. https://doi.org/...",
};

export default function CitationCheckForm({
  projects,
  asistanAcik,
  secilenCalisma = null,
  gomulu = false,
  oncekiSonuc = null,
  asistanGecmisi = [],
  kaynakPdfleri = [],
}: {
  projects: Project[];
  asistanAcik: boolean;
  secilenCalisma?: string | null;
  /*
    Çalışmalarım kartının Kaynakça penceresinde: çalışma sabit, başlık
    ve çalışma seçici çizilmiyor (pencerenin kendi başlığı var).
  */
  gomulu?: boolean;
  /*
    Bu çalışmanın son kaydedilmiş denetimi (sonKaynakcaDenetimi). Pencere
    açılınca sonuç kartı onunla dolu gelir; eskiden boş geliyordu ve
    öğrenci gördüğü sonucu tekrar görmek için denetimi yeniden
    çalıştırıyordu.
  */
  oncekiSonuc?: (CheckResult & { tarih: string }) | null;
  /** Bu çalışmanın kayıtlı asistan yorumları (penceredeki "Geçmiş sorgular"). */
  asistanGecmisi?: GecmisKaydi[];
  /** Bu çalışmanın kaynak PDF kayıtları (kaynak_pdfleri). */
  kaynakPdfleri?: PdfSatiri[];
}) {
  const router = useRouter();
  const t = useCeviri();
  const dil = useDil();
  const { tarihSaat } = useTarihler();
  const etiketler = { uyari: t({ tr: "Sorun", en: "Issue" }), oneri: t({ tr: "Öneri", en: "Suggestion" }), bilgi: t({ tr: "Not", en: "Note" }) };
  // Bir çalışmadan gelindiyse çalışma hazır seçili gelir.
  const [projectId, setProjectId] = useState<string>(secilenCalisma ?? "");
  const [projectTitle, setProjectTitle] = useState("");
  const [referenceList, setReferenceList] = useState("");
  /* Stil sorulmuyordu ve her kaynakça APA sanılıyordu: Vancouver ya da
     Chicago kullanan biri, doğru yazdığı künyeler için biçim hatası
     alıyordu. */
  /*
    Çalışma hazır seçili geldiyse stil de onun kaydından. Eskiden yalnızca
    seçici DEĞİŞİNCE okunuyordu; çalışmadan gelen öğrenci IEEE yazdığı
    tezini APA sanılarak denetletiyordu.
  */
  const [citationStyle, setCitationStyle] = useState(
    () => projects.find((p) => p.id === secilenCalisma)?.citation_style ?? "apa7",
  );
  const [bodyText, setBodyText] = useState("");
  /*
    Metin alanı isteğe bağlı olduğu için çoğu denetim metinsiz çalışıyordu:
    çapraz kontrol (metin içi atıf ↔ kaynakça) sessizce devre dışı kalıyor,
    denetimin elle yapılması en zor yarısı hiç yapılmıyordu. Oysa metin
    ArvoLab'ın kendi editöründe duruyor.

    Tez gövdesi istemciye indirilmiyor: yüz binlerce karakteri iki kez
    taşımak yerine sunucu kendi okuyor (useProjectBody). Kullanıcı ne
    denetleneceğini kelime sayısından görüyor.
  */
  const [calismaMetniniKullan, setCalismaMetniniKullan] = useState(false);
  const [metinOzeti, setMetinOzeti] = useState<{ kelime: number; okunamadi: boolean } | null>(null);
  const [ozetBekleniyor, setOzetBekleniyor] = useState(false);

  async function metniKullan(acik: boolean) {
    setCalismaMetniniKullan(acik);
    if (!acik || !projectId) return;
    setOzetBekleniyor(true);
    try {
      setMetinOzeti(await calismaMetniOzeti(projectId));
    } finally {
      setOzetBekleniyor(false);
    }
  }
  const [result, setResult] = useState<CheckResult | null>(oncekiSonuc);
  /* Gösterilen sonuç kayıtlı denetimden mi geliyor? Yeni çalıştırmada düşer. */
  const [kayitliTarih, setKayitliTarih] = useState<string | null>(oncekiSonuc?.tarih ?? null);
  /*
    "Kayıt bulunamadı" çıkan künye için AYNI KONUDA dizinde gerçekten
    bulunan çalışmalar. İki sebepten biri olabilir: künye dizinde
    olmayan bir kaynak (Türkçe tez, kurum raporu) ya da yanlış yazılmış
    bir künye. İkincisinde öğrencinin aradığı çalışma bir tık ötede;
    birincisinde liste boş çıkar ve bu da bir cevaptır.

    İSTEK ÜZERİNE çalışıyor, kendiliğinden değil: her bulunamayan künye
    için ağa çıkmak, dizinlerin kapısında bizim adımıza gürültü olurdu
    (saatlik hak da oradan yeniyor).
  */
  const [alternatif, setAlternatif] = useState<Record<string, "araniyor" | { kayitlar: AramaKaydi[]; hata?: string }>>({});

  const alternatifAra = async (anahtar: string, sorgu: string) => {
    setAlternatif((onceki) => ({ ...onceki, [anahtar]: "araniyor" }));
    const yanit = await literaturAramasiYap({ sorgu: sorgu.slice(0, 300), gunlukDisi: true });
    setAlternatif((onceki) => ({
      ...onceki,
      [anahtar]: { kayitlar: (yanit.kayitlar ?? []).slice(0, 4), hata: yanit.hata },
    }));
  };
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [denetim, setDenetim] = useState<KaynakcaDenetimYaniti | null>(null);
  const [bekleniyor, basla] = useTransition();
  /* Pencere içi pencereler (yalnızca gomulu): yapıştırma ve asistan yorumu. */
  const [yapistirAcik, setYapistirAcik] = useState(false);
  const [yorumAcik, setYorumAcik] = useState(false);
  /* Asistan penceresinde gösterilen: yeni yorum (null) ya da geçmiş bir sorgu. */
  const [gecmisGoster, setGecmisGoster] = useState<GecmisKaydi | null>(null);
  /* Künye anahtarı → PDF kaydı. Sunucudan gelenle başlar, işlemlerle anında güncellenir. */
  const [pdfler, setPdfler] = useState<Map<string, PdfSatiri>>(() => new Map(kaynakPdfleri.map((p) => [p.kunye_anahtari, p])));
  const [pdfIlerleme, setPdfIlerleme] = useState<{ bitti: number; toplam: number } | null>(null);
  const pdfGuncelle = (satirlar: PdfSatiri[]) =>
    setPdfler((onceki) => {
      const yeni = new Map(onceki);
      for (const satir of satirlar) yeni.set(satir.kunye_anahtari, satir);
      return yeni;
    });

  // zorla=true: kayıtlı cevap atlanır, modele yeniden sorulur.
  function yorumlat(zorla: boolean) {
    if (!result) return;
    basla(async () => {
      setDenetim(null);
      /*
        Künye ile doğrulama sonucu HAM METİNLE eşleniyor, sırayla değil.

        Eskiden sonuç dizisi her zaman kaynakçanın ilk N künyesiydi, o
        yüzden sıra numarası tutuyordu. Doğrulama önbelleğe alınınca
        (lib/academic-reference-verification.ts) dizi aradan künye
        atlayabiliyor: bu turda bakılmamış bir künyenin yerine bir
        sonraki geliyor. Sıraya güvenmek, bir künyenin biçim
        sorunlarını BAŞKA bir künyeye yapıştırmak olurdu — asistana da
        o yanlış eşleştirme giderdi.

        Aynı künye kaynakçada iki kez yazılmışsa ikisi de ilk sıradaki
        numarayı alır; yanlış künyeye sorun yapıştırmaktan iyidir.
      */
      const kunyeBilgisi = new Map(
        result.references.map((kunye, index) => [kunye.raw, { sira: index + 1, issues: kunye.issues }]),
      );
      setDenetim(
        await asistanCagir(() => kaynakcaDenetle({
          kaynaklar: result.academicVerification.map((item) => {
            const kunye = kunyeBilgisi.get(item.reference);
            return {
              sira: kunye?.sira ?? 0,
              ham: item.reference,
              durum: item.status,
              bicimSorunlari: (kunye?.issues ?? []).map((sorun) => `${sorun.field}: ${sorun.message}`),
              eslesmeBasligi: item.bestMatch?.title ?? null,
            };
          }),
          eksikKaynaklar: result.crossCheck.citationsWithoutReference.map((c) => c.raw),
          kullanilmayanKaynaklar: result.crossCheck.referencesWithoutCitation.map((r) => r.raw),
          atiflar: (result.citations ?? []).map((c) => c.raw),
          projectId: projectId || null,
          zorla,
        }), dil),
      );
      // Yeni yorum soldaki "Geçmiş sorgular"a düşsün.
      if (gomulu) router.refresh();
    });
  }

  /*
    KAYNAK PDF'LERİNİ BUL: denetlenmiş her künye için açık erişim PDF'i
    aranır ve indirilir (sunucuda, parça parça). Zaten dosyası olanlar
    atlanır; bu turda dizine bakılmamış künyeler de atlanır — DOI'si
    bilinmeden "PDF yok" demek yanlış olurdu.
  */
  async function pdfleriBul() {
    if (!result || !projectId) return;
    const kuyruk = result.references
      .map((kunye) => {
        const dogrulama = dogrulamaHaritasi.get(kunye.raw);
        return { kunye: kunye.raw, doi: dogrulama?.bestMatch?.doi ?? null, dogrulama: dogrulama?.status ?? null };
      })
      .filter((k) => k.dogrulama !== null)
      .filter((k) => {
        const mevcut = pdfler.get(kunyeAnahtari(k.kunye));
        return mevcut?.durum !== "indirildi" && mevcut?.durum !== "yuklendi";
      });
    if (!kuyruk.length) {
      showToast("success", t({ tr: "Bakılacak yeni kaynak yok; PDF'i olanlar hazır.", en: "No new sources to check; those with PDFs are ready." }));
      return;
    }
    setPdfIlerleme({ bitti: 0, toplam: kuyruk.length });
    try {
      for (let i = 0; i < kuyruk.length; i += 3) {
        const sonuc = await kaynakPdfleriniBul(projectId, kuyruk.slice(i, i + 3));
        if (sonuc.error) {
          showToast("error", sonuc.error);
          return;
        }
        pdfGuncelle(sonuc.satirlar ?? []);
        setPdfIlerleme({ bitti: Math.min(i + 3, kuyruk.length), toplam: kuyruk.length });
      }
      router.refresh();
    } finally {
      setPdfIlerleme(null);
    }
  }

  async function handleCheck(kaynakcayiMetindenAl = false) {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const selectedProject = projects.find((p) => p.id === projectId);
      const res = await runCitationCheck({
        projectId: projectId || null,
        projectTitle: selectedProject ? selectedProject.title : projectTitle || null,
        referenceList,
        bodyText,
        citationStyle,
        useProjectBody: (calismaMetniniKullan || gomulu) && Boolean(projectId),
        kaynakcayiMetindenAl,
      });
      if ("error" in res) {
        setError(res.error as string);
      } else {
        setResult(res as CheckResult);
        setKayitliTarih(null);
        // Son denetim puanı Çalışmalarım kartında ve geçmiş listesinde görünsün.
        router.refresh();
      }
    } catch {
      setError(t({ tr: "Akademik veri kaynaklarına erişilirken bir hata oluştu. Lütfen yeniden deneyin.", en: "An error occurred while accessing academic data sources. Please try again." }));
    } finally {
      setLoading(false);
    }
  }

  /*
    Doğrulama sonucu künyeye HAM METİNLE bağlanıyor, sırayla değil:
    önbellek devreye girdiğinden beri sonuç dizisi aradan künye
    atlayabiliyor (lib/academic-reference-verification.ts).
  */
  const dogrulamaHaritasi = new Map((result?.academicVerification ?? []).map((item) => [item.reference, item]));
  /* Atıf çıkarılamadıysa çapraz kontrol ölçülmemiştir; "Yok" yazmak
     yapılmamış bir denetimi temiz rapor gibi gösterirdi. */
  const atifOlculdu = (result?.citations?.length ?? 0) > 0;
  const atifsizKaynak = result?.crossCheck.referencesWithoutCitation ?? [];
  const kaynaksizAtif = result?.crossCheck.citationsWithoutReference ?? [];

  /* Sol karttaki PDF özeti: kaynakçadaki künyelerin PDF durumları. */
  const pdfDurumlari = (result?.references ?? []).map((kunye) => pdfler.get(kunyeAnahtari(kunye.raw))?.durum ?? null);
  const pdfSay = (...durumlar: (string | null)[]) => pdfDurumlari.filter((d) => durumlar.includes(d)).length;
  const pdfOzeti = pdfDurumlari.some(Boolean)
    ? [
        t({
          tr: `${pdfSay("indirildi", "yuklendi")}/${pdfDurumlari.length} kaynağın PDF'i hazır`,
          en: `PDFs ready for ${pdfSay("indirildi", "yuklendi")}/${pdfDurumlari.length} sources`,
        }),
        pdfSay("bulunamadi", "erisilemedi")
          ? t({
              tr: `${pdfSay("bulunamadi", "erisilemedi")} kaynağın PDF'ini siz yükleyin`,
              en: `upload the PDF yourself for ${pdfSay("bulunamadi", "erisilemedi")} ${pdfSay("bulunamadi", "erisilemedi") === 1 ? "source" : "sources"}`,
            })
          : "",
        pdfSay("kayit_yok")
          ? t({
              tr: `${pdfSay("kayit_yok")} künye dizinde yok`,
              en: `${pdfSay("kayit_yok")} ${pdfSay("kayit_yok") === 1 ? "reference isn't" : "references aren't"} in the indexes`,
            })
          : "",
      ]
        .filter(Boolean)
        .join(" · ")
    : t({
        tr: "Açık erişimli PDF'ler bulunup indirilir; ücretli kaynakların PDF'ini kendiniz yüklersiniz.",
        en: "Open-access PDFs are found and downloaded; you upload PDFs of paywalled sources yourself.",
      });

  /* Sayfada sonuçların altında; pencerede sol sütunun ikinci kartı. */
  const asistanBolumu = result ? (
    <div className="asistan-kart">
      <div className="asistan-kart-ust">
        <h3>{t({ tr: "Asistan yorumlasın", en: "Have the assistant interpret" })}</h3>
        {dil === "en" ? (
          <p>
            The results above are mechanical: not every record missing from the indexes is an error — theses and
            institutional reports are often not in Crossref. The assistant separates expected absences from real
            doubts, prioritizes formatting issues and checks <strong>citation–reference list consistency</strong>: if
            the text says &ldquo;Demir (2020)&rdquo; and the reference list says &ldquo;Demir, A. (2021)&rdquo;, you see
            two separate issues above, but it&apos;s a single year mismatch. It doesn&apos;t write corrected references;
            it isn&apos;t allowed to produce DOIs, years or volume numbers.
          </p>
        ) : (
          <p>
            Yukarıdaki sonuçlar mekanik: dizinde bulunmayan her kayıt hata
            değildir — Türkçe tezler ve kurum raporları Crossref&apos;te
            çoğu zaman yer almaz. Asistan beklenen yoklukla gerçek şüpheyi
            ayırır, biçim sorunlarını önceliklendirir ve{" "}
            <strong>atıf–kaynakça uyumunu</strong> denetler: metinde
            &ldquo;Demir (2020)&rdquo;, kaynakçada &ldquo;Demir, A.
            (2021)&rdquo; yazıyorsa yukarıda iki ayrı sorun görünür; oysa
            tek bir yıl uyuşmazlığıdır. Düzeltilmiş künye yazmaz; DOI, yıl
            ya da cilt numarası üretmesine izin verilmez.
          </p>
        )}
      </div>

      <div className="project-form-actions mt-sm">
        <button
          type="button"
          className="projects-primary-button"
          disabled={!asistanAcik || bekleniyor}
          onClick={() => yorumlat(false)}
        >
          {bekleniyor ? t({ tr: "Denetleniyor…", en: "Checking…" }) : t({ tr: "Kaynakçayı Yorumlat", en: "Interpret Reference List" })}
        </button>
      </div>

      {!asistanAcik && (
        <p className="asistan-uyari" data-tone="neutral">
          {t(ASISTAN_KAPALI)}
        </p>
      )}

      <AsistanSonuc
        sonuc={denetim}
        yetenek="kaynakca"
        etiketler={etiketler}
        bulguBasligi={t({ tr: "Asistan bulguları", en: "Assistant findings" })}
        bekleniyor={bekleniyor}
        onYenidenSorgula={() => yorumlat(true)}
      />
    </div>
  ) : null;

  /*
    Sonuç bloğu iki yerde çiziliyor: sayfada formun altında, Çalışmalarım
    penceresinde sağdaki kartta (yan yana iki kart: denetim + sonuç).
  */
  const sonucIcerik = (
    <>
      {error && (
        <p className="alert mt-sm" data-tone="danger" role="alert">{error}</p>
      )}

      {result && (
        <div className="results-divider">
          <div className="chip-row">
            <strong className="chip">
              {t({ tr: `${result.stil.ad} uyumu: ${result.complianceScore}/100`, en: `${result.stil.ad} compliance: ${result.complianceScore}/100` })}
            </strong>
            <span className="chip" data-tone="success">
              {t({ tr: `${result.verificationSummary.verified} doğrulandı`, en: `${result.verificationSummary.verified} verified` })}
            </span>
            <span className="chip" data-tone="warning">
              {t({
                tr: `${result.verificationSummary.possible} olası eşleşme`,
                en: `${result.verificationSummary.possible} possible ${result.verificationSummary.possible === 1 ? "match" : "matches"}`,
              })}
            </span>
            <span className="chip" data-tone="danger">
              {t({ tr: `${result.verificationSummary.notFound} bulunamadı`, en: `${result.verificationSummary.notFound} not found` })}
            </span>
          </div>

          {/* Kaç kaynağın ağ üzerinden doğrulandığı yazılıyor: "bulunamadı"
              ile "bakılmadı" aynı şey değil. Eskiden 25'i aşan liste
              hiç denetlenmiyordu; sonra biçim ve atıf eşleşmesi hepsinde
              çalışmaya başladı ama ağ doğrulaması ilk 25'te kalıyordu ve
              orada KALICI olarak kalıyordu — tekrar çalıştırmak aynı 25'i
              yeniden soruyordu.

              Artık bakılan künyeler önbelleğe giriyor ve sınır yalnızca
              bakılmamışlara harcanıyor; tekrar çalıştırmak sıradakileri
              kapatıyor. Bunu YAZMAK gerekiyor: kullanıcı bilmediği bir
              çözümü kendiliğinden denemez. */}
          {result.dogrulananSayisi < result.toplamKaynak ? (
            <div className="callout mt-md" data-tone="info">
              {t({
                tr: `Biçim ve atıf eşleşmesi ${result.toplamKaynak} kaynağın hepsinde çalıştı. Akademik veritabanı doğrulaması ${result.dogrulananSayisi} kaynak için yapıldı; kalan ${result.toplamKaynak - result.dogrulananSayisi} kaynağa bu turda bakılmadı (bulunamadı demek değil). `,
                en: `Format and citation matching ran on all ${result.toplamKaynak} sources. Academic database verification was done for ${result.dogrulananSayisi} sources; the remaining ${result.toplamKaynak - result.dogrulananSayisi} weren't checked this round (that doesn't mean they weren't found). `,
              })}
              <strong>{t({ tr: "Denetimi tekrar çalıştırdığınızda kalanlara bakılır", en: "Run the check again to cover the rest" })}</strong>
              {t({ tr: " — bakılmış kaynaklar yeniden sorulmuyor.", en: " — sources already checked aren't queried again." })}
            </div>
          ) : null}

          {/*
            ATIF–KAYNAKÇA UYUMU ÖNCE (26.10.2026): öğrencinin düzeltmesi en
            kolay ve en sık sorun bu; eskiden uzun künye listesinin
            altında kalıyor, görülmüyordu.

            Çapraz kontrol yalnızca ÖLÇÜLDÜYSE gösteriliyor. Metin
            girilmediğinde atıf çıkarılamıyor; o durumda iki başlık altına
            "Yok" yazmak, yapılmamış bir denetimi temiz rapor gibi
            göstermekti.
          */}
          {atifOlculdu && (
            <div className="result-block">
              <h3 className="result-heading">{t({ tr: "Atıf–kaynakça uyumu", en: "Citation–reference list consistency" })}</h3>
              {atifsizKaynak.length === 0 && kaynaksizAtif.length === 0 ? (
                <p className="tone-text" data-tone="success">{t({ tr: "Metindeki atıflarla kaynakça birbirini tutuyor.", en: "The in-text citations and the reference list match." })}</p>
              ) : (
                <ul className="result-list">
                  {atifsizKaynak.map((reference, index) => (
                    <li key={`k${index}`} className="tone-text" data-tone="warning">
                      {t({ tr: "Kaynakçada var, metinde atfı yok:", en: "In the reference list but not cited in the text:" })} {reference.raw}
                    </li>
                  ))}
                  {kaynaksizAtif.map((citation, index) => (
                    <li key={`a${index}`} className="tone-text" data-tone="danger">
                      {t({ tr: "Metinde atıf var, kaynakçada yok:", en: "Cited in the text but missing from the reference list:" })} {citation.raw}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/*
            KILAVUZ (TYK) ATIF KURALLARI: yılı olmayan atıf, yıl
            uyuşmazlığı, kılavuz örneğinin noktalaması. Örnek girilmemişse
            noktalama denetlenmediği SÖYLENİYOR: "sorun yok" sanılmasın.
          */}
          {result.tyk ? (
            <div className="result-block">
              <h3 className="result-heading">{t({ tr: "Kılavuz atıf kuralları", en: "Guideline citation rules" })}</h3>
              <p className="hint">
                {result.ornekAtif
                  ? t({
                      tr: `Kılavuz örneği: ${result.ornekAtif} — atıflar bu noktalamaya göre denetlendi.`,
                      en: `Guideline example: ${result.ornekAtif} — citations were checked against this punctuation.`,
                    })
                  : t({
                      tr: "Kılavuzunuzun örnek atıfını Kılavuz penceresine girerseniz noktalama (virgül, iki nokta, “s.”) da denetlenir.",
                      en: "If you enter your guideline's example citation in the Guideline window, punctuation (commas, colons, “p.”) is checked too.",
                    })}
              </p>
              {result.tyk.length === 0 ? (
                <p className="tone-text" data-tone="success">
                  {result.ornekAtif
                    ? t({
                        tr: "Yılı olmayan atıf ve yıl uyuşmazlığı yok; atıflar kılavuz örneğine uyuyor.",
                        en: "No citations without a year and no year mismatches; citations follow the guideline example.",
                      })
                    : t({
                        tr: "Yılı olmayan atıf ve yıl uyuşmazlığı yok.",
                        en: "No citations without a year and no year mismatches.",
                      })}
                </p>
              ) : (
                <ul className="result-list">
                  {result.tyk.map((bulgu, index) => (
                    <li key={`${bulgu.tur}-${index}`} className="tone-text" data-tone={bulgu.tur === "kalip" ? "warning" : "danger"}>
                      <b>{bulgu.atif}</b> — {bulgu.aciklama}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          {/*
            KÜNYE BAŞINA TEK KART. Eskiden aynı künye üç ayrı yerde
            yazılıyordu: doğrulama kartında, "APA 7 Biçim Sorunları"
            listesinde ve çapraz kontrol listelerinde. Uzun kaynakçada
            ekran aynı metni tekrar tekrar gösteren bir duvara dönüyordu.

            Liste artık KAYNAKÇAYI izliyor, doğrulama sonucunu değil:
            ağ sınırı yüzünden bu turda bakılmamış künyeler de kartını
            alıyor ve durumu kendi satırında yazıyor. Eskiden onların
            biçim sorunları ayrı bloktaydı, doğrulama durumu ise yalnızca
            toplamda görünüyordu.
          */}
          <div className="result-block">
            <h3 className="result-heading-lg">{t({ tr: "Kaynakça", en: "Reference list" })} ({result.references.length})</h3>
            <div>
              {result.references.map((reference, index) => {
                const dogrulama = dogrulamaHaritasi.get(reference.raw);
                const meta = dogrulama ? STATUS_META[dogrulama.status] : BAKILMADI;
                const eslesme = dogrulama?.bestMatch ?? null;
                return (
                  <article key={index} className="result-item" data-tone={meta.tone}>
                    <div className="project-card-main">
                      <div>
                        <div className="muted text-sm">{reference.raw}</div>

                        {eslesme ? (
                          <>
                            <div className="mt-sm"><strong>{eslesme.title}</strong></div>
                            <div className="hint">
                              {eslesme.authors.slice(0, 4).join(", ") || t({ tr: "Yazar bilgisi yok", en: "No author information" })}
                              {eslesme.year ? ` · ${eslesme.year}` : ""}
                              {eslesme.venue ? ` · ${eslesme.venue}` : ""}
                            </div>
                            <div className="cluster cluster-spaced text-sm">
                              {eslesme.url && (
                                <a href={eslesme.url} target="_blank" rel="noreferrer" className="link-accent">
                                  {eslesme.doi ? `DOI: ${eslesme.doi}` : t({ tr: "Akademik kaydı aç", en: "Open academic record" })}
                                </a>
                              )}
                              <span>
                                {eslesme.provider === "crossref" ? "Crossref" : "OpenAlex"}
                                {" · "}
                                {t({ tr: `eşleşme %${Math.round(eslesme.confidence * 100)}`, en: `${Math.round(eslesme.confidence * 100)}% match` })}
                              </span>
                              {eslesme.citedByCount !== null && (
                                <span>
                                  {t({ tr: `${eslesme.citedByCount} atıf`, en: `${eslesme.citedByCount} ${eslesme.citedByCount === 1 ? "citation" : "citations"}` })}
                                </span>
                              )}
                            </div>
                          </>
                        ) : dogrulama ? (
                          <div className="hint mt-sm">{t({ tr: "Crossref ve OpenAlex üzerinde yeterince güçlü bir eşleşme bulunamadı.", en: "No sufficiently strong match was found in Crossref or OpenAlex." })}</div>
                        ) : (
                          <div className="hint mt-sm">{t({ tr: "Ağ doğrulamasına bu turda sıra gelmedi; tekrar çalıştırın.", en: "Online verification didn't reach this one this round; run the check again." })}</div>
                        )}

                        {/* Biçim sorunları künyenin kendi kartında: ayrı
                            blokta iken kullanıcı hangi künyeye ait olduğunu
                            yukarı kaydırıp eşleştiriyordu. Sorun yoksa
                            hiçbir şey yazılmıyor — "sorun bulunamadı"
                            satırları listenin yarısını kaplıyordu. */}
                        {reference.issues.length > 0 && (
                          <ul className="result-list mt-sm">
                            {reference.issues.map((issue, issueIndex) => (
                              <li key={issueIndex} className="tone-text" data-tone={issue.severity === "error" ? "danger" : "warning"}>
                                {issue.message}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <span className="status-pill" data-tone={meta.tone}>{t(meta.label)}</span>
                    </div>

                    {dogrulama && (
                      <div className="cluster cluster-spaced mt-sm text-sm">
                        <a href={dogrulama.googleScholarUrl} target="_blank" rel="noreferrer" className="link-accent">
                          {t({ tr: "Google Scholar’da kontrol et ↗", en: "Check on Google Scholar ↗" })}
                        </a>
                        {dogrulama.status === "not_found" && !alternatif[reference.raw] && (
                          <button
                            type="button"
                            className="projects-filter-button button-compact"
                            onClick={() => alternatifAra(reference.raw, reference.title || reference.raw)}
                          >
                            {t({ tr: "Aynı konuda kaynak ara", en: "Search sources on the same topic" })}
                          </button>
                        )}
                      </div>
                    )}

                    {/*
                      Bulunanlar KÜNYENİN KARŞILIĞI DEĞİL, aynı konuda
                      gerçek kayıtlar. Bunu yazmak şart: aksi halde
                      öğrenci listedeki ilk çalışmayı kendi kaynağının
                      yerine koyabilir ve okumadığı bir şeye atıf yapmış
                      olur. Kayıtlar dizinden geliyor, asistandan değil —
                      uydurma künye riski yok.
                    */}
                    {alternatif[reference.raw] === "araniyor" && (
                      <p className="hint mt-sm">{t({ tr: "Dizinlerde aranıyor…", en: "Searching the indexes…" })}</p>
                    )}
                    {typeof alternatif[reference.raw] === "object" && (() => {
                      const bulunan = alternatif[reference.raw] as { kayitlar: AramaKaydi[]; hata?: string };
                      if (bulunan.hata) return <p className="tone-text mt-sm" data-tone="warning">{bulunan.hata}</p>;
                      if (!bulunan.kayitlar.length) {
                        return (
                          <p className="hint mt-sm">
                            {t({
                              tr: "Bu konuda da dizinlerde kayıt çıkmadı. Kaynağınız Türkçe bir tez ya da kurum raporuysa bu beklenen bir sonuçtur.",
                              en: "No records on this topic were found in the indexes either. If your source is a thesis or an institutional report, this is expected.",
                            })}
                          </p>
                        );
                      }
                      return (
                        <div className="mt-sm">
                          <p className="hint">
                            {t({ tr: "Aynı konuda dizinde bulunanlar — ", en: "Found in the indexes on the same topic — " })}
                            <strong>{t({ tr: "künyenizin karşılığı değil.", en: "not a match for your reference." })}</strong>{" "}
                            {t({
                              tr: "Kendi kaynağınızı siz doğrulayın; okumadığınız bir çalışmaya atıf yapmayın.",
                              en: "Verify your own source yourself; don't cite a work you haven't read.",
                            })}
                          </p>
                          <ul className="result-list">
                            {bulunan.kayitlar.map((kayit) => (
                              <li key={kayit.kimlik}>
                                <a href={kayit.acikErisimUrl ?? kayit.url} target="_blank" rel="noreferrer" className="link-accent">
                                  {kayit.baslik}
                                </a>
                                <span className="muted text-sm">
                                  {" · "}
                                  {kayit.yazarlar.slice(0, 2).join(", ") || t({ tr: "Yazar bilgisi yok", en: "No author information" })}
                                  {kayit.yil ? ` · ${kayit.yil}` : ""}
                                  {kayit.acikErisim ? t({ tr: " · açık erişim", en: " · open access" }) : ""}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })()}
                    {projectId ? (
                      <KaynakPdfSatiri
                        projectId={projectId}
                        kunye={reference.raw}
                        doi={eslesme?.doi ?? null}
                        satir={pdfler.get(kunyeAnahtari(reference.raw)) ?? null}
                        onGuncelle={(satir) => pdfGuncelle([satir])}
                      />
                    ) : null}
                  </article>
                );
              })}
            </div>
          </div>

          {gomulu ? null : asistanBolumu}
        </div>
      )}
    </>
  );

  return (
    <section className={gomulu ? "pencere-iki-kart" : "project-form-card mt-md"}>
      {gomulu ? null : (
        <div className="project-form-heading">
          <h2>{t({ tr: "Kaynakça ve Atıf Doğrulama", en: "Reference List and Citation Check" })}</h2>
          <p>
            {t({
              tr: "Kaynakları seçtiğiniz atıf stilinin kuralları, metin içi atıf eşleşmesi ve akademik kayıt varlığı açısından birlikte kontrol edin.",
              en: "Check your sources against your chosen citation style's rules, in-text citation matching and the existence of an academic record, all at once.",
            })}
          </p>
        </div>
      )}

      {gomulu ? (
        /*
          ÖĞRENCİ GÖZÜYLE TEK DÜĞME. Penceredeki öğrencinin sorusu "kaynakçam
          doğru mu?"; stil, metin ve kaynakça zaten çalışmasında duruyor.
          Eskiden aynı form burada da stil seçtiriyor, kaynakçayı
          yapıştırtıyor ve metin için ayrı bir onay kutusu soruyordu.
          Yapıştırma yolu kaynakçası editörde olmayan için duruyor.
        */
        <div className="pencere-sol">
          <div className="pencere-kart kaynakca-basit">
            <h3 className="pencere-kart-baslik">{t({ tr: "Denetim", en: "Check" })}</h3>
            <p className="hint">
              {t({
                tr: "Kaynakçanız ve metniniz editördeki son kaydedilmiş hâlinden alınır. Atıf stili: ",
                en: "Your reference list and text are taken from the last saved version in the editor. Citation style: ",
              })}
              <b>{STIL_SECENEKLERI.find((secenek) => secenek.deger === citationStyle)?.etiket ?? citationStyle}</b>
              {t({ tr: " (çalışma ayarlarından).", en: " (from the work's settings)." })}
            </p>
            <div className="pencere-dugmeler">
              <button type="button" className="projects-primary-button" onClick={() => void handleCheck(true)} disabled={loading}>
                {loading ? t({ tr: "Kaynaklar dizinlerde aranıyor…", en: "Searching the indexes for sources…" }) : t({ tr: "Kaynakçamı denetle", en: "Check my reference list" })}
              </button>
              {/* Literatür'deki "Manuel kaynak ekle" ile aynı: pencere içinde pencere. */}
              <PanelDrawer
                triggerLabel={t({ tr: "Manuel ekle", en: "Add manually" })}
                triggerIcon={<ClipboardPaste size={16} aria-hidden="true" />}
                triggerClassName="projects-filter-button"
                kicker={t({ tr: "Kaynakça", en: "Reference list" })}
                title={t({ tr: "Kaynakçanızı yapıştırın", en: "Paste your reference list" })}
                description={t({
                  tr: "Kaynakçanız editörde değilse buraya yapıştırın; her künye ayrı satırda olsun.",
                  en: "If your reference list isn't in the editor, paste it here; put each reference on its own line.",
                })}
                acik={yapistirAcik}
                onAcikDegis={setYapistirAcik}
                basaridaKapan={false}
              >
                <div className="project-form-grid">
                  <label className="project-form-full">
                    <span>{t({ tr: "Kaynakça listesi", en: "Reference list" })}</span>
                    <textarea
                      rows={10}
                      placeholder={t(KUNYE_ORNEGI)}
                      value={referenceList}
                      onChange={(e) => setReferenceList(e.target.value)}
                    />
                  </label>
                </div>
                <div className="project-form-actions">
                  <button
                    type="button"
                    className="projects-primary-button"
                    disabled={loading || !referenceList.trim()}
                    onClick={() => {
                      setYapistirAcik(false);
                      void handleCheck(false);
                    }}
                  >
                    {t({ tr: "Yapıştırdığımı denetle", en: "Check what I pasted" })}
                  </button>
                </div>
              </PanelDrawer>
            </div>

            {/*
              PDF KONTROLÜ: kaynakların uydurma olmadığını ve ulaşılabildiğini
              göstermek için her künyenin PDF'i. Özet satırı öğrencinin ne
              yapması gerektiğini sayıyla söylüyor.
            */}
            {result && projectId ? (
              <div className="pdf-kontrol">
                <button
                  type="button"
                  className="projects-filter-button"
                  disabled={pdfIlerleme !== null || loading}
                  onClick={() => void pdfleriBul()}
                >
                  <FileSearch size={16} aria-hidden="true" />
                  {pdfIlerleme
                    ? t({ tr: `PDF'ler aranıyor… ${pdfIlerleme.bitti}/${pdfIlerleme.toplam}`, en: `Searching for PDFs… ${pdfIlerleme.bitti}/${pdfIlerleme.toplam}` })
                    : t({ tr: "Kaynak PDF'lerini bul", en: "Find source PDFs" })}
                </button>
                <p className="hint">{pdfOzeti}</p>
              </div>
            ) : null}
          </div>

          {/*
            ASİSTAN YORUMU İKİNCİ KART (26.10.2026): eskiden sonuçların en
            altındaydı, uzun listede görünmüyordu. Yorum pencerede açılıyor;
            her bulgunun yanında "Yapılacaklara ekle". Bu çalışmanın kayıtlı
            yorumları altında: aynı soruyu ikinci kez sordurmamak için.
          */}
          <div className="pencere-kart">
            <h3 className="pencere-kart-baslik">{t({ tr: "Asistan yorumu", en: "Assistant interpretation" })}</h3>
            <p className="hint">
              {t({
                tr: "Dizinde bulunmayan her kayıt hata değildir; asistan gerçek şüpheyi ayırır, sorunları önceliklendirir ve atıf–kaynakça uyuşmazlıklarını birleştirir. Düzeltilmiş künye yazmaz.",
                en: "Not every record missing from the indexes is an error; the assistant separates real doubts, prioritizes issues and combines citation–reference list mismatches. It doesn't write corrected references.",
              })}
            </p>
            <div className="pencere-dugmeler">
              <button
                type="button"
                className="projects-primary-button"
                disabled={!result || !asistanAcik || bekleniyor}
                onClick={() => {
                  setGecmisGoster(null);
                  setYorumAcik(true);
                  yorumlat(false);
                }}
              >
                <Sparkles size={16} aria-hidden="true" /> {bekleniyor ? t({ tr: "Yorumlanıyor…", en: "Interpreting…" }) : t({ tr: "Kaynakçayı yorumlat", en: "Interpret reference list" })}
              </button>
            </div>
            {!result ? <p className="muted text-sm">{t({ tr: "Önce kaynakçanızı denetleyin; asistan denetim sonucunu yorumlar.", en: "Check your reference list first; the assistant interprets the check result." })}</p> : null}
            {!asistanAcik ? (
              <p className="asistan-uyari" data-tone="neutral">
                {t(ASISTAN_KAPALI)}
              </p>
            ) : null}

            {asistanGecmisi.length ? (
              <>
                <h4 className="pencere-alt-baslik">
                  <History size={14} aria-hidden="true" /> {t({ tr: "Geçmiş sorgular", en: "Past queries" })}
                </h4>
                <ul className="secim-listesi">
                  {asistanGecmisi.map((kayit) => (
                    <li key={kayit.id}>
                      <button
                        type="button"
                        className="secim-satir"
                        onClick={() => {
                          setGecmisGoster(kayit);
                          setYorumAcik(true);
                        }}
                      >
                        <span className="kanit-kayit-govde">
                          <b>{tarihSaat(kayit.created_at)}</b>
                          <small>{t({ tr: `${kayit.bulgular.length} bulgu`, en: `${kayit.bulgular.length} ${kayit.bulgular.length === 1 ? "finding" : "findings"}` })}</small>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>

          <PanelDrawer
            tetiksiz
            triggerLabel={t({ tr: "Kaynakça yorumu", en: "Reference list interpretation" })}
            acik={yorumAcik}
            onAcikDegis={setYorumAcik}
            boy="genis"
            kicker={t({ tr: "Asistan", en: "Assistant" })}
            title={
              gecmisGoster
                ? `${t({ tr: "Kaynakça yorumu", en: "Reference list interpretation" })} · ${tarihSaat(gecmisGoster.created_at)}`
                : t({ tr: "Kaynakça yorumu", en: "Reference list interpretation" })
            }
            description={t({
              tr: "Bulgular denetim sonucunun yorumudur, nihai hüküm değildir. Düzeltmek istediğinizi yapılacaklarınıza ekleyin.",
              en: "The findings interpret the check result; they aren't a final verdict. Add what you want to fix to your to-do list.",
            })}
            basaridaKapan={false}
          >
            {!gecmisGoster && bekleniyor && !denetim ? (
              <p className="gb-bos">{t({ tr: "Asistan denetim sonucunuzu okuyor…", en: "The assistant is reading your check result…" })}</p>
            ) : null}
            <AsistanSonuc
              sonuc={
                gecmisGoster
                  ? { bulgular: gecmisGoster.bulgular, kayitId: gecmisGoster.id }
                  : denetim
              }
              yetenek="kaynakca"
              etiketler={etiketler}
              bulguBasligi={t({ tr: "Asistan bulguları", en: "Assistant findings" })}
              bekleniyor={bekleniyor}
              onYenidenSorgula={gecmisGoster ? undefined : () => yorumlat(true)}
              gecmisGizli
              bulguEylemi={
                projectId
                  ? (bulgu) => (
                      <YapilacagaEkle
                        projectId={projectId}
                        baslik={bulgu.baslik}
                        aciklama={bulgu.aciklama}
                        asistanKaydi={gecmisGoster ? gecmisGoster.id : (denetim?.kayitId ?? null)}
                      />
                    )
                  : undefined
              }
            />
          </PanelDrawer>
        </div>
      ) : (
        <>
        <div className="callout mb-md" data-tone="info">
          {t({
            tr: "Bibliyografik bilgiler Crossref ve OpenAlex üzerinden doğrulanır. Her sonuçta ayrıca Google Scholar’da aynı kaynağı açan bağımsız arama bağlantısı verilir. Biçim ve atıf eşleşmesi kaynakçanın tamamında çalışır; akademik veritabanı doğrulaması ilk 25 kaynakla sınırlıdır.",
            en: "Bibliographic details are verified via Crossref and OpenAlex. Each result also includes an independent search link that opens the same source on Google Scholar. Format and citation matching run on the whole reference list; academic database verification is limited to the first 25 sources.",
          })}
        </div>

        <div className="project-form-grid">
          {projects.length > 0 ? (
            <label>
              <span>{t({ tr: "Bağlı çalışma (opsiyonel)", en: "Linked work (optional)" })}</span>
              <select
                value={projectId}
                onChange={(e) => {
                  setProjectId(e.target.value);
                  /* Çalışma değişti: önceki müsveddenin kelime sayısı artık
                     başka bir çalışmayı anlatıyor olurdu. */
                  setCalismaMetniniKullan(false);
                  setMetinOzeti(null);
                  /* Stil çalışmanın kaydında zaten var; kullanıcıya iki
                     kez sormak, ikisinin ayrışmasına davetiye. Seçim yine
                     de elle değiştirilebiliyor. */
                  const secilen = projects.find((p) => p.id === e.target.value);
                  if (secilen?.citation_style) setCitationStyle(secilen.citation_style);
                }}
              >
                <option value="">{t({ tr: "Seçili çalışma yok", en: "No work selected" })}</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </label>
          ) : (
            <label>
              <span>{t({ tr: "Çalışma başlığı (opsiyonel etiket)", en: "Work title (optional label)" })}</span>
              <input
                type="text"
                placeholder={t({ tr: "Örn. Eğitim Bilimleri Yüksek Lisans Tezi", en: "E.g. Master's Thesis in Educational Sciences" })}
                value={projectTitle}
                onChange={(e) => setProjectTitle(e.target.value)}
              />
            </label>
          )}

          <label>
            <span>{t({ tr: "Atıf stili", en: "Citation style" })}</span>
            <select value={citationStyle} onChange={(e) => setCitationStyle(e.target.value)}>
              {STIL_SECENEKLERI.map((secenek) => (
                <option key={secenek.deger} value={secenek.deger}>{secenek.etiket}</option>
              ))}
            </select>
          </label>

          <label className="project-form-full">
            <span>{t({ tr: "Kaynakça listesi", en: "Reference list" })}</span>
            <textarea
              rows={8}
              placeholder={t(KUNYE_ORNEGI)}
              value={referenceList}
              onChange={(e) => setReferenceList(e.target.value)}
            />
          </label>

          <div className="project-form-full field-group">
            <span className="field-title">{t({ tr: "Metin (metin içi atıf kontrolü için, opsiyonel)", en: "Text (for the in-text citation check, optional)" })}</span>
            <p className="hint">
              {t({
                tr: "Metin verilmezse çapraz kontrol YAPILMAZ: hangi kaynağa metinde atıf yapılmadığı ve hangi atfın kaynakçada karşılığı olmadığı ölçülemez. Denetimin elle yapılması en zor yarısı budur.",
                en: "Without text, the cross-check is NOT run: it can't tell which sources aren't cited in the text or which citations have no entry in the reference list. That's the hardest half of the check to do by hand.",
              })}
            </p>

            {projectId ? (
              <label className="cluster mt-sm">
                <input
                  type="checkbox"
                  checked={calismaMetniniKullan}
                  onChange={(e) => void metniKullan(e.target.checked)}
                />
                <span>{t({ tr: "Bu çalışmanın metnini kullan", en: "Use this work's text" })}</span>
              </label>
            ) : null}

            {calismaMetniniKullan ? (
              ozetBekleniyor ? (
                <p className="hint" aria-busy="true">{t({ tr: "Çalışmanın metni ölçülüyor…", en: "Measuring the work's text…" })}</p>
              ) : metinOzeti?.okunamadi ? (
                <p className="alert mt-sm" data-tone="warning" role="alert">
                  {t({
                    tr: "Çalışmanın metni ölçülemedi. Metin olmadığı anlamına gelmez; denetimi çalıştırabilirsiniz ama metin yine okunamazsa denetim yapılmadan durur.",
                    en: "The work's text couldn't be measured. That doesn't mean there's no text; you can run the check, but if the text still can't be read the check stops without running.",
                  })}
                </p>
              ) : metinOzeti && metinOzeti.kelime === 0 ? (
                <p className="alert mt-sm" data-tone="warning">
                  {t({
                    tr: "Bu çalışmada henüz yazılmış metin yok. Yazım ekranından metni girin ya da aşağıya yapıştırın.",
                    en: "This work has no text yet. Write it in the editor or paste it below.",
                  })}
                </p>
              ) : metinOzeti ? (
                <p className="hint">
                  {t({
                    tr: `${metinOzeti.kelime.toLocaleString(YEREL.tr)} kelimelik müsvedde denetlenecek. Metin sunucuda okunur; buraya kopyalamanız gerekmez.`,
                    en: `A ${metinOzeti.kelime.toLocaleString(YEREL.en)}-word draft will be checked. The text is read on the server; you don't need to copy it here.`,
                  })}
                </p>
              ) : null
            ) : (
              <textarea
                className="mt-sm"
                rows={6}
                placeholder={t({ tr: "...önceki çalışmalarda (Yılmaz, 2020) belirtildiği gibi...", en: "...as noted in previous studies (Smith, 2020)..." })}
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
              />
            )}
          </div>
        </div>

        <div className="project-form-actions">
          <button
            type="button"
            className="projects-primary-button"
            onClick={() => void handleCheck()}
            disabled={loading || !referenceList.trim()}
          >
            {loading ? t({ tr: "Crossref, OpenAlex ve Scholar kontrol ediliyor...", en: "Checking Crossref, OpenAlex and Scholar..." }) : t({ tr: "Kaynakları Doğrula ve Kaydet", en: "Verify and Save Sources" })}
          </button>
        </div>

        </>
      )}

      {gomulu ? (
        <div className="pencere-kart pencere-sonuc" aria-live="polite">
          <h3 className="pencere-kart-baslik">{t({ tr: "Sonuç", en: "Result" })}</h3>
          {kayitliTarih && result && !loading ? (
            <p className="hint">
              {t({
                tr: `${tarihSaat(kayitliTarih)} tarihli son denetiminiz. Metninizi ya da kaynakçanızı değiştirdiyseniz yeniden denetleyin.`,
                en: `Your last check from ${tarihSaat(kayitliTarih)}. If you've changed your text or reference list, check again.`,
              })}
            </p>
          ) : null}
          {!error && !result ? (
            <p className="gb-bos">
              {loading
                ? t({ tr: "Kaynaklar dizinlerde aranıyor…", en: "Searching the indexes for sources…" })
                : t({ tr: "Soldan denetimi başlatın; her kaynağın durumu burada görünür.", en: "Start the check on the left; each source's status will appear here." })}
            </p>
          ) : null}
          {sonucIcerik}
        </div>
      ) : (
        sonucIcerik
      )}
    </section>
  );
}
