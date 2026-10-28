/*
  ARAYÜZ DİLİ (28.10.2026). Saf modül; testi tests/unit/dil.test.ts.

  ArvoLab dünya geneline satılacak; panel yalnızca Türkçeydi. Metinler
  ANAHTARLI bir katalogda değil, kullanıldıkları yerde iki dilde birden
  yazılıyor:

      t({ tr: "Belge yükle", en: "Upload document" })

  Neden: yaklaşık 4.300 metin var ve her birine anahtar uydurmak hem yavaş
  hem hataya açık (anahtarın ne dediğini görmek için ikinci bir dosyaya
  bakmak gerekiyor; kullanılmayan anahtarlar birikiyor). Türkçe metin
  kodun yanında kalıyor — depo üslubu böyle — ve tip sistemi her metnin
  iki dilde de yazıldığını zorunlu kılıyor. Üçüncü bir dil eklenirse
  `Metin` tipine bir alan eklenir; derleyici eksik çeviriyi tek tek
  gösterir.

  Dil ADRESTE değil çerezde (DIL_CEREZI): panel oturum arkasında, arama
  motoru görmüyor; /en/... önekleri bütün bağlantıları ikiye bölerdi.
  İlk ziyarette tarayıcının dili seçiliyor (proxy.ts), kullanıcı
  değiştirebiliyor.
*/

export const DILLER = ["tr", "en"] as const;
export type Dil = (typeof DILLER)[number];

/** Bir metnin bütün dillerdeki yazımı. */
export type Metin = Record<Dil, string>;

export const VARSAYILAN_DIL: Dil = "tr";

/*
  İNGİLİZCE YAYINDA (28.10.2026'da açıldı; çeviri tamamlandı).

  Açıkken dil seçici herkese görünür ve oturumu olmayan yeni ziyaretçiye
  tarayıcının dili sunulur. Mevcut müşterinin dili proxy.ts'te Türkçe'ye
  sabitleniyor: Türk öğrencilerin önemli bir kısmı İngilizce ayarlı
  tarayıcı kullanıyor, panelleri güncellemeyle birden İngilizceye dönmesin.
  Kapatılırsa (false) tarayıcı dili yok sayılır, seçici yalnızca iç ekipte.
*/
export const INGILIZCE_YAYINDA = true;
export const DIL_CEREZI = "arvolab_dil";

/* Kullanıcının saat dilimi (tarayıcıdan); yalnızca İngilizcede kullanılıyor. */
export const SAAT_DILIMI_CEREZI = "arvolab_tz";
export const VARSAYILAN_SAAT_DILIMI = "Europe/Istanbul";

/** Geçerli bir IANA saat dilimi mi? Bozuk çerez biçimleyiciyi düşürmesin. */
export function saatDilimiMi(deger: unknown): deger is string {
  if (typeof deger !== "string" || !deger || deger.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: deger });
    return true;
  } catch {
    return false;
  }
}

/** Dil adı, kendi dilinde (dil seçicide). */
export const DIL_ADLARI: Record<Dil, string> = { tr: "Türkçe", en: "English" };

/** Tarih/sayı biçimleri için BCP 47 etiketi. */
export const YEREL: Record<Dil, string> = { tr: "tr-TR", en: "en-US" };

export function dilMi(deger: unknown): deger is Dil {
  return typeof deger === "string" && (DILLER as readonly string[]).includes(deger);
}

/** Çerez değeri bozuk ya da yoksa varsayılan. */
export function dilOku(deger: string | null | undefined): Dil {
  return dilMi(deger) ? deger : VARSAYILAN_DIL;
}

/**
 * Accept-Language başlığından dil: Türkçe isteyen Türkçe, geri kalan herkes
 * İngilizce. Ürün Türkiye dışına İngilizceyle açılıyor; Almanca ya da
 * Arapça tarayıcıya Türkçe göstermek, İngilizceden daha az anlaşılır.
 * Başlık hiç yoksa (botlar, eski istemciler) varsayılan Türkçe.
 */
export function tarayicidanDil(acceptLanguage: string | null | undefined): Dil {
  if (!acceptLanguage?.trim()) return VARSAYILAN_DIL;
  const tercihler = acceptLanguage
    .split(",")
    .map((parca) => {
      const [etiket, ...ayarlar] = parca.trim().split(";");
      const q = ayarlar.map((a) => a.trim()).find((a) => a.startsWith("q="));
      return { etiket: etiket.trim().toLowerCase(), q: q ? Number(q.slice(2)) || 0 : 1 };
    })
    .filter((t) => t.etiket && t.etiket !== "*" && t.q > 0)
    .sort((a, b) => b.q - a.q);
  if (!tercihler.length) return VARSAYILAN_DIL;
  return tercihler[0].etiket.startsWith("tr") ? "tr" : "en";
}

/** Metnin seçili dildeki yazımı. */
export function sec(dil: Dil, metin: Metin): string {
  return metin[dil];
}

/** Bir dile bağlanmış çevirici: t({ tr, en }). */
export type Cevirici = (metin: Metin) => string;

export function ceviriciKur(dil: Dil): Cevirici {
  return (metin) => metin[dil];
}

/**
 * İlk ziyarette verilecek dil (proxy.ts). Çerez varsa karar verilmez (null).
 * Oturumu olan mevcut müşteri Türkçe kalır; yeni ziyaretçiye tarayıcının dili.
 */
export function ilkZiyaretDili(dilCerezi: string | undefined, oturumVar: boolean, acceptLanguage: string | null): Dil | null {
  if (dilCerezi) return null;
  return oturumVar ? "tr" : tarayicidanDil(acceptLanguage);
}
