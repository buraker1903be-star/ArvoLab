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

import type { Dil } from "./dil";
import { tarihBicimleri } from "./tr-time";

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

/*
  PROFORMA (27.10.2026, kurum sahibinin isteği: "faturayı yüklemeden önce
  proforma oluşsun, sonra müşteri ödemeyi yapsın"). Sıra: proforma →
  ödeme → makbuz → fatura. Proformayı kurucu ArvoOS'ta düzenliyor;
  burada gösterilip yazdırılıyor. Tutarlar KDV hariç kalemler, KDV ayrı
  satır.
*/
export type ProformaKalemi = { aciklama: string; miktar: number; birimFiyat: number };

/*
  Alıcı (28.10.2026). Eskiden "Sayın" bölümünde yalnızca musteriAdi
  vardı ve çoğu zaman bir e-posta adresiydi: kurum muhasebesi
  proformayı unvan, vergi dairesi ve numarası olmadan işleme
  alamıyordu. ArvoOS alıcıyı artık ayrıca gönderiyor; eski sürüm
  göndermiyor, o zaman musteriAdi satırı gösterilmeye devam eder.
*/
export type ProformaAlici = {
  adSoyad: string | null;
  unvan: string | null;
  vergiDairesi: string | null;
  /** VKN (10 hane) ya da TCKN (11 hane); başka biçim de gelebilir, olduğu gibi yazılır. */
  vergiNo: string | null;
  adres: string | null;
  eposta: string | null;
};

export type Proforma = {
  id: string;
  no: string;
  musteriAdi: string;
  /** Eski ArvoOS göndermiyor ya da hiçbir alanı dolu değilse null. */
  alici: ProformaAlici | null;
  kalemler: ProformaKalemi[];
  araToplam: number;
  kdvOrani: number;
  kdv: number;
  toplam: number;
  paraBirimi: string;
  duzenlemeTarihi: string;
  gecerlilikTarihi: string;
  notlar: string | null;
  durum: "bekliyor" | "odendi";
  odemeId: string | null;
};

export type Satici = {
  unvan: string;
  adres: string | null;
  vergiDairesi: string | null;
  vergiNo: string | null;
  mersisNo: string | null;
  hesaplar: { banka: string; hesapSahibi: string | null; iban: string; paraBirimi: string }[];
};

export type Faturalama = {
  odemeler: Odeme[];
  toplamOdenen: number;
  bekleyenTutar: number;
  proformalar: Proforma[];
  satici: Satici | null;
};

const metin = (d: unknown) => (typeof d === "string" && d.trim() ? d.trim() : null);
const kurus = (d: unknown) => (typeof d === "number" && Number.isFinite(d) && d >= 0 ? Math.round(d) : null);
const sayi = (d: unknown) => (typeof d === "number" && Number.isFinite(d) ? d : null);
const gun = (d: unknown) => {
  const m = metin(d);
  return m && /^\d{4}-\d{2}-\d{2}/.test(m) ? m.slice(0, 10) : null;
};
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
  return {
    odemeler,
    toplamOdenen: kurus(p.toplamOdenen) ?? 0,
    bekleyenTutar: kurus(p.bekleyenTutar) ?? 0,
    // Eski ArvoOS bu alanları göndermiyor: proforma yok sayılır, liste yine okunur.
    proformalar: Array.isArray(p.proformalar) ? p.proformalar.flatMap((o) => proformaOku(o) ?? []) : [],
    satici: saticiOku(p.satici),
  };
}

/*
  Proforma resmî belge gibi okunuyor: kalemlerin toplamı ara toplamı,
  ara toplam + KDV de toplamı TUTMUYORSA proforma hiç gösterilmez.
  Kusurlu bir proformayı yazdırıp müşteriye ödetmek, onu hiç
  göstermemekten kötü; ArvoOS toplamı zaten kalemlerden hesaplıyor, bu
  yalnızca bozuk yanıta karşı.
*/
function proformaOku(oge: unknown): Proforma | null {
  if (!oge || typeof oge !== "object") return null;
  const o = oge as Record<string, unknown>;
  const id = metin(o.id);
  const no = metin(o.no);
  const araToplam = kurus(o.araToplam);
  const kdv = kurus(o.kdv);
  const toplam = kurus(o.toplam);
  const kdvOrani = sayi(o.kdvOrani);
  const duzenlemeTarihi = gun(o.duzenlemeTarihi);
  const gecerlilikTarihi = gun(o.gecerlilikTarihi);
  if (!id || !no || araToplam === null || kdv === null || toplam === null || kdvOrani === null || !duzenlemeTarihi || !gecerlilikTarihi) return null;
  if (!Array.isArray(o.kalemler) || !o.kalemler.length) return null;
  const kalemler: ProformaKalemi[] = [];
  for (const k of o.kalemler) {
    if (!k || typeof k !== "object") return null;
    const r = k as Record<string, unknown>;
    const aciklama = metin(r.aciklama);
    const miktar = sayi(r.miktar);
    const birimFiyat = kurus(r.birim_fiyat);
    if (!aciklama || miktar === null || miktar <= 0 || birimFiyat === null) return null;
    kalemler.push({ aciklama, miktar, birimFiyat });
  }
  if (kalemler.reduce((t, k) => t + kalemTutari(k), 0) !== araToplam || araToplam + kdv !== toplam) return null;
  return {
    id,
    no,
    musteriAdi: metin(o.musteriAdi) ?? "",
    alici: aliciOku(o.alici),
    kalemler,
    araToplam,
    kdvOrani,
    kdv,
    toplam,
    paraBirimi: metin(o.paraBirimi) ?? "TRY",
    duzenlemeTarihi,
    gecerlilikTarihi,
    notlar: metin(o.notlar),
    durum: o.durum === "odendi" ? "odendi" : "bekliyor",
    odemeId: metin(o.odemeId),
  };
}

/*
  Alıcı toplamlardan farklı okunuyor: kusurlu bir alıcı proformayı
  DÜŞÜRMEZ. Tutar ödenecek parayı belirliyor, alıcı yalnızca gösterim;
  okunamayan alan boş kalır, musteriAdi zaten yanında geliyor.
*/
function aliciOku(oge: unknown): ProformaAlici | null {
  if (!oge || typeof oge !== "object" || Array.isArray(oge)) return null;
  const o = oge as Record<string, unknown>;
  const alici: ProformaAlici = {
    adSoyad: metin(o.adSoyad),
    unvan: metin(o.unvan),
    vergiDairesi: metin(o.vergiDairesi),
    vergiNo: metin(o.vergiNo),
    adres: metin(o.adres),
    eposta: metin(o.eposta),
  };
  return Object.values(alici).some((d) => d !== null) ? alici : null;
}

/*
  Vergi numarasının etiketi hanesinden: 10 hane VKN (tüzel kişi ya da
  vergi mükellefi), 11 hane TCKN (şahıs). Başka biçimde gelen numara
  için "Vergi No" — hangisi olduğunu bilmeden VKN yazmak, şahsın
  kimlik numarasını şirket numarası gibi göstermek olurdu.
*/
export function vergiNoEtiketi(vergiNo: string, dil: Dil = "tr"): string {
  const rakam = vergiNo.replace(/\s/g, "");
  const en = dil === "en";
  if (/^\d{10}$/.test(rakam)) return en ? "Tax ID" : "VKN";
  if (/^\d{11}$/.test(rakam)) return en ? "National ID" : "TCKN";
  return en ? "Tax No." : "Vergi No";
}

function saticiOku(oge: unknown): Satici | null {
  if (!oge || typeof oge !== "object") return null;
  const o = oge as Record<string, unknown>;
  const unvan = metin(o.unvan);
  if (!unvan) return null;
  return {
    unvan,
    adres: metin(o.adres),
    vergiDairesi: metin(o.vergiDairesi),
    vergiNo: metin(o.vergiNo),
    mersisNo: metin(o.mersisNo),
    hesaplar: (Array.isArray(o.hesaplar) ? o.hesaplar : []).flatMap((h) => {
      if (!h || typeof h !== "object") return [];
      const r = h as Record<string, unknown>;
      const banka = metin(r.banka);
      const iban = metin(r.iban);
      return banka && iban ? [{ banka, iban, hesapSahibi: metin(r.hesapSahibi), paraBirimi: metin(r.paraBirimi) ?? "TRY" }] : [];
    }),
  };
}

/** Satır tutarı: miktar × birim fiyat, kuruşa yuvarlanmış (ArvoOS lib/proforma ile aynı kural). */
export const kalemTutari = (k: ProformaKalemi) => Math.round(k.miktar * k.birimFiyat);

/*
  Geçerlilik tarihi geçmiş, ödenmemiş proforma "süresi doldu" görünür.
  ArvoOS kaydı değiştirmiyor (geç gelen ödeme yine eşlenebilsin); karar
  yalnızca gösterimde, Türkiye günüyle (YYYY-MM-DD).
*/
export function proformaDurumu(p: Pick<Proforma, "durum" | "gecerlilikTarihi">, bugun: string): "bekliyor" | "odendi" | "suresi_doldu" {
  if (p.durum === "odendi") return "odendi";
  return p.gecerlilikTarihi < bugun ? "suresi_doldu" : "bekliyor";
}

/** Makbuzda gösterilecek proforma: ödemeyle eşlenen. */
export const odemeninProformasi = (veri: Faturalama, odemeId: string) =>
  veri.proformalar.find((p) => p.odemeId === odemeId) ?? null;

/**
 * "15.11.2026" (en: "Nov 15, 2026") — gün anahtarından; saat dilimine düşmeden.
 * İngilizcede gün, UTC öğlesine sabitlenip UTC'de yazılır: anahtar bir AN
 * değil GÜN taşıyor, başka dilimde yazmak onu komşu güne kaydırabilirdi.
 */
export const gunYazisi = (g: string, dil: Dil = "tr") =>
  dil === "en"
    ? tarihBicimleri("en", "UTC").tarih(`${g.slice(0, 10)}T12:00:00Z`)
    : g.slice(0, 10).split("-").reverse().join(".");

/** "499,00 TL" — kuruştan (en: "499.00 TRY"). */
export const tutarYazisi = (kurusTutar: number, paraBirimi = "TRY", dil: Dil = "tr") =>
  dil === "en"
    ? `${(kurusTutar / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${paraBirimi}`
    : `${(kurusTutar / 100).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${paraBirimi === "TRY" ? "TL" : paraBirimi}`;

/** Satırın açıklaması: "ArvoLab aboneliği · 26.10–26.11.2026" ya da "AI kredisi". */
export function odemeAciklamasi(o: Odeme, dil: Dil = "tr"): string {
  const en = dil === "en";
  if (o.tur === "kredi") return en ? "AI credits" : "AI kredisi";
  const ad = en ? "ArvoLab subscription" : "ArvoLab aboneliği";
  if (o.donemBaslangic && o.donemBitis) {
    /* Dönem sınırları Türkiye saatiyle yazılıyor (ArvoOS dönemi orada açıyor). */
    const g = en
      ? tarihBicimleri("en", "Europe/Istanbul").tarih
      : (t: string) => new Date(t).toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" });
    return `${ad} · ${g(o.donemBaslangic)} – ${g(o.donemBitis)}`;
  }
  return ad;
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
