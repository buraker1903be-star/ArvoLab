/*
  Kanıt kaydının doğrulama durumları, kanıt zinciri ve kanıt matrisi.

  DURUMLAR BİRBİRİNİN YERİNE GEÇMEZ. Her biri ayrı bir kontrolün sonucu
  ve ayrı bir sütundan okunuyor (migration 20261026065320):
    - künye doğrulandı      → kaynak VAR ve bilgileri tutuyor; iddiayı
                              desteklediği anlamına GELMEZ
    - bölüm/tam metin incelendi → kullanıcının eklediği metne bakıldı
    - ilgili kanıt bulundu  → o metinden bir alıntı kaydedildi
    - iddia ile uyumlu      → değerlendirme (otomatik ya da kullanıcı);
                              bulgunun bilimsel olarak doğru olduğunu
                              GÖSTERMEZ
  Tek bir yüzde ya da tek bir "doğrulandı" rozeti bunları birbirine
  karıştırırdı; bilerek yok.

  Saf modül; testi tests/unit/kanit-durum.test.ts.
*/

export type KunyeDurumu = "bakilmadi" | "dogrulandi" | "kismen" | "uyusmuyor" | "dogrulanamadi";
export type ErisimDurumu = "bilinmiyor" | "acik_erisim" | "acik_erisim_yok";
export type DestekDuzeyi = "degerlendirilmedi" | "dogrudan" | "kismen" | "dolayli" | "celisiyor" | "dogrulanamadi";

/** Kanıt matrisinde ve zincirde kullanılan alanlar (kanit_kayitlari satırı). */
export type KanitKaydi = {
  id: string;
  iddia: string;
  bolum: string | null;
  atif: string | null;
  kaynak_id: string | null;
  kunye_durumu: KunyeDurumu;
  kunye_kaynagi: "crossref" | "openalex" | null;
  kunye_bakildi: string | null;
  kunye_ayrintisi?: unknown;
  erisim_durumu: ErisimDurumu;
  erisim_adresi: string | null;
  incelenen_metin: string | null;
  incelenen_kapsam: "bolum" | "tam_metin" | null;
  incelenen_surum: string | null;
  konum: string | null;
  alinti: string | null;
  destek_duzeyi: DestekDuzeyi;
  degerlendiren: "asistan" | "kullanici" | null;
  gerekce: string | null;
  degerlendirildi: string | null;
  insan_incelemesi: "bekliyor" | "yapildi";
  celisen: string | null;
  eksik_kanit: string | null;
  duzeltme: string | null;
};

/** Zincirde gösterilen kaynak bilgisi (literature_sources satırı). */
export type KaynakOzeti = {
  id: string;
  title: string;
  authors: string | null;
  year: string | null;
  container_title: string | null;
  doi_or_url: string | null;
};

export const DESTEK_ETIKETI: Record<DestekDuzeyi, string> = {
  degerlendirilmedi: "Değerlendirilmedi",
  dogrudan: "Doğrudan destekleniyor",
  kismen: "Kısmen destekleniyor",
  dolayli: "Dolaylı destek",
  celisiyor: "Çelişiyor",
  dogrulanamadi: "Doğrulanamadı",
};

export const DESTEK_ACIKLAMASI: Record<DestekDuzeyi, string> = {
  degerlendirilmedi: "İddia ile kanıt henüz karşılaştırılmadı.",
  dogrudan: "Erişilebilir kanıt iddiayı açıkça destekliyor.",
  kismen: "Kaynak iddianın yalnızca belirli bir kısmını destekliyor.",
  dolayli: "Kaynak ilgili arka planı sağlıyor ama iddiayı doğrudan doğrulamıyor.",
  celisiyor: "İncelenen kanıt iddiayla çelişiyor.",
  dogrulanamadi: "Mevcut kanıt bir sonuca ulaşmaya yetmiyor.",
};

export const KUNYE_ETIKETI: Record<KunyeDurumu, string> = {
  bakilmadi: "Künyeye bakılmadı",
  dogrulandi: "Kaynak kaydı doğrulandı",
  kismen: "Bibliyografik bilgiler kısmen doğrulandı",
  uyusmuyor: "Künye dizindeki kayıtla uyuşmuyor",
  dogrulanamadi: "Kaynak kaydı doğrulanamadı",
};

export type Ton = "success" | "warning" | "danger" | "info" | "neutral";

export const DESTEK_TONU: Record<DestekDuzeyi, Ton> = {
  degerlendirilmedi: "neutral",
  dogrudan: "success",
  kismen: "warning",
  dolayli: "info",
  celisiyor: "danger",
  dogrulanamadi: "neutral",
};

export type Rozet = { anahtar: string; etiket: string; ton: Ton; aciklama: string };

/** Destek düzeyi metinsiz verilmiş görünüyorsa (eski/bozuk satır) hüküm yok sayılır. */
export function gecerliDestek(k: Pick<KanitKaydi, "destek_duzeyi" | "incelenen_metin" | "alinti">): DestekDuzeyi {
  if (k.destek_duzeyi === "degerlendirilmedi" || k.destek_duzeyi === "dogrulanamadi") return k.destek_duzeyi;
  return k.incelenen_metin && k.alinti ? k.destek_duzeyi : "dogrulanamadi";
}

/** Bölüm 8'deki durumlar: her biri ayrı bir kontrolün sonucu. */
export function durumRozetleri(k: KanitKaydi): Rozet[] {
  const rozetler: Rozet[] = [];
  const dizin = k.kunye_kaynagi === "openalex" ? "OpenAlex" : "Crossref";

  if (k.kunye_durumu === "dogrulandi")
    rozetler.push({ anahtar: "kunye", etiket: KUNYE_ETIKETI.dogrulandi, ton: "success", aciklama: `${dizin} kaydıyla başlık, yıl ve ilk yazar eşleşti. Bu, kaynağın iddiayı desteklediğini göstermez.` });
  else if (k.kunye_durumu === "kismen")
    rozetler.push({ anahtar: "kunye", etiket: KUNYE_ETIKETI.kismen, ton: "warning", aciklama: `${dizin} kaydında bazı alanlar uyuşmuyor ya da karşılaştırılamadı.` });
  else if (k.kunye_durumu === "uyusmuyor")
    rozetler.push({ anahtar: "kunye", etiket: KUNYE_ETIKETI.uyusmuyor, ton: "danger", aciklama: "Dizindeki kaydın başlığı sizin künyenizle uyuşmuyor." });
  else if (k.kunye_durumu === "dogrulanamadi")
    rozetler.push({ anahtar: "kunye", etiket: KUNYE_ETIKETI.dogrulanamadi, ton: "neutral", aciklama: "Dizinde kayıt bulunamadı. Bu, kaynağın sahte olduğunu kanıtlamaz; başka bir dizinde ya da yayıncı sayfasında kontrol edin." });

  if (k.incelenen_metin) {
    rozetler.push(
      k.incelenen_kapsam === "tam_metin"
        ? { anahtar: "metin", etiket: "Tam metin incelendi", ton: "info", aciklama: "Kullanıcının beyanına göre eklenen metin kaynağın tamamı." }
        : { anahtar: "metin", etiket: "İlgili bölüm incelendi", ton: "info", aciklama: "Yalnızca eklenen bölüme bakıldı; kaynağın geri kalanı incelenmedi." },
    );
  }
  if (k.alinti) rozetler.push({ anahtar: "kanit", etiket: "İlgili kanıt bulundu", ton: "info", aciklama: "İncelenen metinden bir alıntı kaydedildi." });

  const destek = gecerliDestek(k);
  if (destek === "dogrudan" || destek === "kismen")
    rozetler.push({ anahtar: "uyum", etiket: destek === "dogrudan" ? "İddia ile kanıt uyumlu görünüyor" : "İddia ile kanıt kısmen uyumlu", ton: DESTEK_TONU[destek], aciklama: "Bu bir değerlendirmedir; bulgunun bilimsel olarak doğru olduğunu göstermez." });
  else if (destek === "dolayli")
    rozetler.push({ anahtar: "uyum", etiket: "Yalnızca dolaylı destek", ton: "info", aciklama: DESTEK_ACIKLAMASI.dolayli });
  else if (destek === "celisiyor")
    rozetler.push({ anahtar: "uyum", etiket: "Çelişen kanıt bulundu", ton: "danger", aciklama: DESTEK_ACIKLAMASI.celisiyor });
  else if (destek === "dogrulanamadi")
    rozetler.push({ anahtar: "uyum", etiket: "Doğrulanamadı", ton: "neutral", aciklama: DESTEK_ACIKLAMASI.dogrulanamadi });

  if (!k.incelenen_metin && k.erisim_durumu !== "acik_erisim")
    rozetler.push({ anahtar: "erisim", etiket: "Doğrulama için erişim yetersiz", ton: "warning", aciklama: "Kaynağın metni eklenmedi ve açık erişimli bir tam metin bilinmiyor." });

  if (insanIncelemesiOneriliyor(k))
    rozetler.push({ anahtar: "insan", etiket: "İnsan incelemesi öneriliyor", ton: "warning", aciklama: insanIncelemesiNedeni(k) });

  return rozetler;
}

export function insanIncelemesiOneriliyor(k: KanitKaydi): boolean {
  if (k.insan_incelemesi === "yapildi") return false;
  const destek = gecerliDestek(k);
  return (
    k.degerlendiren === "asistan" ||
    destek === "celisiyor" ||
    k.kunye_durumu === "uyusmuyor" ||
    k.kunye_durumu === "kismen"
  );
}

function insanIncelemesiNedeni(k: KanitKaydi): string {
  if (gecerliDestek(k) === "celisiyor") return "Kanıt iddiayla çelişiyor görünüyor; iddiayı yeniden ele alın.";
  if (k.kunye_durumu === "uyusmuyor" || k.kunye_durumu === "kismen") return "Künye dizindeki kayıtla tam uyuşmuyor; kaynakçanızı kontrol edin.";
  return "Uyum değerlendirmesini otomatik sistem yaptı; nihai akademik hüküm değildir.";
}

// ---------- Kanıt zinciri ----------

export type HalkaDurumu = "tamam" | "kismi" | "eksik";
export type Halka = {
  anahtar: "iddia" | "atif" | "kaynak" | "yayin" | "kanit" | "sonuc";
  baslik: string;
  durum: HalkaDurumu;
  /** Halkanın içeriği (iddia metni, atıf, künye…) ya da neden eksik olduğu. */
  metin: string;
  adres?: string | null;
};

/**
 * Akademik iddia → Metin içi atıf → Kaynak kaydı → Özgün yayın → İlgili kanıt → Doğrulama sonucu
 *
 * Eksik halka eksik olarak gösterilir, boş bırakılmaz ya da tahminle
 * doldurulmaz: sayfa numarası yoksa "konum belirtilmedi" yazar.
 */
export function kanitZinciri(k: KanitKaydi, kaynak: KaynakOzeti | null): Halka[] {
  const destek = gecerliDestek(k);
  const yayinAdresi =
    (k.kunye_ayrintisi as { adres?: string | null } | null | undefined)?.adres ??
    (kaynak?.doi_or_url && /^https?:\/\//.test(kaynak.doi_or_url) ? kaynak.doi_or_url : kaynak?.doi_or_url ? `https://doi.org/${kaynak.doi_or_url.replace(/^doi:\s*/i, "")}` : null);

  return [
    { anahtar: "iddia", baslik: "Akademik iddia", durum: "tamam", metin: k.bolum ? `${k.iddia} (${k.bolum})` : k.iddia },
    k.atif
      ? { anahtar: "atif", baslik: "Metin içi atıf", durum: "tamam", metin: k.atif }
      : { anahtar: "atif", baslik: "Metin içi atıf", durum: "eksik", metin: "İddiaya bir atıf girilmedi." },
    kaynak
      ? { anahtar: "kaynak", baslik: "Kaynak kaydı", durum: "tamam", metin: [kaynak.authors, kaynak.year ? `(${kaynak.year})` : null, kaynak.title].filter(Boolean).join(" ") }
      : { anahtar: "kaynak", baslik: "Kaynak kaydı", durum: "eksik", metin: k.kaynak_id ? "Kaynak kaydına erişilemiyor (silinmiş ya da size ait değil)." : "Literatür listenizden bir kaynak bağlanmadı." },
    k.kunye_durumu === "dogrulandi"
      ? { anahtar: "yayin", baslik: "Özgün yayın", durum: "tamam", metin: KUNYE_ETIKETI.dogrulandi, adres: yayinAdresi }
      : k.kunye_durumu === "kismen"
        ? { anahtar: "yayin", baslik: "Özgün yayın", durum: "kismi", metin: KUNYE_ETIKETI.kismen, adres: yayinAdresi }
        : { anahtar: "yayin", baslik: "Özgün yayın", durum: "eksik", metin: KUNYE_ETIKETI[k.kunye_durumu], adres: yayinAdresi },
    k.alinti
      ? {
          anahtar: "kanit",
          baslik: "İlgili kanıt",
          durum: k.konum ? "tamam" : "kismi",
          metin: `“${k.alinti}” — ${k.konum ? k.konum : "konum belirtilmedi"}${k.incelenen_kapsam === "tam_metin" ? " · tam metinden" : " · eklenen bölümden"}`,
        }
      : {
          anahtar: "kanit",
          baslik: "İlgili kanıt",
          durum: "eksik",
          metin: k.incelenen_metin
            ? "Metin eklendi ama içinden bir kanıt alıntısı seçilmedi."
            : k.erisim_durumu === "acik_erisim"
              ? "Açık erişimli tam metin var ama henüz incelenmedi."
              : "Kaynağın metnine erişilmedi; kanıt incelenemedi.",
          adres: !k.incelenen_metin && k.erisim_durumu === "acik_erisim" ? k.erisim_adresi : null,
        },
    {
      anahtar: "sonuc",
      baslik: "Doğrulama sonucu",
      durum: destek === "degerlendirilmedi" || destek === "dogrulanamadi" ? "eksik" : destek === "dogrudan" ? "tamam" : "kismi",
      metin:
        `${DESTEK_ETIKETI[destek]}` +
        (k.degerlendiren === "asistan" ? " · otomatik değerlendirme" : k.degerlendiren === "kullanici" ? " · sizin değerlendirmeniz" : ""),
    },
  ];
}

// ---------- Kanıt matrisi ----------

export type MatrisOzeti = {
  toplam: number;
  dogrudan: number;
  zayif: number;
  celisen: number;
  degerlendirilmemis: number;
  kunyeSorunlu: number;
  incelemeBekleyen: number;
};

/**
 * Matrisin üst özeti. Sayılar çağıranın verdiği listenin TAMAMINDAN
 * hesaplanır; liste sınırlı bir sorgudan gelirse özet yanlış olur
 * (npm run check:rakamlar). Çağıran çalışmanın bütün kayıtlarını okur.
 */
export function matrisOzeti(kayitlar: KanitKaydi[]): MatrisOzeti {
  const ozet: MatrisOzeti = { toplam: kayitlar.length, dogrudan: 0, zayif: 0, celisen: 0, degerlendirilmemis: 0, kunyeSorunlu: 0, incelemeBekleyen: 0 };
  for (const k of kayitlar) {
    const destek = gecerliDestek(k);
    if (destek === "dogrudan") ozet.dogrudan += 1;
    else if (destek === "kismen" || destek === "dolayli") ozet.zayif += 1;
    else if (destek === "celisiyor") ozet.celisen += 1;
    else ozet.degerlendirilmemis += 1;
    if (k.kunye_durumu === "uyusmuyor" || k.kunye_durumu === "kismen" || k.kunye_durumu === "dogrulanamadi") ozet.kunyeSorunlu += 1;
    if (insanIncelemesiOneriliyor(k)) ozet.incelemeBekleyen += 1;
  }
  return ozet;
}

/** Kayıt için bir sonraki somut adım; matrisin "önerilen düzeltme" sütununun boş hâli. */
export function sonrakiAdim(k: KanitKaydi): string {
  if (k.duzeltme) return k.duzeltme;
  if (!k.kaynak_id) return "Literatür listenizden iddiayı destekleyen kaynağı bağlayın.";
  if (k.kunye_durumu === "bakilmadi") return "Künyeyi dizinde doğrulatın.";
  if (k.kunye_durumu === "uyusmuyor") return "Kaynakçadaki künyeyi dizindeki kayıtla karşılaştırıp düzeltin.";
  if (!k.incelenen_metin) return k.erisim_durumu === "acik_erisim" ? "Açık erişimli metinden ilgili bölümü ekleyin." : "Kaynaktan iddiayla ilgili bölümü ekleyin.";
  if (!k.alinti) return "Eklenen metinden iddiayı destekleyen cümleyi seçin.";
  const destek = gecerliDestek(k);
  if (destek === "degerlendirilmedi") return "İddia ile kanıtı karşılaştırın.";
  if (destek === "celisiyor") return "İddiayı kanıta göre yeniden yazın ya da çelişkiyi tartışın.";
  if (destek === "dolayli" || destek === "kismen") return "İddiayı daraltın ya da doğrudan kanıt sunan bir kaynak ekleyin.";
  if (destek === "dogrulanamadi") return "Daha ilgili bir bölüm ekleyin ya da başka bir kaynak arayın.";
  if (insanIncelemesiOneriliyor(k)) return "Otomatik değerlendirmeyi kendiniz kontrol edip onaylayın.";
  return "Ek işlem gerekmiyor.";
}
