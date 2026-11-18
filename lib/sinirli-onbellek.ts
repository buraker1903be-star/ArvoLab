/*
  SINIRLI ÖNBELLEK (17.11.2026, RELEASE CLOSURE 05). Saf modül; testi
  tests/unit/sinirli-onbellek.test.ts. Kaynak PDF'lerinin çıkarılmış sayfa
  metni için kullanılıyor (lib/kaynak-pdf-okuma.ts): aynı PDF'te art arda
  seçim yapan öğrenci her seferinde 20 MB'ı yeniden indirip çözümletmesin.

  Üç sınır birden, çünkü her biri tek başına bir riski açık bırakıyor:
  - kayıt sayısı: çok sayıda küçük PDF belleği şişirmesin;
  - toplam birim (karakter): az sayıda dev PDF de şişirmesin; tek başına
    bütçeyi aşan değer hiç saklanmaz;
  - ömür: süre dolunca kayıt okunmaz (sunucu süreci uzun yaşasa da).
  En az kullanılan önce çıkar (Map ekleme sırası; okunan kayıt sona taşınır).

  YETKİ BU MODÜLDE DEĞİL: önbellek bir değeri anahtarıyla verir, kime
  verdiğini bilmez. Çağıran, değeri döndürmeden ÖNCE erişimi kullanıcının
  kendi istemcisiyle doğrulamalı (kaynak-pdf-okuma.ts bunu her okumada yapar).
*/

export type OnbellekSecenek<T> = {
  enCokKayit: number;
  enCokBirim: number;
  omurMs: number;
  birim: (deger: T) => number;
  simdi?: () => number;
};

export class SinirliOnbellek<T> {
  private readonly kayitlar = new Map<string, { deger: T; birim: number; bitis: number }>();
  private toplam = 0;
  private readonly s: OnbellekSecenek<T>;
  // Parametre özelliği (constructor(private s)) yazılmadı: testler Node'un tip silme kipinde koşuyor ve onu desteklemiyor.
  constructor(secenek: OnbellekSecenek<T>) {
    this.s = secenek;
  }

  private zaman() {
    return (this.s.simdi ?? Date.now)();
  }

  get(anahtar: string): T | undefined {
    const k = this.kayitlar.get(anahtar);
    if (!k) return undefined;
    if (k.bitis <= this.zaman()) {
      this.sil(anahtar);
      return undefined;
    }
    this.kayitlar.delete(anahtar);
    this.kayitlar.set(anahtar, k);
    return k.deger;
  }

  set(anahtar: string, deger: T): boolean {
    const birim = Math.max(0, this.s.birim(deger));
    this.sil(anahtar);
    if (birim > this.s.enCokBirim || this.s.enCokKayit < 1) return false;
    while (this.kayitlar.size >= this.s.enCokKayit || this.toplam + birim > this.s.enCokBirim) {
      const enEski = this.kayitlar.keys().next().value;
      if (enEski === undefined) break;
      this.sil(enEski);
    }
    this.kayitlar.set(anahtar, { deger, birim, bitis: this.zaman() + this.s.omurMs });
    this.toplam += birim;
    return true;
  }

  sil(anahtar: string): void {
    const k = this.kayitlar.get(anahtar);
    if (!k) return;
    this.toplam -= k.birim;
    this.kayitlar.delete(anahtar);
  }

  get boyut() {
    return this.kayitlar.size;
  }
  get toplamBirim() {
    return this.toplam;
  }
}
