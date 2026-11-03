import { strToU8, zipSync } from "fflate";
import { tiptapLatex, type LatexSecenek } from "@/lib/tiptap-latex";
import { bibtexYaz } from "@/lib/kaynak-aktarim";
import { getLiteratureSources } from "@/app/actions/literature";
import { dosyayiKaydet } from "@/app/dashboard/_components/word-indir";

/*
  LaTeX paketi (03.11.2026): main.tex + kaynaklar.bib + görseller, tek ZIP.
  Overleaf "Yeni proje → ZIP yükle" ile doğrudan açar. Dönüşüm saf
  modülde (lib/tiptap-latex.ts); burası yalnızca dosyaları topluyor.

  Tarayıcıda çalışır. Görsel inemezse paket yine iner ama .tex'teki satır
  eksik dosyayı gösterir; atlanan görsel sayısı çağırana döner, sessizce
  "tamam" denmez.
*/
async function gorselBaytlari(src: string): Promise<Uint8Array | null> {
  try {
    if (src.startsWith("data:")) {
      const base64 = src.slice(src.indexOf(",") + 1);
      return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    }
    const cevap = await fetch(src);
    return cevap.ok ? new Uint8Array(await cevap.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

const dosyaAdi = (baslik: string) =>
  `${baslik.normalize("NFD").replace(/ı/g, "i").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "calisma"}-latex.zip`;

export async function latexPaketiniIndir(
  doc: { content?: unknown[] },
  projectId: string,
  secenek: Omit<LatexSecenek, "bibDosyasi">,
): Promise<{ atlananGorsel: number; kaynakSayisi: number | null }> {
  // Kaynaklar okunamazsa paket .bib'siz iner; sayı null döner ve çağıran söyler.
  const kaynaklar = await getLiteratureSources()
    .then((s) => (s.okunamadi ? null : s.satirlar.filter((k) => k.project_id === projectId)))
    .catch(() => null);
  const bib = kaynaklar?.length ? "kaynaklar.bib" : null;
  const { tex, gorseller } = tiptapLatex(doc as never, { ...secenek, bibDosyasi: bib });
  const dosyalar: Record<string, Uint8Array> = { "main.tex": strToU8(tex) };
  if (bib && kaynaklar) dosyalar[bib] = strToU8(bibtexYaz(kaynaklar));
  let atlananGorsel = 0;
  for (const g of gorseller) {
    const baytlar = await gorselBaytlari(g.src);
    if (baytlar) dosyalar[g.ad] = baytlar;
    else atlananGorsel++;
  }
  dosyayiKaydet(new Blob([zipSync(dosyalar) as BlobPart], { type: "application/zip" }), dosyaAdi(secenek.baslik));
  return { atlananGorsel, kaynakSayisi: kaynaklar ? kaynaklar.length : null };
}
