"use client";

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
import { trTarihSaat } from "@/lib/tr-time";

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

const STATUS_META: Record<AcademicVerification["status"], { label: string; tone: Tone }> = {
  verified: { label: "Doğrulandı", tone: "success" },
  possible_match: { label: "Olası eşleşme", tone: "warning" },
  not_found: { label: "Kayıt bulunamadı", tone: "danger" },
  insufficient_data: { label: "Yetersiz veri", tone: "neutral" },
};

/* Bu turda ağ doğrulamasına sıra gelmemiş künye. "Bulunamadı" DEĞİL. */
const BAKILMADI = { label: "Bu turda bakılmadı", tone: "neutral" as Tone };

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
        await kaynakcaDenetle({
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
        }),
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
      showToast("success", "Bakılacak yeni kaynak yok; PDF'i olanlar hazır.");
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
      setError("Akademik veri kaynaklarına erişilirken bir hata oluştu. Lütfen yeniden deneyin.");
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
        `${pdfSay("indirildi", "yuklendi")}/${pdfDurumlari.length} kaynağın PDF'i hazır`,
        pdfSay("bulunamadi", "erisilemedi") ? `${pdfSay("bulunamadi", "erisilemedi")} kaynağın PDF'ini siz yükleyin` : "",
        pdfSay("kayit_yok") ? `${pdfSay("kayit_yok")} künye dizinde yok` : "",
      ]
        .filter(Boolean)
        .join(" · ")
    : "Açık erişimli PDF'ler bulunup indirilir; ücretli kaynakların PDF'ini kendiniz yüklersiniz.";

  /* Sayfada sonuçların altında; pencerede sol sütunun ikinci kartı. */
  const asistanBolumu = result ? (
    <div className="asistan-kart">
      <div className="asistan-kart-ust">
        <h3>Asistan yorumlasın</h3>
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
      </div>

      <div className="project-form-actions mt-sm">
        <button
          type="button"
          className="projects-primary-button"
          disabled={!asistanAcik || bekleniyor}
          onClick={() => yorumlat(false)}
        >
          {bekleniyor ? "Denetleniyor…" : "Kaynakçayı Yorumlat"}
        </button>
      </div>

      {!asistanAcik && (
        <p className="asistan-uyari" data-tone="neutral">
          Asistan bu kurulumda kapalı; yöneticinizin yapay zeka anahtarını tanımlaması gerekiyor.
        </p>
      )}

      <AsistanSonuc
        sonuc={denetim}
        yetenek="kaynakca"
        etiketler={{ uyari: "Sorun", oneri: "Öneri", bilgi: "Not" }}
        bulguBasligi="Asistan bulguları"
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
              {result.stil.ad} uyumu: {result.complianceScore}/100
            </strong>
            <span className="chip" data-tone="success">
              {result.verificationSummary.verified} doğrulandı
            </span>
            <span className="chip" data-tone="warning">
              {result.verificationSummary.possible} olası eşleşme
            </span>
            <span className="chip" data-tone="danger">
              {result.verificationSummary.notFound} bulunamadı
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
              Biçim ve atıf eşleşmesi {result.toplamKaynak} kaynağın hepsinde çalıştı.
              Akademik veritabanı doğrulaması {result.dogrulananSayisi} kaynak için
              yapıldı; kalan {result.toplamKaynak - result.dogrulananSayisi} kaynağa
              bu turda bakılmadı (bulunamadı demek değil).{" "}
              <strong>Denetimi tekrar çalıştırdığınızda kalanlara bakılır</strong> —
              bakılmış kaynaklar yeniden sorulmuyor.
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
              <h3 className="result-heading">Atıf–kaynakça uyumu</h3>
              {atifsizKaynak.length === 0 && kaynaksizAtif.length === 0 ? (
                <p className="tone-text" data-tone="success">Metindeki atıflarla kaynakça birbirini tutuyor.</p>
              ) : (
                <ul className="result-list">
                  {atifsizKaynak.map((reference, index) => (
                    <li key={`k${index}`} className="tone-text" data-tone="warning">
                      Kaynakçada var, metinde atfı yok: {reference.raw}
                    </li>
                  ))}
                  {kaynaksizAtif.map((citation, index) => (
                    <li key={`a${index}`} className="tone-text" data-tone="danger">
                      Metinde atıf var, kaynakçada yok: {citation.raw}
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
              <h3 className="result-heading">Kılavuz atıf kuralları</h3>
              <p className="hint">
                {result.ornekAtif
                  ? `Kılavuz örneği: ${result.ornekAtif} — atıflar bu noktalamaya göre denetlendi.`
                  : "Kılavuzunuzun örnek atıfını Kılavuz penceresine girerseniz noktalama (virgül, iki nokta, “s.”) da denetlenir."}
              </p>
              {result.tyk.length === 0 ? (
                <p className="tone-text" data-tone="success">
                  Yılı olmayan atıf ve yıl uyuşmazlığı yok{result.ornekAtif ? "; atıflar kılavuz örneğine uyuyor" : ""}.
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
            <h3 className="result-heading-lg">Kaynakça ({result.references.length})</h3>
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
                              {eslesme.authors.slice(0, 4).join(", ") || "Yazar bilgisi yok"}
                              {eslesme.year ? ` · ${eslesme.year}` : ""}
                              {eslesme.venue ? ` · ${eslesme.venue}` : ""}
                            </div>
                            <div className="cluster cluster-spaced text-sm">
                              {eslesme.url && (
                                <a href={eslesme.url} target="_blank" rel="noreferrer" className="link-accent">
                                  {eslesme.doi ? `DOI: ${eslesme.doi}` : "Akademik kaydı aç"}
                                </a>
                              )}
                              <span>
                                {eslesme.provider === "crossref" ? "Crossref" : "OpenAlex"}
                                {" · "}eşleşme %{Math.round(eslesme.confidence * 100)}
                              </span>
                              {eslesme.citedByCount !== null && <span>{eslesme.citedByCount} atıf</span>}
                            </div>
                          </>
                        ) : dogrulama ? (
                          <div className="hint mt-sm">Crossref ve OpenAlex üzerinde yeterince güçlü bir eşleşme bulunamadı.</div>
                        ) : (
                          <div className="hint mt-sm">Ağ doğrulamasına bu turda sıra gelmedi; tekrar çalıştırın.</div>
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
                      <span className="status-pill" data-tone={meta.tone}>{meta.label}</span>
                    </div>

                    {dogrulama && (
                      <div className="cluster cluster-spaced mt-sm text-sm">
                        <a href={dogrulama.googleScholarUrl} target="_blank" rel="noreferrer" className="link-accent">
                          Google Scholar’da kontrol et ↗
                        </a>
                        {dogrulama.status === "not_found" && !alternatif[reference.raw] && (
                          <button
                            type="button"
                            className="projects-filter-button button-compact"
                            onClick={() => alternatifAra(reference.raw, reference.title || reference.raw)}
                          >
                            Aynı konuda kaynak ara
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
                      <p className="hint mt-sm">Dizinlerde aranıyor…</p>
                    )}
                    {typeof alternatif[reference.raw] === "object" && (() => {
                      const bulunan = alternatif[reference.raw] as { kayitlar: AramaKaydi[]; hata?: string };
                      if (bulunan.hata) return <p className="tone-text mt-sm" data-tone="warning">{bulunan.hata}</p>;
                      if (!bulunan.kayitlar.length) {
                        return (
                          <p className="hint mt-sm">
                            Bu konuda da dizinlerde kayıt çıkmadı. Kaynağınız Türkçe bir tez ya da kurum
                            raporuysa bu beklenen bir sonuçtur.
                          </p>
                        );
                      }
                      return (
                        <div className="mt-sm">
                          <p className="hint">
                            Aynı konuda dizinde bulunanlar — <strong>künyenizin karşılığı değil.</strong>{" "}
                            Kendi kaynağınızı siz doğrulayın; okumadığınız bir çalışmaya atıf yapmayın.
                          </p>
                          <ul className="result-list">
                            {bulunan.kayitlar.map((kayit) => (
                              <li key={kayit.kimlik}>
                                <a href={kayit.acikErisimUrl ?? kayit.url} target="_blank" rel="noreferrer" className="link-accent">
                                  {kayit.baslik}
                                </a>
                                <span className="muted text-sm">
                                  {" · "}
                                  {kayit.yazarlar.slice(0, 2).join(", ") || "Yazar bilgisi yok"}
                                  {kayit.yil ? ` · ${kayit.yil}` : ""}
                                  {kayit.acikErisim ? " · açık erişim" : ""}
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
          <h2>Kaynakça ve Atıf Doğrulama</h2>
          <p>
            Kaynakları seçtiğiniz atıf stilinin kuralları, metin içi atıf eşleşmesi ve
            akademik kayıt varlığı açısından birlikte kontrol edin.
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
            <h3 className="pencere-kart-baslik">Denetim</h3>
            <p className="hint">
              Kaynakçanız ve metniniz editördeki son kaydedilmiş hâlinden alınır. Atıf stili:{" "}
              <b>{STIL_SECENEKLERI.find((secenek) => secenek.deger === citationStyle)?.etiket ?? citationStyle}</b> (çalışma ayarlarından).
            </p>
            <div className="pencere-dugmeler">
              <button type="button" className="projects-primary-button" onClick={() => void handleCheck(true)} disabled={loading}>
                {loading ? "Kaynaklar dizinlerde aranıyor…" : "Kaynakçamı denetle"}
              </button>
              {/* Literatür'deki "Manuel kaynak ekle" ile aynı: pencere içinde pencere. */}
              <PanelDrawer
                triggerLabel="Manuel ekle"
                triggerIcon={<ClipboardPaste size={16} aria-hidden="true" />}
                triggerClassName="projects-filter-button"
                kicker="Kaynakça"
                title="Kaynakçanızı yapıştırın"
                description="Kaynakçanız editörde değilse buraya yapıştırın; her künye ayrı satırda olsun."
                acik={yapistirAcik}
                onAcikDegis={setYapistirAcik}
                basaridaKapan={false}
              >
                <div className="project-form-grid">
                  <label className="project-form-full">
                    <span>Kaynakça listesi</span>
                    <textarea
                      rows={10}
                      placeholder={"Yılmaz, A. (2020). Örnek makale başlığı. Dergi Adı, 12(3), 45-60. https://doi.org/..."}
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
                    Yapıştırdığımı denetle
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
                  {pdfIlerleme ? `PDF'ler aranıyor… ${pdfIlerleme.bitti}/${pdfIlerleme.toplam}` : "Kaynak PDF'lerini bul"}
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
            <h3 className="pencere-kart-baslik">Asistan yorumu</h3>
            <p className="hint">
              Dizinde bulunmayan her kayıt hata değildir; asistan gerçek şüpheyi ayırır, sorunları önceliklendirir ve
              atıf–kaynakça uyuşmazlıklarını birleştirir. Düzeltilmiş künye yazmaz.
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
                <Sparkles size={16} aria-hidden="true" /> {bekleniyor ? "Yorumlanıyor…" : "Kaynakçayı yorumlat"}
              </button>
            </div>
            {!result ? <p className="muted text-sm">Önce kaynakçanızı denetleyin; asistan denetim sonucunu yorumlar.</p> : null}
            {!asistanAcik ? (
              <p className="asistan-uyari" data-tone="neutral">
                Asistan bu kurulumda kapalı; yöneticinizin yapay zeka anahtarını tanımlaması gerekiyor.
              </p>
            ) : null}

            {asistanGecmisi.length ? (
              <>
                <h4 className="pencere-alt-baslik">
                  <History size={14} aria-hidden="true" /> Geçmiş sorgular
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
                          <b>{trTarihSaat(kayit.created_at)}</b>
                          <small>{kayit.bulgular.length} bulgu</small>
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
            triggerLabel="Kaynakça yorumu"
            acik={yorumAcik}
            onAcikDegis={setYorumAcik}
            boy="genis"
            kicker="Asistan"
            title={gecmisGoster ? `Kaynakça yorumu · ${trTarihSaat(gecmisGoster.created_at)}` : "Kaynakça yorumu"}
            description="Bulgular denetim sonucunun yorumudur, nihai hüküm değildir. Düzeltmek istediğinizi yapılacaklarınıza ekleyin."
            basaridaKapan={false}
          >
            {!gecmisGoster && bekleniyor && !denetim ? (
              <p className="gb-bos">Asistan denetim sonucunuzu okuyor…</p>
            ) : null}
            <AsistanSonuc
              sonuc={
                gecmisGoster
                  ? { bulgular: gecmisGoster.bulgular, kayitId: gecmisGoster.id }
                  : denetim
              }
              yetenek="kaynakca"
              etiketler={{ uyari: "Sorun", oneri: "Öneri", bilgi: "Not" }}
              bulguBasligi="Asistan bulguları"
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
          Bibliyografik bilgiler Crossref ve OpenAlex üzerinden doğrulanır. Her sonuçta
          ayrıca Google Scholar’da aynı kaynağı açan bağımsız arama bağlantısı verilir.
          Biçim ve atıf eşleşmesi kaynakçanın tamamında çalışır; akademik veritabanı
          doğrulaması ilk 25 kaynakla sınırlıdır.
        </div>

        <div className="project-form-grid">
          {projects.length > 0 ? (
            <label>
              <span>Bağlı çalışma (opsiyonel)</span>
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
                <option value="">Seçili çalışma yok</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </label>
          ) : (
            <label>
              <span>Çalışma başlığı (opsiyonel etiket)</span>
              <input
                type="text"
                placeholder="Örn. Eğitim Bilimleri Yüksek Lisans Tezi"
                value={projectTitle}
                onChange={(e) => setProjectTitle(e.target.value)}
              />
            </label>
          )}

          <label>
            <span>Atıf stili</span>
            <select value={citationStyle} onChange={(e) => setCitationStyle(e.target.value)}>
              {STIL_SECENEKLERI.map((secenek) => (
                <option key={secenek.deger} value={secenek.deger}>{secenek.etiket}</option>
              ))}
            </select>
          </label>

          <label className="project-form-full">
            <span>Kaynakça listesi</span>
            <textarea
              rows={8}
              placeholder={"Yılmaz, A. (2020). Örnek makale başlığı. Dergi Adı, 12(3), 45-60. https://doi.org/..."}
              value={referenceList}
              onChange={(e) => setReferenceList(e.target.value)}
            />
          </label>

          <div className="project-form-full field-group">
            <span className="field-title">Metin (metin içi atıf kontrolü için, opsiyonel)</span>
            <p className="hint">
              Metin verilmezse çapraz kontrol YAPILMAZ: hangi kaynağa metinde
              atıf yapılmadığı ve hangi atfın kaynakçada karşılığı olmadığı
              ölçülemez. Denetimin elle yapılması en zor yarısı budur.
            </p>

            {projectId ? (
              <label className="cluster mt-sm">
                <input
                  type="checkbox"
                  checked={calismaMetniniKullan}
                  onChange={(e) => void metniKullan(e.target.checked)}
                />
                <span>Bu çalışmanın metnini kullan</span>
              </label>
            ) : null}

            {calismaMetniniKullan ? (
              ozetBekleniyor ? (
                <p className="hint" aria-busy="true">Çalışmanın metni ölçülüyor…</p>
              ) : metinOzeti?.okunamadi ? (
                <p className="alert mt-sm" data-tone="warning" role="alert">
                  Çalışmanın metni ölçülemedi. Metin olmadığı anlamına gelmez;
                  denetimi çalıştırabilirsiniz ama metin yine okunamazsa denetim
                  yapılmadan durur.
                </p>
              ) : metinOzeti && metinOzeti.kelime === 0 ? (
                <p className="alert mt-sm" data-tone="warning">
                  Bu çalışmada henüz yazılmış metin yok. Yazım ekranından metni
                  girin ya da aşağıya yapıştırın.
                </p>
              ) : metinOzeti ? (
                <p className="hint">
                  {metinOzeti.kelime.toLocaleString("tr-TR")} kelimelik müsvedde
                  denetlenecek. Metin sunucuda okunur; buraya kopyalamanız
                  gerekmez.
                </p>
              ) : null
            ) : (
              <textarea
                className="mt-sm"
                rows={6}
                placeholder="...önceki çalışmalarda (Yılmaz, 2020) belirtildiği gibi..."
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
            {loading ? "Crossref, OpenAlex ve Scholar kontrol ediliyor..." : "Kaynakları Doğrula ve Kaydet"}
          </button>
        </div>

        </>
      )}

      {gomulu ? (
        <div className="pencere-kart pencere-sonuc" aria-live="polite">
          <h3 className="pencere-kart-baslik">Sonuç</h3>
          {kayitliTarih && result && !loading ? (
            <p className="hint">
              {trTarihSaat(kayitliTarih)} tarihli son denetiminiz. Metninizi ya da kaynakçanızı değiştirdiyseniz yeniden
              denetleyin.
            </p>
          ) : null}
          {!error && !result ? (
            <p className="gb-bos">
              {loading ? "Kaynaklar dizinlerde aranıyor…" : "Soldan denetimi başlatın; her kaynağın durumu burada görünür."}
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
