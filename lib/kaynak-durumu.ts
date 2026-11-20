import type { Metin } from "./dil";

/*
  KAYNAĞIN ÜÇ DURUMU — KAYIT, PDF, ALINTI (20.11.2026, M9).

  Atıf kartı, editörün Kaynaklar aracı ve Kaynaklar sayfası aynı kaynağın
  durumunu ayrı ayrı yazıyordu ve her biri kendi kuralını kuruyordu:
  kartta DOI'si tutan bağlanmamış bir PDF "Açılabilir" diye yeşil
  görünüyor, Kaynaklar aracında aynı DOI'ye iki PDF düşünce kaynak
  "PDF yok" görünüyordu (hangisi olduğu belli olmadığı için sessizce
  eleniyordu). Kural tek yerde: bu dosya saf, testli
  (tests/unit/kaynak-durumu.test.ts) ve üç ekran da buradan okur.

  Üç durum birbirinin yerine GEÇMEZ (lib/kanit/durum.ts ile aynı ilke).
  İlki "Künye" diye adlandırılır, "Kayıt" değil: PDF çekmecesindeki "Kayıt"
  işareti PDF'in kaynak KAYDINA bağlı olup olmadığını söylüyor (bu dosyada
  PDF durumunun "bağlı" hâli); aynı sözcük iki ayrı denetime verilmesin.
    Künye  — künye dizinde (Crossref/OpenAlex) doğrulandı mı, kaynakça
             için eksik alanı var mı.
    PDF    — bu kaynağa AÇIKÇA bağlı bir dosya var mı. Yalnızca DOI'si
             tutan bağlanmamış dosya "eşleşti" diye ayrı yazılır, onay
             tonunda değil: öğrenci bağlamadan o dosyanın o kaynak
             olduğunu kimse doğrulamadı. Aynı DOI'de birden çok dosya
             BELİRSİZ'dir ve öyle söylenir, gizlenmez.
    Alıntı — PDF metnine karşı birebir doğrulanmış pasaj var mı.
  Hiçbiri iddianın desteklendiği anlamına gelmez; tek bir "doğrulandı"
  ya da yüzde yok.
*/

export type KaynakPdfi = { id: string; doi: string | null; kaynakId?: string | null };

export type PdfEslesmesi =
  | { tur: "bagli"; pdf: KaynakPdfi }
  | { tur: "doi"; pdf: KaynakPdfi }
  | { tur: "belirsiz"; adaylar: KaynakPdfi[] }
  | { tur: "yok" };

export const doiAnahtari = (deger: string | null | undefined) =>
  (deger ?? "")
    .toLowerCase()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//, "")
    .replace(/^doi:\s*/, "")
    .trim();

/** Kaynağın PDF'i: önce açık bağ, sonra TEK DOI eşleşmesi; birden çoksa belirsiz. */
export function pdfEslesmesi(kaynak: { id: string; doi_or_url: string | null }, pdfler: KaynakPdfi[]): PdfEslesmesi {
  const bagli = pdfler.find((p) => p.kaynakId === kaynak.id);
  if (bagli) return { tur: "bagli", pdf: bagli };
  const doi = doiAnahtari(kaynak.doi_or_url);
  if (!doi.startsWith("10.")) return { tur: "yok" };
  const adaylar = pdfler.filter((p) => !p.kaynakId && doiAnahtari(p.doi) === doi);
  if (adaylar.length === 1) return { tur: "doi", pdf: adaylar[0] };
  return adaylar.length ? { tur: "belirsiz", adaylar } : { tur: "yok" };
}

/** Açılacak tek dosya: bağlı ya da tek DOI eşleşmesi. Belirsizde AÇILMAZ (yanlış makaleyi göstermek en kötüsü). */
export const acilacakPdf = (e: PdfEslesmesi): KaynakPdfi | null => (e.tur === "bagli" || e.tur === "doi" ? e.pdf : null);

export type KunyeHali = "dogrulandi" | "kismen" | "uyusmuyor" | "dogrulanamadi";
export type DurumTonu = "tamam" | "uyari" | "notr";
export type DurumSatiri = { anahtar: "kayit" | "pdf" | "alinti"; ad: Metin; ton: DurumTonu; kisa: Metin; aciklama: Metin };

const KUNYE: Record<KunyeHali, { ton: DurumTonu; kisa: Metin; aciklama: Metin }> = {
  dogrulandi: {
    ton: "tamam",
    kisa: { tr: "Künye doğrulandı", en: "Reference verified" },
    aciklama: { tr: "Başlık, yazar ve yıl dizindeki kayıtla eşleşti.", en: "Title, authors and year matched the index record." },
  },
  kismen: {
    ton: "uyari",
    kisa: { tr: "Künye kısmen eşleşti", en: "Reference partly matched" },
    aciklama: { tr: "Dizindeki kayıtla bazı alanlar uyuşmuyor; künyeyi kontrol edin.", en: "Some fields differ from the index record; check the reference." },
  },
  uyusmuyor: {
    ton: "uyari",
    kisa: { tr: "Künye uyuşmuyor", en: "Reference mismatch" },
    aciklama: { tr: "Dizindeki kayıt bu künyeyle uyuşmuyor.", en: "The index record doesn't match this reference." },
  },
  dogrulanamadi: {
    ton: "uyari",
    kisa: { tr: "Künye doğrulanamadı", en: "Reference not verified" },
    aciklama: { tr: "Dizinlerde bu künyeye ait bir kayıt bulunamadı.", en: "No record for this reference was found in the indexes." },
  },
};

export function kaynakDurumlari(g: {
  kunye: { durum: KunyeHali; dizin?: "crossref" | "openalex" | null } | null;
  eksikAlanlar?: string[];
  pdf: PdfEslesmesi;
  alintiSayfasi?: number | null;
}): DurumSatiri[] {
  const eksik = g.eksikAlanlar ?? [];
  const k = g.kunye ? KUNYE[g.kunye.durum] : null;
  const dizin = g.kunye?.dizin === "crossref" ? "Crossref" : g.kunye?.dizin === "openalex" ? "OpenAlex" : null;
  const kayit: DurumSatiri = k
    ? {
        anahtar: "kayit",
        ad: { tr: "Künye", en: "Reference" },
        // Eksik alan, dizinde doğrulanmış bir künyeyi bile kaynakçada eksik bırakır: onay tonu verilmez.
        ton: eksik.length && k.ton === "tamam" ? "uyari" : k.ton,
        kisa: k.kisa,
        aciklama: {
          tr: `${k.aciklama.tr}${dizin ? ` (${dizin})` : ""}${eksik.length ? ` Kaynakça için eksik: ${eksik.join(", ")}.` : ""}`,
          en: `${k.aciklama.en}${dizin ? ` (${dizin})` : ""}${eksik.length ? ` Missing for the reference list: ${eksik.join(", ")}.` : ""}`,
        },
      }
    : {
        anahtar: "kayit",
        ad: { tr: "Künye", en: "Reference" },
        ton: eksik.length ? "uyari" : "notr",
        kisa: eksik.length ? { tr: "Künye eksik", en: "Reference incomplete" } : { tr: "Künye denetlenmedi", en: "Reference not checked" },
        aciklama: eksik.length
          ? { tr: `Kaynakça için eksik: ${eksik.join(", ")}. Dizin denetimi yapılmadı.`, en: `Missing for the reference list: ${eksik.join(", ")}. Not checked against the indexes.` }
          : { tr: "Künye henüz dizinlerde denetlenmedi.", en: "The reference hasn't been checked against the indexes yet." },
      };

  const pdf: DurumSatiri =
    g.pdf.tur === "bagli"
      ? { anahtar: "pdf", ad: { tr: "PDF", en: "PDF" }, ton: "tamam", kisa: { tr: "PDF bağlı", en: "PDF linked" }, aciklama: { tr: "Bu kayda bağlanmış bir PDF var.", en: "A PDF is linked to this record." } }
      : g.pdf.tur === "doi"
        ? {
            anahtar: "pdf",
            ad: { tr: "PDF", en: "PDF" },
            ton: "uyari",
            kisa: { tr: "PDF DOI ile eşleşti", en: "PDF matched by DOI" },
            aciklama: {
              tr: "DOI'si bu kaynakla aynı bir PDF var ama kayda bağlanmadı; açıp doğru dosya olduğunu kontrol edin.",
              en: "A PDF with the same DOI exists but isn't linked to this record; open it and check it's the right file.",
            },
          }
        : g.pdf.tur === "belirsiz"
          ? {
              anahtar: "pdf",
              ad: { tr: "PDF", en: "PDF" },
              ton: "uyari",
              kisa: { tr: `${g.pdf.adaylar.length} PDF aynı DOI'de`, en: `${g.pdf.adaylar.length} PDFs share the DOI` },
              aciklama: {
                tr: "Aynı DOI'ye birden çok PDF düşüyor; hangisinin bu kaynak olduğu belli değil. PDF panelinden birini bu kayda bağlayın.",
                en: "Several PDFs share this DOI; it isn't clear which one is this source. Link one to this record from the PDF panel.",
              },
            }
          : { anahtar: "pdf", ad: { tr: "PDF", en: "PDF" }, ton: "notr", kisa: { tr: "PDF yok", en: "No PDF" }, aciklama: { tr: "Bu kaynağa ait PDF yok.", en: "There's no PDF for this source." } };

  const alinti: DurumSatiri =
    typeof g.alintiSayfasi === "number"
      ? {
          anahtar: "alinti",
          ad: { tr: "Alıntı", en: "Quote" },
          ton: "tamam",
          kisa: { tr: `Alıntı birebir · s. ${g.alintiSayfasi}`, en: `Exact quote · p. ${g.alintiSayfasi}` },
          aciklama: { tr: "Alıntı PDF metninde birebir bulundu (PDF'in kendi sayfa numarası).", en: "The quote was found verbatim in the PDF text (the PDF's own page number)." },
        }
      : {
          anahtar: "alinti",
          ad: { tr: "Alıntı", en: "Quote" },
          ton: "notr",
          kisa: { tr: "Doğrulanmış alıntı yok", en: "No verified quote" },
          aciklama: { tr: "Bu atıf için PDF metnine karşı doğrulanmış bir pasaj yok.", en: "There's no passage verified against the PDF text for this citation." },
        };
  return [kayit, pdf, alinti];
}

/*
  DOĞRUDAN ADRESLER (M5). "Kaynak kaydı" eskiden yalnızca çalışmanın
  Kaynaklar sayfasına gidiyordu; öğrenci elli kaynaklık listede aradığı
  kaydı yeniden buluyordu. Şimdi kayıt (?kaynak=) ve PDF (?pdf=) adreste:
  Kaynaklar sayfası satırı açıp vurgular, editör PDF çekmecesini o
  dosyayla açar. Kimlikler UUID; başka bir şey adrese yazılmaz.
*/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const kimlikMi = (deger: string | null | undefined): deger is string => !!deger && UUID.test(deger);

export const kaynakKaydiAdresi = (projectId: string, kaynakId: string) =>
  `/dashboard/literature?calisma=${encodeURIComponent(projectId)}&kaynak=${encodeURIComponent(kaynakId)}`;

/** Editörde PDF çekmecesini bu dosyayla açan adres (sağ panel ?sag=pdf ile aynı adres sözleşmesi). */
export const editorPdfAdresi = (projectId: string, pdfId: string, sayfa?: number | null) =>
  `/dashboard/editor/${encodeURIComponent(projectId)}/write?sag=pdf&pdf=${encodeURIComponent(pdfId)}${sayfa && sayfa > 0 ? `&sayfa=${Math.floor(sayfa)}` : ""}`;

/** Adresten PDF isteğini okur; bozuk kimlik ya da sayfa sessizce yok sayılır. */
export function adrestekiPdf(pdf: string | null, sayfa: string | null): { id: string; sayfa?: number } | null {
  if (!kimlikMi(pdf)) return null;
  const n = Number(sayfa);
  return Number.isInteger(n) && n > 0 && n < 100_000 ? { id: pdf, sayfa: n } : { id: pdf };
}
