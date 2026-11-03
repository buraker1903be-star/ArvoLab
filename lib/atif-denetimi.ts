import { crossCheck, computeComplianceScore, extractInTextCitations, type CrossCheckResult, type ParsedReference } from "@/lib/apa7";
import { kunyeleriAyristir } from "@/lib/atif/kunye";
import { atifCikarmaStili, stilTanimi } from "@/lib/atif/stiller";
import { dipnotAtiflari } from "@/lib/atif/dipnot";
import { dipnotMetinleri, extractPlainText, type TiptapDoc } from "@/lib/tiptap-text";
import { aralikta, belgeBolumleri, kaynakcaGirdileri, type Dugum } from "@/lib/kaynakca-bolumu";

/*
  EDİTÖRDEKİ KONTROLÜN ATIF BÖLÜMÜ (03.11.2026). Eskiden
  app/actions/manuscript.ts içinde düz metinden yapılıyordu ve kaynakçayı
  yapı denetiminden (lib/structure-check.ts) FARKLI bir kuralla
  buluyordu; iki rapor aynı tez için farklı künye listeleri görüyordu.
  Artık ikisi de belge ağacından, aynı sınırla (lib/kaynakca-bolumu.ts)
  okuyor. Saf: kayıt ve yetki eylemde kalır, burası test edilebilir.
*/
export interface AtifDenetimSonucu {
  referenceSectionFound: boolean;
  complianceScore: number | null;
  references: ParsedReference[];
  crossCheck: CrossCheckResult;
}

/** Gövde metni: kaynakça ve liste bölümleri (İçindekiler, Tablolar Listesi, Kısaltmalar…) hariç. */
export function govdeMetni(doc: TiptapDoc | null | undefined): string {
  const bloklar = (doc?.content ?? []) as Dugum[];
  const { kaynakca, listeler } = belgeBolumleri(bloklar);
  const disarida = (i: number) =>
    (kaynakca !== null && i >= kaynakca.bas && i < kaynakca.bit) || listeler.some((a) => i === a.bas || aralikta(a, i));
  return extractPlainText({ type: "doc", content: bloklar.filter((_, i) => !disarida(i)) as TiptapDoc["content"] });
}

export function atifDenetimi(doc: TiptapDoc | null | undefined, stilDegeri: string | null | undefined): AtifDenetimSonucu {
  const bos: AtifDenetimSonucu = {
    referenceSectionFound: false,
    complianceScore: null,
    references: [],
    crossCheck: { citationsWithoutReference: [], referencesWithoutCitation: [] },
  };
  const bloklar = (doc?.content ?? []) as Dugum[];
  const { kaynakca } = belgeBolumleri(bloklar);
  if (!kaynakca) return bos;
  const stil = stilTanimi(stilDegeri);
  const references = kunyeleriAyristir(kaynakcaGirdileri(bloklar, kaynakca).girdiler, stil.id);
  if (!references.length) return { ...bos, referenceSectionFound: true };
  /*
    Numara stillerinde (IEEE, Vancouver) atıf ile künye ADLA değil SIRAYLA
    eşleşir; çapraz kontrol orada anlamsız, numara eşleşmesini yapı
    denetimi yapıyor. Dipnotlu stilde atıflar dipnotlarda.
  */
  const govde = govdeMetni(doc);
  const citations =
    stil.tur === "numara"
      ? []
      : stil.tur === "dipnot"
        ? dipnotAtiflari(dipnotMetinleri(doc))
        : extractInTextCitations(govde, { style: atifCikarmaStili(stil) });
  const yazarTarih = stil.tur === "yazar-tarih";
  const cross =
    stil.tur === "numara"
      ? { citationsWithoutReference: [], referencesWithoutCitation: [] }
      : crossCheck(citations, references, { yilaBak: yazarTarih, govde: yazarTarih ? govde : undefined });
  return { referenceSectionFound: true, complianceScore: computeComplianceScore(references, cross), references, crossCheck: cross };
}
