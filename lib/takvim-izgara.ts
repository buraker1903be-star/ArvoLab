/*
  TARİH SEÇİCİNİN TAKVİM HESABI (28.10.2026). Saf modül; testi
  tests/unit/takvim-izgara.test.ts. Bileşen: app/dashboard/_components/tarih-secici.tsx.

  Bütün hesap "YYYY-AA-GG" gün anahtarı üzerinde ve UTC'de: seçilen şey bir
  AN değil bir GÜN. Yerel saatle `new Date(y, a, g)` kurmak yaz saati
  geçişinde (Türkiye'de artık yok ama İngilizce kullanıcı dünyanın her
  yerinde) bir günü iki kez ya da hiç saymaya açık.
*/

export type GunAnahtari = string;

const GECERLI = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "2026-10-28" → UTC gece yarısı; geçersizse null. */
export function anahtardanTarih(anahtar: string | null | undefined): Date | null {
  const m = anahtar ? GECERLI.exec(anahtar) : null;
  if (!m) return null;
  const tarih = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  /* 2026-02-30 gibi taşan günleri reddet. */
  return gunAnahtari(tarih) === anahtar ? tarih : null;
}

export function gunAnahtari(tarih: Date): GunAnahtari {
  return tarih.toISOString().slice(0, 10);
}

export function gunEkle(anahtar: GunAnahtari, gun: number): GunAnahtari {
  const t = anahtardanTarih(anahtar);
  if (!t) return anahtar;
  t.setUTCDate(t.getUTCDate() + gun);
  return gunAnahtari(t);
}

/**
 * Ay ekler; hedef ayda o gün yoksa ayın son gününe iner
 * (31 Ocak + 1 ay = 28/29 Şubat, 3 Mart değil).
 */
export function ayEkle(anahtar: GunAnahtari, ay: number): GunAnahtari {
  const t = anahtardanTarih(anahtar);
  if (!t) return anahtar;
  const hedef = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + ay, 1));
  const sonGun = new Date(Date.UTC(hedef.getUTCFullYear(), hedef.getUTCMonth() + 1, 0)).getUTCDate();
  hedef.setUTCDate(Math.min(t.getUTCDate(), sonGun));
  return gunAnahtari(hedef);
}

/** Ayın ilk günü ("2026-10-01"). */
export function ayBasi(anahtar: GunAnahtari): GunAnahtari {
  return `${anahtar.slice(0, 7)}-01`;
}

export interface IzgaraGunu {
  anahtar: GunAnahtari;
  gun: number;
  /** Gösterilen aya mı ait (önceki/sonraki ayın taşan günleri soluk). */
  buAy: boolean;
}

/**
 * Ayın takvim ızgarası: her zaman 6 hafta × 7 gün, böylece ay değişince
 * kutu zıplamıyor. `haftaBasi` 1 = Pazartesi (Türkçe, ISO), 0 = Pazar (ABD).
 */
export function ayIzgarasi(ayIcindenBirGun: GunAnahtari, haftaBasi: 0 | 1): IzgaraGunu[] {
  const ilk = anahtardanTarih(ayBasi(ayIcindenBirGun));
  if (!ilk) return [];
  const geri = (ilk.getUTCDay() - haftaBasi + 7) % 7;
  const ay = ilk.getUTCMonth();
  const bas = gunEkle(gunAnahtari(ilk), -geri);
  return Array.from({ length: 42 }, (_, i) => {
    const anahtar = gunEkle(bas, i);
    const t = anahtardanTarih(anahtar)!;
    return { anahtar, gun: t.getUTCDate(), buAy: t.getUTCMonth() === ay };
  });
}

/** Sınırların dışında mı? (anahtarlar sözlük sırasıyla karşılaştırılabilir) */
export function sinirDisi(anahtar: GunAnahtari, enAz?: string | null, enCok?: string | null): boolean {
  return Boolean((enAz && anahtar < enAz) || (enCok && anahtar > enCok));
}

/** İki gün arasındaki fark (b − a), gün olarak. */
export function gunFarki(a: GunAnahtari, b: GunAnahtari): number {
  const x = anahtardanTarih(a);
  const y = anahtardanTarih(b);
  if (!x || !y) return 0;
  return Math.round((y.getTime() - x.getTime()) / 86_400_000);
}
