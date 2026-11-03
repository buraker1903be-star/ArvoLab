import YERLESIK from "./csl-yerel.json";
import { CSL_DESENI } from "./csl-kimlik";
import { ebeveynStil, stilVarsayilanDili } from "./csl";

/*
  CSL STİL VE YEREL AYAR İNDİRME (03.11.2026, yalnızca sunucu).

  ~10 600 stilin hepsini derlemeye koymak (≈ 400 MB XML) yerine seçilen
  stil, CSL'in resmî deposundan (citation-style-language/styles, CC BY-SA
  3.0) ilk kullanımda indirilir ve sunucu örneğinin belleğinde kalır.
  Bağımlı stil (ör. "nature-genetics") yalnızca ebeveynini gösteren bir
  bağlantıdır; biçim ebeveynden okunur.

  Türkçe ve İngilizce yerel ayarlar depoda (lib/atif/csl-yerel.json): her
  atıfta gerekiyorlar ve indirme arızası Türkçe atfı İngilizce terimlerle
  ("et al.", "p.") yazdırmamalı. Stilin kendi dili başkaysa (Almanca bir
  dergi) o dil de indirilir; inemezse citeproc en-US'e düşer.
*/

const KOK = "https://raw.githubusercontent.com/citation-style-language";
const ZAMAN_ASIMI = 8_000;
const stiller = new Map<string, string>();
const yereller = new Map<string, string | false>();

async function indir(adres: string): Promise<string | null> {
  const cevap = await fetch(adres, { signal: AbortSignal.timeout(ZAMAN_ASIMI), cache: "force-cache" });
  if (cevap.status === 404) return null;
  if (!cevap.ok) throw new Error(`CSL indirilemedi (${cevap.status}): ${adres}`);
  return cevap.text();
}

/** Stilin bağımsız XML'i; stil depoda yoksa null. Ağ arızası fırlatır (geçici; "yok" denmez). */
export async function cslStilXml(ad: string): Promise<string | null> {
  if (!CSL_DESENI.test(`csl:a:${ad}`)) return null;
  const bellekte = stiller.get(ad);
  if (bellekte) return bellekte;
  let xml = await indir(`${KOK}/styles/master/${ad}.csl`);
  if (xml === null) {
    const bagimli = await indir(`${KOK}/styles/master/dependent/${ad}.csl`);
    const ebeveyn = bagimli ? ebeveynStil(bagimli) : null;
    xml = ebeveyn ? await indir(`${KOK}/styles/master/${ebeveyn}.csl`) : null;
  }
  if (xml) stiller.set(ad, xml);
  return xml;
}

/** Stilin ihtiyaç duyacağı yerel ayarları önceden yükler; dönen işlev citeproc'a verilir. */
export async function cslYerelleri(stilXml: string): Promise<(dil: string) => string | false> {
  const gerekli = new Set(["tr-TR", "en-US"]);
  const varsayilan = stilVarsayilanDili(stilXml);
  if (varsayilan && /^[a-z]{2}(?:-[A-Z]{2})?$/.test(varsayilan)) gerekli.add(varsayilan);
  for (const dil of gerekli) {
    if (yereller.has(dil)) continue;
    const yerlesik = (YERLESIK as Record<string, string>)[dil];
    if (yerlesik) {
      yereller.set(dil, yerlesik);
      continue;
    }
    try {
      yereller.set(dil, (await indir(`${KOK}/locales/master/locales-${dil}.xml`)) ?? false);
    } catch {
      // Ağ arızası kalıcı "yok" sayılmaz: bir sonraki istekte yeniden denenir.
    }
  }
  return (dil) => yereller.get(dil) ?? yereller.get(dil.slice(0, 2)) ?? false;
}
