/*
  GÖRÜNÜM ÖNİZLEMESİ (26.10.2026, kurum sahibinin isteği: "sistem
  yöneticisi tüm türden ekranı görebilmeli").

  Ana sayfa ve Çalışmalarım role ve kuruma göre farklı çiziliyor:
  personel çok çalışmalı genel bakışı, öğrenci tek tezini görüyor;
  kurumu olmayan öğrencide danışman yorumları yerine "Danışmanıma
  gönder" var. Sistem yöneticisi kendi hesabıyla yalnızca personel
  görünümünü görüyordu — öğrencinin ne gördüğünü bilmeden destek
  veremez, yeni ekranı deneyemez.

  Önizleme YALNIZCA DÜZENİ değiştirir: veriler yine yöneticinin kendi
  çalışmaları, rol ve yetkiler değişmez (RLS ve sunucu eylemleri
  gerçek rolle çalışıyor). Bu yüzden başkasının adına bir şey görme ya
  da yapma yolu açmıyor.

  Yalnızca iç ekip (system_admin, founder) önizleyebilir: Kontrolör ya
  da Akademik Yönetici için öğrenci düzeni, kendi işlerini (onay,
  atama) gizleyen bir tuzak olurdu.

  Saf modül; testi tests/unit/onizleme.test.ts.
*/

export const ONIZLEME_CEREZI = "arvolab_gorunum";

export type Gorunum = "personel" | "ogrenci_kurumlu" | "ogrenci_bireysel";

export const GORUNUM_ETIKETI: Record<Gorunum, string> = {
  personel: "Personel",
  ogrenci_kurumlu: "Öğrenci · kurum aboneliği",
  ogrenci_bireysel: "Öğrenci · bireysel abone",
};

export const GORUNUMLER = Object.keys(GORUNUM_ETIKETI) as Gorunum[];

const ONIZLEYEBILEN = ["system_admin", "founder"];

export const onizleyebilir = (rol: string | null | undefined) => Boolean(rol) && ONIZLEYEBILEN.includes(rol!);

export function gorunumMu(deger: unknown): deger is Gorunum {
  return typeof deger === "string" && Object.hasOwn(GORUNUM_ETIKETI, deger);
}

export type GorunumKarari = {
  /** Personel düzeni mi (çok çalışmalı liste, denetim şeridi)? */
  personel: boolean;
  /** Öğrenci düzeninde danışman sistemde değil mi (bireysel abone)? */
  bireysel: boolean;
  /** Önizleme etkinse seçilen görünüm; gerçek görünümde null. */
  onizleme: Gorunum | null;
};

/**
 * Sayfanın hangi düzende çizileceği. Önizleme çerezi yalnızca iç ekipte
 * dikkate alınır; başka bir rolde çerez olsa da (eski oturum, elle
 * yazılmış) yok sayılır.
 */
export function gorunumKarari(girdi: { rol: string | null | undefined; personelRolu: boolean; kurumVar: boolean; cerez: unknown }): GorunumKarari {
  const secilen = onizleyebilir(girdi.rol) && gorunumMu(girdi.cerez) && girdi.cerez !== "personel" ? girdi.cerez : null;
  if (secilen === "ogrenci_kurumlu") return { personel: false, bireysel: false, onizleme: secilen };
  if (secilen === "ogrenci_bireysel") return { personel: false, bireysel: true, onizleme: secilen };
  return { personel: girdi.personelRolu, bireysel: !girdi.personelRolu && !girdi.kurumVar, onizleme: null };
}
