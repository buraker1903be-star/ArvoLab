import { KAGITLAR, type KagitBoyutu } from "./kagit-boyutu";

/*
  AKADEMİK BELGENİN EKRANDAKİ METİN SÜTUNU (V4.3-C1, karar K-4).

  ESKİDEN sütun akışkandı: en çok 860 px, dolguyla ortalanıyor, kalan yer
  neyse o (workspace.css). Aynı belge ekranın durumuna göre YENİDEN
  KIRILIYORDU — C1 öncesi ölçüm (masaüstü, 20 durum): sütun 8 ayrı değer
  aldı, 434 ile 860 px arası. 1440 px'te panel açılınca 860 → 654, kenar
  çubuğu daraltılınca 654 → 814; her seferinde 615 bloğun neredeyse tamamı
  yeniden dizildi, yazan öğrenci gözünün yerini kaybediyordu.

  ŞİMDİ sütun SABİT: kılavuzun metin genişliği varsa o, yoksa onaylı
  tasarımın 638 px'i. Yer yetmediğinde (telefon, dar tablet) sütun
  daralır; ama masaüstünde panel ya da kenar çubuğu değişince değişmez
  (yer bütçesi: lib/os/kirilimlar.ts, YAZIM_RAYI_EN_FAZLA).

  KILAVUZ ÖNCE: kılavuz kenar boşluklarını tanımlıyorsa sütun, belgenin
  sayfa düzenindeki kâğıt genişliği eksi sol ve sağ boşluktur (CSS cm:
  ekranın cm'si 96 dpi, A4 + sol 4 / sağ 2,5 cm → 14,5 cm ≈ 548 px).
  Satırlar baskıyla birebir kırılmaz (ekran yazısı ve puntosu başka
  olabilir), ama sütunun oranı baskıdakiyle aynıdır. Kılavuzu olmayan
  belgenin sayfa düzeni (varsayılan 2,5 cm) bir kılavuz kararı değildir:
  638 px kalır.

  Sınırlar (8–19 cm) son savunma: normalizeGuidelineEditorSettings kenar
  boşluklarını 0,5–8 cm'de tutuyor, ama A4'te sol 8 + sağ 8 = 5 cm'lik
  bir sütun bırakır; okunamaz bir ekrandansa varsayılan iyidir.
*/
export const VARSAYILAN_SUTUN_PX = 638;
const EN_AZ_CM = 8;
const EN_FAZLA_CM = 19;

export function belgeSutunuCm(girdi: {
  kilavuzOlcusuVar: boolean;
  margins: { left: number; right: number };
  pageSize: KagitBoyutu;
}): number | null {
  if (!girdi.kilavuzOlcusuVar) return null;
  const kagit = KAGITLAR[girdi.pageSize] ?? KAGITLAR.a4;
  const { left, right } = girdi.margins;
  if (!Number.isFinite(left) || !Number.isFinite(right)) return null;
  const cm = Math.round((kagit.genislikCm - left - right) * 100) / 100;
  return cm >= EN_AZ_CM && cm <= EN_FAZLA_CM ? cm : null;
}

/** CSS değişkeninin değeri (--belge-sutun); null: tasarımın varsayılanı. */
export function belgeSutunuDegeri(cm: number | null): string | null {
  return cm === null ? null : `${cm}cm`;
}
