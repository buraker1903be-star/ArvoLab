/*
  ÇALIŞMA ALANI YERLEŞİMİ (19.11.2026, bağlamlı çalışma alanı; onaylı 2. tur
  tasarımı). Yazım ekranında üç şey yer kapar: soldaki yuva (genel/çalışma
  gezinmesi ya da görevle genişleyen araç), belge ve sağdaki TEK yardımcı
  panel (Arvo AI ya da PDF). Hangisinin nasıl duracağı burada, saf olarak
  verilir; editör yalnızca uygular. Testi tests/unit/calisma-alani-yerlesimi.test.ts.

  BELGE YENİDEN AKMAZ, ÖLÇEKLENİR. 18.11.2026'ya kadar PDF paneli açılınca
  belge sütunu daralıyor, iki yana yaslı satırlarda boşluklar açılıyordu
  (kurum sahibinin incelemesi, 2. tur, 3. madde). Masaüstünde kâğıt doğal
  genişliğinde (KAGIT_GENISLIGI) kalır ve sığmazsa görsel olarak küçülür;
  satır sonları, punto ve sayfa biçimi değişmez, dışa aktarma etkilenmez.

  OKUNABİLİRLİK SINIRI. Otomatik küçültmenin bir HEDEFİ yok; bir sınırı var
  (BELGE_OKUNUR_EN_AZ). Belge o sınırın altına inmeden önce sıra şudur (prototipteki sıra):
    1. sağ panel kendi en dar genişliğine iner (PDF 520 → 440),
    2. sol yuva gezinme gösteriyorsa gezinme raya iner,
    3. yetmezse sağ panel belgenin üstüne ÇEKMECE olur (belge tam genişliğe döner).
  Sol araç açıkken (bölümler, kaynaklar, makale arama) kullanıcı o aracı
  bilerek açmıştır: araç daraltılmaz, yer gerekirse sağ panel çekmeceye geçer.
  Kullanıcı ölçeği her zaman kendisi seçebilir (BELGE_OLCEK_*); seçtiği ölçek
  bu kararı değiştirmez, yalnızca kâğıdın büyüklüğünü.

  İNCELEME PANELİ (19.11.2026, kabul turu). Kontroller menüsünden açılan
  inceleme paneli (teslim kontrolü, kılavuz, kaynakça, yorumlar) de sağ
  yuvanın bir sakini: sağ panel (AI/PDF) açıkken gösterilmez, aynı anda iki
  sağ sütun belgeyi okunmaz kılar. İlk sürüm paneli bu kararın DIŞINDA
  bırakmıştı; sağ panel yokken 340 px'lik sütunu hesaba katılmadığı için
  belge 1440 px'te %84'e, 1280 px'te %66'ya, sol araç da açıkken %60'a
  iniyordu (tarayıcı ölçümü). Artık aynı sıra uygulanır: önce gezinme raya
  iner, yetmezse panel belgenin üstüne çekmece olur.

  Tablet ve telefonda belge eskisi gibi akar (ekranın kendisi dar; paneller
  zaten belgenin üstünde açılıyor). Kırılımlar lib/os/kirilimlar.ts ile aynı.
*/

import type { SagPanel, SolArac } from "@/lib/os/uygulamalar";

/** Kâğıdın ekrandaki doğal genişliği: 860 px yazı sütunu + iki yanda 32 px boşluk (workspace.css, sabit kâğıt). */
export const KAGIT_GENISLIGI = 924;
/** Otomatik küçültmenin alt sınırı. Altına inilecekse önce gezinme raya iner, sonra sağ panel çekmeceye geçer. */
export const BELGE_OKUNUR_EN_AZ = 0.85;

export const KENAR_GENIS = 240;
export const KENAR_RAY = 64;
/** Sol araçların genişliği (talimattaki aralıkların içinde: liste 280–320, arama 340–400). */
export const SOL_ARAC_GENISLIGI: Record<SolArac, number> = { bolumler: 300, kaynaklar: 300, arama: 372, kaynakca: 300, kilavuz: 300 };

/** Sağ panelin sınırları (talimat: AI 360–420, PDF 440–600). */
export const SAG_PANEL_SINIRI: Record<SagPanel, { enAz: number; varsayilan: number; enCok: number }> = {
  ai: { enAz: 360, varsayilan: 396, enCok: 420 },
  pdf: { enAz: 440, varsayilan: 520, enCok: 600 },
};
/** İnceleme panelinin sütun genişliği ve belgeyle arası (workspace.css, .manuscript-layout). */
export const INCELEME_GENISLIGI = 340;
export const INCELEME_ARALIGI = 16;
/** Ayırıcı (10 px) ve iki sütun aralığı (8 px). */
export const AYIRICI_PAYI = 26;
/** İçerik alanının iki yandaki boşluğu (dashboard-page). */
export const SAYFA_PAYI = 64;

export const MASAUSTU_EN_AZ = 1200;

export function sagPanelGenisligiSinirla(panel: SagPanel, istenen: number): number {
  const s = SAG_PANEL_SINIRI[panel];
  const deger = Number.isFinite(istenen) && istenen > 0 ? istenen : s.varsayilan;
  return Math.round(Math.min(s.enCok, Math.max(s.enAz, deger)));
}

export type YerlesimKarari = {
  /** Sol yuva: tam gezinme, ray (yalnızca simge) ya da açık araç. */
  kenar: "tam" | "ray" | "arac";
  /** Sağ panel: yok, belgenin yanında sütun ya da belgenin üstünde çekmece. */
  sag: "yok" | "sutun" | "cekmece";
  /** Kâğıdın otomatik ölçeği (Sığdır); 1 = doğal boy. Tablet ve telefonda her zaman 1 (belge akar). */
  olcek: number;
  /** Kâğıt sabit genişlikte mi (masaüstü) yoksa akıyor mu (tablet, telefon). */
  sabitKagit: boolean;
  /** Sağ panelin uygulanacak genişliği (sütunsa daralmış olabilir). */
  sagGenislik: number;
  /** Ayırıcıyla çekilebilecek en geniş değer: belgeyi okunabilirlik sınırının altına itmeyen genişlik. */
  sagEnCok: number;
  /**
   * İnceleme paneli: yok (kapalı ya da sağ panel açık), belgenin yanında sütun,
   * belgenin üstünde çekmece ya da akış (tablet/telefon: belgenin üstünde/altında, eski yerleşim).
   */
  inceleme: "yok" | "sutun" | "cekmece" | "akis";
};

export function yerlesimKarari(girdi: {
  ekran: number;
  solArac: SolArac | null;
  sagPanel: SagPanel | null;
  sagGenislik: number;
  /** Kullanıcı kenar çubuğunu kendisi daraltmış mı (arvolab.gezinme.dar). */
  kenarDar: boolean;
  /** İnceleme paneli açık mı (kullanıcının tercihi). Verilmezse kapalı sayılır. */
  inceleme?: boolean;
}): YerlesimKarari {
  const { ekran, solArac, sagPanel } = girdi;
  const incelemeIstendi = Boolean(girdi.inceleme) && !sagPanel;
  const istenenSag = sagPanel ? sagPanelGenisligiSinirla(sagPanel, girdi.sagGenislik) : 0;
  if (ekran < MASAUSTU_EN_AZ) {
    return {
      kenar: solArac ? "arac" : "ray",
      sag: sagPanel ? "cekmece" : "yok",
      olcek: 1,
      sabitKagit: false,
      sagGenislik: istenenSag,
      sagEnCok: sagPanel ? SAG_PANEL_SINIRI[sagPanel].enCok : 0,
      inceleme: incelemeIstendi ? "akis" : "yok",
    };
  }
  const olcekFor = (sol: number, sag: number) => Math.min(1, (ekran - sol - (sag ? sag + AYIRICI_PAYI : 0) - SAYFA_PAYI) / KAGIT_GENISLIGI);
  const kenar: YerlesimKarari["kenar"] = solArac ? "arac" : girdi.kenarDar ? "ray" : "tam";
  const solEn = solArac ? SOL_ARAC_GENISLIGI[solArac] : girdi.kenarDar ? KENAR_RAY : KENAR_GENIS;

  if (!sagPanel) {
    if (incelemeIstendi) {
      const olcekInceleme = (sol: number) => Math.min(1, (ekran - sol - INCELEME_GENISLIGI - INCELEME_ARALIGI - SAYFA_PAYI) / KAGIT_GENISLIGI);
      const denemeler: [YerlesimKarari["kenar"], number][] = [[kenar, solEn], ...(kenar === "tam" ? ([["ray", KENAR_RAY]] as [YerlesimKarari["kenar"], number][]) : [])];
      for (const [k, sol] of denemeler) {
        const o = olcekInceleme(sol);
        if (o >= BELGE_OKUNUR_EN_AZ) return { kenar: k, sag: "yok", olcek: yuvarla(o), sabitKagit: true, sagGenislik: 0, sagEnCok: 0, inceleme: "sutun" };
      }
      /* Sol araç kullanıcının seçimi, daraltılmaz (sağ panelde olduğu gibi); yer yoksa inceleme paneli çekmeceye geçer. */
      return { kenar, sag: "yok", olcek: yuvarla(Math.max(olcekFor(solEn, 0), 0.5)), sabitKagit: true, sagGenislik: 0, sagEnCok: 0, inceleme: "cekmece" };
    }
    /* Sağ panel yokken belge sınırın altına inebilir (ör. 1200 px'te açık arama aracı): araç kullanıcının seçimi; belge yine akmaz. */
    return { kenar, sag: "yok", olcek: yuvarla(Math.max(olcekFor(solEn, 0), 0.5)), sabitKagit: true, sagGenislik: 0, sagEnCok: 0, inceleme: "yok" };
  }
  const enDar = SAG_PANEL_SINIRI[sagPanel].enAz;
  const sinir = SAG_PANEL_SINIRI[sagPanel];
  const denemeler: [YerlesimKarari["kenar"], number, number][] = [
    [kenar, solEn, istenenSag],
    [kenar, solEn, enDar],
    ...(kenar === "tam"
      ? ([
          ["ray", KENAR_RAY, istenenSag],
          ["ray", KENAR_RAY, enDar],
        ] as [YerlesimKarari["kenar"], number, number][])
      : []),
  ];
  for (const [k, sol, sag] of denemeler) {
    const o = olcekFor(sol, sag);
    if (o >= BELGE_OKUNUR_EN_AZ) {
      const pay = Math.floor(ekran - sol - AYIRICI_PAYI - SAYFA_PAYI - BELGE_OKUNUR_EN_AZ * KAGIT_GENISLIGI);
      return { kenar: k, sag: "sutun", olcek: yuvarla(o), sabitKagit: true, sagGenislik: sag, sagEnCok: Math.max(sinir.enAz, Math.min(sinir.enCok, pay)), inceleme: "yok" };
    }
  }
  return { kenar, sag: "cekmece", olcek: yuvarla(Math.max(olcekFor(solEn, 0), 0.5)), sabitKagit: true, sagGenislik: istenenSag, sagEnCok: sinir.enCok, inceleme: "yok" };
}

/* ---- Kullanıcının seçtiği ölçek ---- */
export const BELGE_OLCEK_EN_AZ = 0.5;
export const BELGE_OLCEK_EN_COK = 2;
export const BELGE_OLCEK_ADIM = 0.1;
/** "sigdir": otomatik (yukarıdaki karar); sayı: kullanıcının seçtiği sabit ölçek. */
export type OlcekTercihi = "sigdir" | number;

export function olcekTercihiOku(ham: unknown): OlcekTercihi {
  if (ham === "sigdir" || ham === null || ham === undefined || ham === "") return "sigdir";
  const n = Number(ham);
  if (!Number.isFinite(n)) return "sigdir";
  return yuvarla(Math.min(BELGE_OLCEK_EN_COK, Math.max(BELGE_OLCEK_EN_AZ, n)));
}

/** −/+ düğmesi: mevcut (otomatik ya da seçili) ölçekten bir adım. */
export function olcekAdimi(mevcut: number, yon: 1 | -1): number {
  const hedef = Math.round((mevcut + yon * BELGE_OLCEK_ADIM) * 10) / 10;
  return yuvarla(Math.min(BELGE_OLCEK_EN_COK, Math.max(BELGE_OLCEK_EN_AZ, hedef)));
}

export function gecerliOlcek(tercih: OlcekTercihi, otomatik: number): number {
  return tercih === "sigdir" ? otomatik : tercih;
}

function yuvarla(n: number): number {
  return Math.round(n * 100) / 100;
}
