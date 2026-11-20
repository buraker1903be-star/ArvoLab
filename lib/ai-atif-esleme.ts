import { crossCheck, extractInTextCitations, type ParsedReference } from "@/lib/apa7";
import { splitAuthors } from "@/lib/citation-format";

/*
  AI METNİNDEKİ ATIFLARIN KÜTÜPHANEYLE EŞLEŞMESİ (B-16, 20.11.2026).
  Yazım asistanının metni "(Demir, 2019)" gibi düz metin atıflar taşır;
  sunucu bunların HER BİRİNİN kütüphanede karşılığı olduğunu zaten
  denetliyor (yazimDenetle → crossCheck). Eskiden metin belgeye girince
  orada kalıyordu: Kaynakça güncellenmiyor, öğrenci kaynağı elle eklemek
  zorunda kalıyor ya da unutuyordu.

  Burada her atıf için ADAY kaynaklar bulunur. Tek aday → kaynak bağlanır
  (Kaynakça'ya yazılır). Birden çok aday (iki "Demir, 2019") → BELİRSİZ:
  hiçbiri doğrulanmış sayılmaz ve kaynakçaya eklenmez; öğrenciye söylenir.
  Belirsizi sessizce birine bağlamak, yanlış kaynağı kaynakçaya yazmak
  demektir. Eşleşme kuralı sunucudakiyle aynı (crossCheck), kopya değil.
*/
export type EslesebilirKaynak = { id: string; authors: string | null; year: string | number | null; title: string };
export type AiAtifEslesmesi = {
  /** Tek adayla eşleşen kaynak kimlikleri (yinelenmesiz, metindeki sırayla). */
  eslesen: string[];
  /** Birden çok adayı olan atıflar: kaynakçaya eklenmez. */
  belirsiz: { atif: string; adaylar: string[] }[];
  /** Hiçbir kaynakla eşleşmeyen atıflar (sunucu denetimi sonrası beklenmez). */
  eslesmeyen: string[];
};

const referans = (k: EslesebilirKaynak): ParsedReference => ({
  raw: `${k.authors ?? ""} (${k.year ?? ""})`,
  authors: splitAuthors(k.authors),
  year: k.year == null ? null : String(k.year),
  title: k.title,
  issues: [],
});

export function aiAtiflariniEsle(metin: string, kaynaklar: readonly EslesebilirKaynak[], stil: "apa7" | "chicago" | "mla" = "apa7"): AiAtifEslesmesi {
  const sonuc: AiAtifEslesmesi = { eslesen: [], belirsiz: [], eslesmeyen: [] };
  if (!metin.trim() || !kaynaklar.length) return sonuc;
  const refler = kaynaklar.map((k) => ({ k, r: referans(k) }));
  const gorulen = new Set<string>();
  for (const atif of extractInTextCitations(metin, { style: stil })) {
    const sinanacak = { ...atif, kind: "parenthetical" as const };
    const uyanlar = refler.filter(({ r }) => crossCheck([sinanacak], [r], { yilaBak: stil !== "mla" }).citationsWithoutReference.length === 0).map(({ k }) => k);
    /*
      Aynı eserin kopyaları (aynı başlık; kütüphaneye iki kez eklenmiş)
      belirsizlik DEĞİLDİR: hangisi seçilse künye aynı. Ayrı eserler
      ("Demir, A." ve "Demir, B.", ikisi de 2019) belirsizdir.
    */
    const eserler = new Map<string, string>();
    for (const k of uyanlar) {
      const anahtar = k.title.toLocaleLowerCase("tr-TR").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
      if (!eserler.has(anahtar)) eserler.set(anahtar, k.id);
    }
    const adaylar = [...eserler.values()];
    if (adaylar.length === 1) {
      if (!gorulen.has(adaylar[0])) {
        gorulen.add(adaylar[0]);
        sonuc.eslesen.push(adaylar[0]);
      }
    } else if (adaylar.length > 1) {
      if (!sonuc.belirsiz.some((b) => b.atif === atif.raw)) sonuc.belirsiz.push({ atif: atif.raw, adaylar });
    } else if (!sonuc.eslesmeyen.includes(atif.raw)) {
      sonuc.eslesmeyen.push(atif.raw);
    }
  }
  return sonuc;
}
