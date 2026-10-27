/*
  FATURALAR VE ÖDEMELER — ArvoOS'un bildirdiği liste (26.10.2026).

  Ödemeyi ve faturayı ArvoOS tutuyor: bireysel abonenin kart ödemeleri,
  kurumun kart ve havale ödemeleri, Arvo'nun elle kesip PDF olarak
  yüklediği faturalar (ArvoOS platform_faturalari). ArvoLab listeyi
  abonelik köprüsünden ("billing", "org_billing") alıp gösteriyor;
  saklamıyor. Fatura ve dekont bağlantıları kısa süreli imzalı adres.

  Yanıt hoşgörülü okunuyor: tutarı ya da kimliği okunamayan satır
  ATILIYOR, uydurulmuyor (lib/kredi-paketleri.ts ile aynı ilke).

  Saf modül; testi tests/unit/faturalama.test.ts.
*/

export type Fatura = { no: string; tarih: string; url: string | null };

export type Odeme = {
  id: string;
  tarih: string | null;
  /** Kuruş. */
  tutar: number;
  paraBirimi: string;
  tur: "abonelik" | "kredi";
  durum: "odendi" | "bekliyor" | "reddedildi";
  kanal: "kart" | "havale";
  donemBaslangic: string | null;
  donemBitis: string | null;
  referans: string | null;
  dekontUrl: string | null;
  fatura: Fatura | null;
};

export type Faturalama = { odemeler: Odeme[]; toplamOdenen: number; bekleyenTutar: number };

const metin = (d: unknown) => (typeof d === "string" && d.trim() ? d.trim() : null);
const kurus = (d: unknown) => (typeof d === "number" && Number.isFinite(d) && d >= 0 ? Math.round(d) : null);
const https = (d: unknown) => {
  const m = metin(d);
  return m && /^https:\/\//i.test(m) ? m : null;
};

export function faturalamaOku(payload: unknown): Faturalama | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  if (!Array.isArray(p.odemeler)) return null;
  const odemeler: Odeme[] = [];
  for (const oge of p.odemeler) {
    if (!oge || typeof oge !== "object") continue;
    const o = oge as Record<string, unknown>;
    const id = metin(o.id);
    const tutar = kurus(o.tutar);
    if (!id || tutar === null) continue;
    const f = o.fatura && typeof o.fatura === "object" ? (o.fatura as Record<string, unknown>) : null;
    const faturaNo = f ? metin(f.no) : null;
    odemeler.push({
      id,
      tarih: metin(o.tarih),
      tutar,
      paraBirimi: metin(o.paraBirimi) ?? "TRY",
      tur: o.tur === "kredi" ? "kredi" : "abonelik",
      durum: o.durum === "bekliyor" ? "bekliyor" : o.durum === "reddedildi" ? "reddedildi" : "odendi",
      kanal: o.kanal === "havale" ? "havale" : "kart",
      donemBaslangic: metin(o.donemBaslangic),
      donemBitis: metin(o.donemBitis),
      referans: metin(o.referans),
      dekontUrl: https(o.dekontUrl),
      fatura: f && faturaNo ? { no: faturaNo, tarih: metin(f.tarih) ?? "", url: https(f.url) } : null,
    });
  }
  return { odemeler, toplamOdenen: kurus(p.toplamOdenen) ?? 0, bekleyenTutar: kurus(p.bekleyenTutar) ?? 0 };
}

/** "499,00 TL" — kuruştan. */
export const tutarYazisi = (kurusTutar: number, paraBirimi = "TRY") =>
  `${(kurusTutar / 100).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${paraBirimi === "TRY" ? "TL" : paraBirimi}`;

/** Satırın açıklaması: "ArvoLab aboneliği · 26.10–26.11.2026" ya da "AI kredisi". */
export function odemeAciklamasi(o: Odeme): string {
  if (o.tur === "kredi") return "AI kredisi";
  if (o.donemBaslangic && o.donemBitis) {
    const g = (t: string) => new Date(t).toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" });
    return `ArvoLab aboneliği · ${g(o.donemBaslangic)} – ${g(o.donemBitis)}`;
  }
  return "ArvoLab aboneliği";
}

/*
  Kim hangi listeyi görür. Bireysel abone kendi ödemelerini; kurumda
  yalnızca kurum yöneticisi (academic_manager) kurumun ödemelerini —
  öğrenci ve personel kurumun ne ödediğini görmez. Köprü kurumu kimliğiyle
  okuyor, kişiyi tanımıyor; yetki bu karardan geçmeden istek gitmemeli.
*/
export function faturalamaKapsami(
  erisimTuru: string,
  rol: string | null,
  kurumId: string | null,
): { tur: "bireysel" } | { tur: "kurum"; kurumId: string } | null {
  if (erisimTuru === "individual") return { tur: "bireysel" };
  if (erisimTuru === "organization" && rol === "academic_manager" && kurumId) return { tur: "kurum", kurumId };
  /*
    İç ekip (Kurucu, Sistem Yöneticisi) kurumların sahibi: seçili kurumun
    (lib/kurum-secimi.ts), seçim yoksa kendi kurumunun faturalarını görür.
    Eskiden iç ekip hiçbir kapsama girmiyordu ve Abonelik ve kredi
    sayfasında Faturalar bölümü kurucuya hiç çıkmıyordu (27.10.2026).
  */
  if (erisimTuru === "staff" && (rol === "founder" || rol === "system_admin") && kurumId) return { tur: "kurum", kurumId };
  return null;
}
