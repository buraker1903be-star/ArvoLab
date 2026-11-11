/* scripts/test-ortami/g1-86-baglanti.mjs'in tipleri (birim testi içe aktarıyor; tsconfig allowJs kapalı). */
export const TEST_REF: string;
export const URETIM_REF: string;
export const IZINLI_KOKLER: string[];
export const VARSAYILAN_KOK: string;
export const EPOSTA_DESENI: RegExp;
export const ISLEMLER: string[];

export class Dur extends Error {
  constructor(mesaj: string, cikis?: number);
  cikis: number;
}

export const DURUMLAR: string[];
export type Kayit = {
  surum: 2;
  proje: string;
  durum: "olusturuluyor" | "olusturuldu" | "silindi" | "olusmadi";
  eposta: string;
  niyetZamani: string;
  userId: string | null;
  olusturuldu: string | null;
  korunanOzetler: string[];
  imza: string;
  imzaDogrulandi?: boolean;
};
export type KullaniciBilgisi = {
  id: string;
  email?: string;
  created_at?: string;
  email_confirmed_at?: string | null;
  last_sign_in_at?: string | null;
  user_metadata?: Record<string, unknown>;
};
export type YonetimIstemcisi = {
  generateLink(p: Record<string, unknown>): Promise<{ data: unknown; error: unknown }>;
  getUserById(id: string): Promise<{ data: unknown; error: unknown }>;
  deleteUser(id: string): Promise<{ data: unknown; error: unknown }>;
  listUsers(p: { page: number; perPage: number }): Promise<{ data: unknown; error: unknown }>;
};

export const ROLLER: string[];
export const U2_BEKLEME_SINIRI_MS: number;
export function sentetikEposta(rol: string, simdi?: Date): string;
export function epostaRolu(eposta: unknown): "u1" | "u2" | null;
export function u2SifresiOku(env: Record<string, string | undefined>, anahtar?: string): string;
export function devamBekleKur(secenek?: {
  girdi?: NodeJS.ReadableStream;
  cikti?: NodeJS.WritableStream;
}): (soru: string) => Promise<"devam" | "iptal" | "kapandi">;
export function guvenliHata(hata: unknown): string;
export function kimlikOzeti(id: string): string;
export function u1Epostasi(simdi?: Date): string;
export function epostaGecerli(eposta: unknown): boolean;
export function argumanlariCoz(argv: string[]): { islem: string; calistir: boolean; kok: string; rol: "u1" | "u2" };
export function hedefDenetle(env: Record<string, string | undefined>): string;
export function anahtarOku(env: Record<string, string | undefined>): string;
export function varsayilanKayitYolu(env: Record<string, string | undefined>): string;
export function imzaAnahtari(anahtar: string): Buffer;
export function kayitImzala(kayit: Omit<Kayit, "imza">, imzaAnahtar: Buffer): string;
export function kayitOku(yol: string, imzaAnahtar?: Buffer | null): Kayit | null;
export function kayitYaz(yol: string, kayit: Omit<Kayit, "imza"> & { imza?: string }, imzaAnahtar: Buffer): Kayit;
export function niyetleEslesir(kullanici: KullaniciBilgisi | null | undefined, kayit: Kayit): string | null;
export function hedefKullaniciDenetle(kayit: Kayit | null, kullanici: KullaniciBilgisi | null | undefined): KullaniciBilgisi;
export function baglantiKur(kok: string, hashedToken: unknown, tur: "signup" | "recovery"): string;
export function korunanOzetleriTopla(admin: YonetimIstemcisi): Promise<string[]>;
export function baglantiyiAc(baglanti: string, secenek?: { acici?: (adres: string) => Promise<void>; bekleme?: number }): Promise<void>;
export const ACICI_DEGISKENLERI: { win32: string[]; darwin: string[]; linux: string[] };
export function aciciOrtami(env?: Record<string, string | undefined>, platform?: string): Record<string, string>;
export type AltSurec = { once(olay: "spawn" | "error", f: (...a: unknown[]) => void): unknown; unref(): void };
export function sistemAcicisiKur(secenek?: {
  platform?: string;
  env?: Record<string, string | undefined>;
  spawnFn?: (komut: string, args: string[], secenek: Record<string, unknown>) => AltSurec;
}): (adres: string) => Promise<void>;
export function dogrudanCalistirildiMi(
  metaUrl: string,
  argv1: string | undefined,
  secenek?: { platform?: string; realpath?: (y: string) => string },
): "ana" | "baska" | "belirsiz";
export function calistir(
  argv: string[],
  secenek?: {
    env?: Record<string, string | undefined>;
    cikti?: (m: string) => void;
    hataCikti?: (m: string) => void;
    adminFabrikasi?: (url: string, anahtar: string) => Promise<YonetimIstemcisi>;
    simdi?: Date;
    kayitYolu?: string;
    ac?: (baglanti: string) => Promise<void>;
    bekle?: (soru: string) => Promise<string>;
    saat?: () => number;
  },
): Promise<number>;
