/*
  SATIR İÇİ ÖNERİNİN SIKLIĞI VE ÖNBELLEĞİ (21.11.2026). Saf modül:
  denetleyici (app/dashboard/editor/[id]/write/satir-ici-oneri.tsx) karar
  için buraya sorar, birim testi (tests/unit/oneri-zamanlama.test.ts) de.

  Neden: otomatik öneri, yazma her 1,5 sn durduğunda istek atıyordu.
  Gerçekçi bir yazma temposunda (harf başına 110–180 ms, cümle sonunda
  2,5 sn duraksama) dakikada 6,6 istek ölçüldü; sohbetle ORTAK saatlik 20
  hak yaklaşık 3 dakikada bitiyordu. Kural artık: ilk otomatik istekten
  sonra yeni bir otomatik istek için son istekten bu yana en az 40 yeni
  karakter yazılmış ve en az 8 sn geçmiş olmalı. Süre dolmadan duraklanırsa
  istek süre dolunca gider (öğrenci beklemeye devam ediyorsa), karakter
  eşiği tutmuyorsa hiç gitmez. Elle istek (Alt+/) bu kurala bağlı değil;
  yalnızca sunucunun sınırlarına (en az aralık, saatlik hak, kredi) tabi.
*/
export const OTOMATIK_EN_AZ_YENI_KARAKTER = 40;
export const OTOMATIK_EN_AZ_ARALIK_MS = 8_000;

export type OtomatikKarar = { tur: "gonder" } | { tur: "bekle"; ms: number } | { tur: "yok" };

export function otomatikIstekKarari(girdi: {
  simdi: number;
  /** Son öneri isteğinin (otomatik ya da elle) zamanı; hiç istek yoksa null. */
  sonIstek: number | null;
  /** Son istekten bu yana yazılan karakter sayısı. */
  yeniKarakter: number;
}): OtomatikKarar {
  // İlk öneri: ilk cümlesini yazan öğrenci beklemeden görsün (eşik yalnızca metnin uzunluğu, denetleyicide).
  if (girdi.sonIstek === null) return { tur: "gonder" };
  if (girdi.yeniKarakter < OTOMATIK_EN_AZ_YENI_KARAKTER) return { tur: "yok" };
  const gecen = girdi.simdi - girdi.sonIstek;
  if (gecen < OTOMATIK_EN_AZ_ARALIK_MS) return { tur: "bekle", ms: OTOMATIK_EN_AZ_ARALIK_MS - gecen };
  return { tur: "gonder" };
}

/*
  ÖNBELLEK. Anahtar sunucuya giden bağlamın TAMAMI: çalışma, belge dili,
  atıf stili, imlecin bölümü, imleç konumu ve imleçten önceki metnin
  tamamı (denetleyicinin gönderdiği 4.000 karaktere kadar). Son 200
  karakter gibi bir parça anahtar OLMAZ: aynı cümle sonu başka bir
  paragrafta, başka bir belgede ya da başka dilde geçebilir ve o bağlama
  ait öneri yanlış yere düşerdi. Önbellekten gelen öneri de sunucudan
  gelen gibi yalnızca SÜSLEME olarak gösterilir; belgeye girmesi
  kullanıcının kabulüdür (Tab / dokunma).
*/
export type OneriBaglami = {
  calisma: string;
  belgeDili: string;
  atifStili: string;
  bolum: string | null;
  konum: number;
  oncesi: string;
};
export type OnbellekKaydi = { metin: string; kayit: string | null };

export function oneriAnahtari(b: OneriBaglami): string {
  return JSON.stringify([b.calisma, b.belgeDili, b.atifStili, b.bolum ?? "", b.konum, b.oncesi]);
}

export class OneriOnbellegi {
  private readonly kayitlar = new Map<string, { deger: OnbellekKaydi; zaman: number }>();
  private readonly enCok: number;
  private readonly omurMs: number;

  constructor(enCok = 30, omurMs = 10 * 60_000) {
    this.enCok = enCok;
    this.omurMs = omurMs;
  }

  al(b: OneriBaglami, simdi = Date.now()): OnbellekKaydi | null {
    const anahtar = oneriAnahtari(b);
    const k = this.kayitlar.get(anahtar);
    if (!k) return null;
    if (simdi - k.zaman > this.omurMs) {
      this.kayitlar.delete(anahtar);
      return null;
    }
    // En son kullanılan sona: taşınca en eski düşer.
    this.kayitlar.delete(anahtar);
    this.kayitlar.set(anahtar, k);
    return k.deger;
  }

  koy(b: OneriBaglami, deger: OnbellekKaydi, simdi = Date.now()): void {
    const anahtar = oneriAnahtari(b);
    this.kayitlar.delete(anahtar);
    this.kayitlar.set(anahtar, { deger, zaman: simdi });
    while (this.kayitlar.size > this.enCok) {
      const ilk = this.kayitlar.keys().next().value;
      if (ilk === undefined) break;
      this.kayitlar.delete(ilk);
    }
  }

  get boyut(): number {
    return this.kayitlar.size;
  }
}
