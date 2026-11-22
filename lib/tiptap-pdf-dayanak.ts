import { Mark, mergeAttributes } from "@tiptap/core";

/*
  PDF DAYANAĞI (20.11.2026). PDF çekmecesinde doğrulanmış bir seçimden
  eklenen alıntı ve atıf (ya da pasaja bağlı "yalnızca atıf") bu görünmez
  işaretle belgeye girer. PDF'teki fosforlu sarı vurgu belgedeki bu
  işaretlerden TÜRETİLİR; ayrı bir kayıt tutulmaz.

  Neden belgede (ve yeni bir tablo değil): atıflar düğüm değil düz metin;
  işaret metnin kendisinde durunca
    - kalıcılık belgeyle birlikte gelir (çekmeceyi kapat/aç, yenile, yeni
      oturum: belge veritabanından okunur, tarayıcı belleğine dayanmaz),
    - işaret çalışmaya ve atfın kendisine bağlıdır,
    - geri alma, yineleme ve atfı silme belgeyle birebir tutarlıdır (metin
      giderse işaret de gider; Ctrl+Z ile dönerse işaret de döner),
    - başarısız ekleme işaret bırakmaz (ekleme tek işlem; işlem yoksa işaret
      de yok).
  Mevcut kanıt kaydı (kanit_kayitlari) bu iş için kullanılmadı: her satırı
  bir iddia (≥5 karakter) istiyor ve kanıt matrisine düşüyor, belgedeki
  atfı ve PDF sürümünü taşıyan bir alanı da yok.

  Öznitelikler:
    pdf    — kaynak_pdfleri satırının kimliği,
    surum  — PDF dosyasının SHA-256 özeti (baytlardan). Aynı künyeye yeni
             PDF yüklenince satır kimliği aynı kalır ama özet değişir; eski
             işaret yeni dosyada SESSİZCE uygulanmaz (çekmece "eski sürüme
             ait" diye söyler),
    sayfa  — PDF'in kendi sayfa numarası (basılı sayfa değil),
    pasaj  — sunucunun PDF metnine karşı doğruladığı metin; vurgu her
             çizimde bu METİNLE bulunur, koordinatla değil: yakınlaştırma,
             yeniden boyutlandırma ve iki sütunlu düzende metinle hizalı kalır,
    kaynak — literature_sources kimliği ("Dayanağa git" atıf kartından).

  GÖRÜNMEZ ve hiçbir çıktıya girmez: yazdırma, paylaşım ve Word bilinmeyen
  işareti atlar (tests/editor/pdf-dayanak.test.ts sabitliyor).
  inclusive: false — atfın arkasına yazılan metin işareti devralmaz.
*/
export const PDF_DAYANAK = "pdfDayanak";

export type PdfDayanagi = { pdf: string; surum: string; sayfa: number; pasaj: string; kaynak: string | null };

export const PdfDayanak = Mark.create({
  name: PDF_DAYANAK,
  inclusive: false,
  excludes: "",
  addAttributes() {
    const oz = (ad: string, veri: string) => ({
      default: null,
      parseHTML: (el: HTMLElement) => el.getAttribute(veri) || null,
      renderHTML: (attrs: Record<string, unknown>) => (attrs[ad] == null ? {} : { [veri]: String(attrs[ad]) }),
    });
    return {
      pdf: oz("pdf", "data-pdf"),
      surum: oz("surum", "data-pdf-surum"),
      sayfa: {
        default: null,
        parseHTML: (el: HTMLElement) => Number(el.getAttribute("data-pdf-sayfa")) || null,
        renderHTML: (attrs: { sayfa?: number | null }) => (attrs.sayfa ? { "data-pdf-sayfa": String(attrs.sayfa) } : {}),
      },
      pasaj: oz("pasaj", "data-pdf-pasaj"),
      kaynak: oz("kaynak", "data-pdf-kaynak"),
    };
  },
  parseHTML() {
    return [{ tag: "span[data-pdf]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { class: "pdf-dayanak-izi" }), 0];
  },
});

type DugumBenzeri = { marks: readonly { type: { name: string }; attrs: Record<string, unknown> }[] };

/** Belgede hâlâ duran PDF dayanakları (tekilleştirilmiş). Saf: tarayıcısız sınanır. */
export function pdfDayanaklari(doc: { descendants: (f: (node: DugumBenzeri) => boolean | void) => void }): PdfDayanagi[] {
  const sonuc = new Map<string, PdfDayanagi>();
  doc.descendants((node) => {
    for (const isaret of node.marks) {
      if (isaret.type.name !== PDF_DAYANAK) continue;
      const a = isaret.attrs;
      if (typeof a.pdf !== "string" || typeof a.surum !== "string" || typeof a.pasaj !== "string" || !a.pasaj || typeof a.sayfa !== "number") continue;
      const anahtar = `${a.pdf}|${a.surum}|${a.sayfa}|${a.pasaj}`;
      if (!sonuc.has(anahtar)) sonuc.set(anahtar, { pdf: a.pdf, surum: a.surum, sayfa: a.sayfa, pasaj: a.pasaj, kaynak: typeof a.kaynak === "string" ? a.kaynak : null });
    }
  });
  return [...sonuc.values()];
}

/** Bu PDF'in bu sürümüne ait işaretler ve eski sürüme ait olanların sayısı. */
export function pdfIsaretleri(dayanaklar: PdfDayanagi[], pdf: string, surum: string | null): { gecerli: PdfDayanagi[]; eski: number } {
  const bu = dayanaklar.filter((d) => d.pdf === pdf);
  if (!surum) return { gecerli: [], eski: 0 };
  return { gecerli: bu.filter((d) => d.surum === surum), eski: bu.filter((d) => d.surum !== surum).length };
}
