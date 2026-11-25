/* scripts/arvoos-eslestirme-raporu.mjs'in tipleri (birim testi içe aktarıyor). */
import type {
  Atama,
  AtamaOnerisi,
  ArvolabProfili,
  ArvoosKaydi,
  BagSatiri,
  Ozet,
  RolOnerisi,
} from "../lib/arvoos-eslestirme";

export type ArvoosTarafi = { kayitlar: ArvoosKaydi[]; kapsam: Set<string>; kaynak?: string };
export type ToplananVeri = { profiller: ArvolabProfili[]; yansima: ArvoosKaydi[]; atamalar: Atama[] };
export type Rapor = {
  baglar: BagSatiri[];
  atamalar: AtamaOnerisi[];
  roller: RolOnerisi[];
  ozet: Ozet;
  kaynak?: string;
};

/** Var olmayan hedefi ve sembolik bağlantıyı da çözen gerçek yol. */
export function gercekYol(yol: string, derinlik?: number): string;
/** Gerçek yol depo kökünün içinde mi (sınır path ayracıyla). */
export function depoIcinde(hedefGercek: string, depoKoku: string): boolean;

export function saltOkunurFetch(
  icFetch?: (url: unknown, secenek?: { method?: string }) => Promise<unknown>,
): (url: unknown, secenek?: { method?: string }) => Promise<unknown>;
export function anlikOku(ham: string): { kayitlar: ArvoosKaydi[]; kapsam: Set<string> };
export function topla(sb: unknown): Promise<ToplananVeri>;
export function raporla(veri: { profiller: ArvolabProfili[]; atamalar: Atama[] }, arvoos: ArvoosTarafi): Rapor;
