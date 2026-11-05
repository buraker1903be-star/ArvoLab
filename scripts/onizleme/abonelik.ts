/*
  ÖNİZLEMENİN ABONELİK KÖPRÜSÜ (Signature OS 4.4, 05.11.2026).
  YALNIZCA YEREL ÖNİZLEME: ARVOLAB_ONIZLEME=1 ve ONIZLEME_ABONELIK=aktif|bitti
  iken next.config bu dosyayı "@/lib/subscription" yerine koyar
  (lib/onizleme-takmalari.ts); üretim derlemesinde bayrak açıksa derleme durur.

  Abonelik ve Kredi ekranının dolu hâlleri (plan kartı, ödeme düğmeleri, kredi
  paketleri, proforma ve ödeme listesi) ArvoOS köprüsü olmadan hiç
  görülemiyordu. Buradaki bütün tutarlar, numaralar ve tarihler UYDURMADIR:
  gerçek bir müşteriye, faturaya ya da ödemeye karşılık gelmez ve hiçbir
  yere yazılmaz. Ödeme başlatan işlevler gerçek modülden gelir; köprü
  ayarlı olmadığı için önizlemede ödeme başlamaz.
*/
import type { KurumFaturalamasi, SubscriptionState, KartSonucu } from "../../lib/subscription";
import type { KartDurumu } from "../../lib/kart-odeme";

export * from "../../lib/subscription";

const gun = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();
const gunAnahtari = (n: number) => gun(n).slice(0, 10);
const bitti = process.env.ONIZLEME_ABONELIK === "bitti";

const PAKETLER = [
  { kod: "ornek-1000", ad: "1.000 kredi", kredi: 1_000, fiyat: 19_900 },
  { kod: "ornek-2500", ad: "2.500 kredi", kredi: 2_500, fiyat: 44_900 },
  { kod: "ornek-6000", ad: "6.000 kredi", kredi: 6_000, fiyat: 99_900 },
];

export async function ensureSubscription(): Promise<SubscriptionState> {
  return {
    status: bitti ? "past_due" : "active",
    access: !bitti,
    trialEndsAt: null,
    currentPeriodEnd: bitti ? gun(-3) : gun(18),
    /* Yalnızca aylık: ArvoOS köprüsü bugün yıllık plan bildirmiyor ve tahsil etmiyor (lib/billing-plan.ts). */
    plans: [{ code: "ornek-aylik", interval: "month", price: 29_900 }],
    krediPaketleri: PAKETLER,
    cardStorage: false,
  };
}

export async function faturalamaVePaketler(): Promise<KurumFaturalamasi> {
  return {
    platformKurumu: false,
    krediPaketleri: [],
    faturalama: {
      toplamOdenen: 74_800,
      bekleyenTutar: 0,
      satici: null,
      proformalar: [
        {
          id: "ornek-proforma-1",
          no: "ÖRN-2026-0042",
          musteriAdi: "Deniz Yıldız",
          alici: null,
          kalemler: [{ aciklama: "ArvoLab aylık abonelik (örnek)", miktar: 1, birimFiyat: 24_917 }],
          araToplam: 24_917,
          kdvOrani: 20,
          kdv: 4_983,
          toplam: 29_900,
          paraBirimi: "TRY",
          duzenlemeTarihi: gunAnahtari(-1),
          gecerlilikTarihi: gunAnahtari(6),
          notlar: null,
          durum: "bekliyor",
          odemeId: null,
        },
      ],
      odemeler: [
        { id: "ornek-odeme-2", tarih: gun(-12), tutar: 44_900, paraBirimi: "TRY", tur: "kredi", durum: "odendi", kanal: "kart", donemBaslangic: null, donemBitis: null, referans: "ORNEK2", dekontUrl: null, fatura: null },
        { id: "ornek-odeme-1", tarih: gun(-42), tutar: 29_900, paraBirimi: "TRY", tur: "abonelik", durum: "odendi", kanal: "kart", donemBaslangic: gunAnahtari(-42), donemBitis: gunAnahtari(-12), referans: "ORNEK1", dekontUrl: null, fatura: null },
      ],
    },
  };
}

export async function faturalamaYukle() {
  return (await faturalamaVePaketler()).faturalama;
}

export async function kartDurumum(): Promise<KartSonucu<KartDurumu>> {
  return { ok: true, veri: { cards: [], autoRenew: null } };
}
