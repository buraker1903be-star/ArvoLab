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

import type { Dil, Metin } from "@/lib/dil";

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

/*
  Etiketler iki dilde (28.10.2026). Eski Record<…, string> dışa aktarımları
  Türkçe değerle kalıyor: çağıranlar onlara bağlı ve tipi değişirse
  şablon metinde "[object Object]" yazardı.
*/
export const DESTEK_ETIKETI_METIN: Record<DestekDuzeyi, Metin> = {
  degerlendirilmedi: { tr: "Değerlendirilmedi", en: "Not assessed" },
  dogrudan: { tr: "Doğrudan destekleniyor", en: "Directly supported" },
  kismen: { tr: "Kısmen destekleniyor", en: "Partially supported" },
  dolayli: { tr: "Dolaylı destek", en: "Indirect support" },
  celisiyor: { tr: "Çelişiyor", en: "Contradicts" },
  dogrulanamadi: { tr: "Doğrulanamadı", en: "Could not be verified" },
};

export const DESTEK_ACIKLAMASI_METIN: Record<DestekDuzeyi, Metin> = {
  degerlendirilmedi: { tr: "İddia ile kanıt henüz karşılaştırılmadı.", en: "The claim has not yet been compared with the evidence." },
  dogrudan: { tr: "Erişilebilir kanıt iddiayı açıkça destekliyor.", en: "The available evidence clearly supports the claim." },
  kismen: { tr: "Kaynak iddianın yalnızca belirli bir kısmını destekliyor.", en: "The source supports only part of the claim." },
  dolayli: { tr: "Kaynak ilgili arka planı sağlıyor ama iddiayı doğrudan doğrulamıyor.", en: "The source provides relevant background but does not directly confirm the claim." },
  celisiyor: { tr: "İncelenen kanıt iddiayla çelişiyor.", en: "The reviewed evidence contradicts the claim." },
  dogrulanamadi: { tr: "Mevcut kanıt bir sonuca ulaşmaya yetmiyor.", en: "The available evidence is not enough to reach a conclusion." },
};

export const KUNYE_ETIKETI_METIN: Record<KunyeDurumu, Metin> = {
  bakilmadi: { tr: "Künyeye bakılmadı", en: "Citation details not checked" },
  dogrulandi: { tr: "Kaynak kaydı doğrulandı", en: "Source record verified" },
  kismen: { tr: "Bibliyografik bilgiler kısmen doğrulandı", en: "Bibliographic details partially verified" },
  uyusmuyor: { tr: "Künye dizindeki kayıtla uyuşmuyor", en: "Citation details do not match the index record" },
  dogrulanamadi: { tr: "Kaynak kaydı doğrulanamadı", en: "Source record could not be verified" },
};

const turkcesi = <K extends string>(harita: Record<K, Metin>): Record<K, string> =>
  Object.fromEntries(Object.entries<Metin>(harita).map(([k, v]) => [k, v.tr])) as Record<K, string>;

export const DESTEK_ETIKETI: Record<DestekDuzeyi, string> = turkcesi(DESTEK_ETIKETI_METIN);
export const DESTEK_ACIKLAMASI: Record<DestekDuzeyi, string> = turkcesi(DESTEK_ACIKLAMASI_METIN);
export const KUNYE_ETIKETI: Record<KunyeDurumu, string> = turkcesi(KUNYE_ETIKETI_METIN);

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
export function durumRozetleri(k: KanitKaydi, dil: Dil = "tr"): Rozet[] {
  const en = dil === "en";
  const t = (tr: string, ing: string) => (en ? ing : tr);
  const rozetler: Rozet[] = [];
  const dizin = k.kunye_kaynagi === "openalex" ? "OpenAlex" : "Crossref";
  const kunye = (d: KunyeDurumu) => KUNYE_ETIKETI_METIN[d][dil];
  const aciklama = (d: DestekDuzeyi) => DESTEK_ACIKLAMASI_METIN[d][dil];

  if (k.kunye_durumu === "dogrulandi")
    rozetler.push({
      anahtar: "kunye",
      etiket: kunye("dogrulandi"),
      ton: "success",
      aciklama: en
        ? `Title, year and first author matched the ${dizin} record. This does not show that the source supports the claim.`
        : `${dizin} kaydıyla başlık, yıl ve ilk yazar eşleşti. Bu, kaynağın iddiayı desteklediğini göstermez.`,
    });
  else if (k.kunye_durumu === "kismen")
    rozetler.push({
      anahtar: "kunye",
      etiket: kunye("kismen"),
      ton: "warning",
      aciklama: en ? `Some fields in the ${dizin} record do not match or could not be compared.` : `${dizin} kaydında bazı alanlar uyuşmuyor ya da karşılaştırılamadı.`,
    });
  else if (k.kunye_durumu === "uyusmuyor")
    rozetler.push({ anahtar: "kunye", etiket: kunye("uyusmuyor"), ton: "danger", aciklama: t("Dizindeki kaydın başlığı sizin künyenizle uyuşmuyor.", "The title of the index record does not match your citation.") });
  else if (k.kunye_durumu === "dogrulanamadi")
    rozetler.push({
      anahtar: "kunye",
      etiket: kunye("dogrulanamadi"),
      ton: "neutral",
      aciklama: t(
        "Dizinde kayıt bulunamadı. Bu, kaynağın sahte olduğunu kanıtlamaz; başka bir dizinde ya da yayıncı sayfasında kontrol edin.",
        "No record was found in the index. This does not prove the source is fake; check another index or the publisher's page.",
      ),
    });

  if (k.incelenen_metin) {
    rozetler.push(
      k.incelenen_kapsam === "tam_metin"
        ? { anahtar: "metin", etiket: t("Tam metin incelendi", "Full text reviewed"), ton: "info", aciklama: t("Kullanıcının beyanına göre eklenen metin kaynağın tamamı.", "According to the user, the added text is the full source.") }
        : { anahtar: "metin", etiket: t("İlgili bölüm incelendi", "Relevant section reviewed"), ton: "info", aciklama: t("Yalnızca eklenen bölüme bakıldı; kaynağın geri kalanı incelenmedi.", "Only the added section was reviewed; the rest of the source was not.") },
    );
  }
  if (k.alinti) rozetler.push({ anahtar: "kanit", etiket: t("İlgili kanıt bulundu", "Relevant evidence found"), ton: "info", aciklama: t("İncelenen metinden bir alıntı kaydedildi.", "A quotation from the reviewed text was saved.") });

  const destek = gecerliDestek(k);
  if (destek === "dogrudan" || destek === "kismen")
    rozetler.push({
      anahtar: "uyum",
      etiket: destek === "dogrudan" ? t("İddia ile kanıt uyumlu görünüyor", "Claim and evidence appear consistent") : t("İddia ile kanıt kısmen uyumlu", "Claim and evidence partially consistent"),
      ton: DESTEK_TONU[destek],
      aciklama: t("Bu bir değerlendirmedir; bulgunun bilimsel olarak doğru olduğunu göstermez.", "This is an assessment; it does not show that the finding is scientifically correct."),
    });
  else if (destek === "dolayli")
    rozetler.push({ anahtar: "uyum", etiket: t("Yalnızca dolaylı destek", "Indirect support only"), ton: "info", aciklama: aciklama("dolayli") });
  else if (destek === "celisiyor")
    rozetler.push({ anahtar: "uyum", etiket: t("Çelişen kanıt bulundu", "Contradicting evidence found"), ton: "danger", aciklama: aciklama("celisiyor") });
  else if (destek === "dogrulanamadi")
    rozetler.push({ anahtar: "uyum", etiket: t("Doğrulanamadı", "Could not be verified"), ton: "neutral", aciklama: aciklama("dogrulanamadi") });

  if (!k.incelenen_metin && k.erisim_durumu !== "acik_erisim")
    rozetler.push({
      anahtar: "erisim",
      etiket: t("Doğrulama için erişim yetersiz", "Insufficient access for verification"),
      ton: "warning",
      aciklama: t("Kaynağın metni eklenmedi ve açık erişimli bir tam metin bilinmiyor.", "The source text was not added and no open-access full text is known."),
    });

  if (insanIncelemesiOneriliyor(k))
    rozetler.push({ anahtar: "insan", etiket: t("İnsan incelemesi öneriliyor", "Human review recommended"), ton: "warning", aciklama: insanIncelemesiNedeni(k, dil) });

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

function insanIncelemesiNedeni(k: KanitKaydi, dil: Dil): string {
  const en = dil === "en";
  if (gecerliDestek(k) === "celisiyor")
    return en ? "The evidence appears to contradict the claim; revisit the claim." : "Kanıt iddiayla çelişiyor görünüyor; iddiayı yeniden ele alın.";
  if (k.kunye_durumu === "uyusmuyor" || k.kunye_durumu === "kismen")
    return en ? "The citation does not fully match the index record; check your reference list." : "Künye dizindeki kayıtla tam uyuşmuyor; kaynakçanızı kontrol edin.";
  return en ? "The consistency assessment was made by an automated system; it is not a final academic judgment." : "Uyum değerlendirmesini otomatik sistem yaptı; nihai akademik hüküm değildir.";
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
export function kanitZinciri(k: KanitKaydi, kaynak: KaynakOzeti | null, dil: Dil = "tr"): Halka[] {
  const en = dil === "en";
  const t = (tr: string, ing: string) => (en ? ing : tr);
  const destek = gecerliDestek(k);
  const yayinAdresi =
    (k.kunye_ayrintisi as { adres?: string | null } | null | undefined)?.adres ??
    (kaynak?.doi_or_url && /^https?:\/\//.test(kaynak.doi_or_url) ? kaynak.doi_or_url : kaynak?.doi_or_url ? `https://doi.org/${kaynak.doi_or_url.replace(/^doi:\s*/i, "")}` : null);
  const atifBaslik = t("Metin içi atıf", "In-text citation");
  const kaynakBaslik = t("Kaynak kaydı", "Source record");
  const yayinBaslik = t("Özgün yayın", "Original publication");
  const kanitBaslik = t("İlgili kanıt", "Relevant evidence");
  const kunye = (d: KunyeDurumu) => KUNYE_ETIKETI_METIN[d][dil];

  return [
    { anahtar: "iddia", baslik: t("Akademik iddia", "Academic claim"), durum: "tamam", metin: k.bolum ? `${k.iddia} (${k.bolum})` : k.iddia },
    k.atif
      ? { anahtar: "atif", baslik: atifBaslik, durum: "tamam", metin: k.atif }
      : { anahtar: "atif", baslik: atifBaslik, durum: "eksik", metin: t("İddiaya bir atıf girilmedi.", "No citation was entered for the claim.") },
    kaynak
      ? { anahtar: "kaynak", baslik: kaynakBaslik, durum: "tamam", metin: [kaynak.authors, kaynak.year ? `(${kaynak.year})` : null, kaynak.title].filter(Boolean).join(" ") }
      : {
          anahtar: "kaynak",
          baslik: kaynakBaslik,
          durum: "eksik",
          metin: k.kaynak_id
            ? t("Kaynak kaydına erişilemiyor (silinmiş ya da size ait değil).", "The source record cannot be accessed (deleted or not yours).")
            : t("Literatür listenizden bir kaynak bağlanmadı.", "No source from your literature list is linked."),
        },
    k.kunye_durumu === "dogrulandi"
      ? { anahtar: "yayin", baslik: yayinBaslik, durum: "tamam", metin: kunye("dogrulandi"), adres: yayinAdresi }
      : k.kunye_durumu === "kismen"
        ? { anahtar: "yayin", baslik: yayinBaslik, durum: "kismi", metin: kunye("kismen"), adres: yayinAdresi }
        : { anahtar: "yayin", baslik: yayinBaslik, durum: "eksik", metin: kunye(k.kunye_durumu), adres: yayinAdresi },
    k.alinti
      ? {
          anahtar: "kanit",
          baslik: kanitBaslik,
          durum: k.konum ? "tamam" : "kismi",
          metin: `“${k.alinti}” — ${k.konum ? k.konum : t("konum belirtilmedi", "location not specified")}${k.incelenen_kapsam === "tam_metin" ? t(" · tam metinden", " · from the full text") : t(" · eklenen bölümden", " · from the added section")}`,
        }
      : {
          anahtar: "kanit",
          baslik: kanitBaslik,
          durum: "eksik",
          metin: k.incelenen_metin
            ? t("Metin eklendi ama içinden bir kanıt alıntısı seçilmedi.", "Text was added, but no evidence quotation was selected from it.")
            : k.erisim_durumu === "acik_erisim"
              ? t("Açık erişimli tam metin var ama henüz incelenmedi.", "An open-access full text exists but has not been reviewed yet.")
              : t("Kaynağın metnine erişilmedi; kanıt incelenemedi.", "The source text was not accessed; the evidence could not be reviewed."),
          adres: !k.incelenen_metin && k.erisim_durumu === "acik_erisim" ? k.erisim_adresi : null,
        },
    {
      anahtar: "sonuc",
      baslik: t("Doğrulama sonucu", "Verification result"),
      durum: destek === "degerlendirilmedi" || destek === "dogrulanamadi" ? "eksik" : destek === "dogrudan" ? "tamam" : "kismi",
      metin:
        DESTEK_ETIKETI_METIN[destek][dil] +
        (k.degerlendiren === "asistan" ? t(" · otomatik değerlendirme", " · automated assessment") : k.degerlendiren === "kullanici" ? t(" · sizin değerlendirmeniz", " · your assessment") : ""),
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
export function sonrakiAdim(k: KanitKaydi, dil: Dil = "tr"): string {
  const t = (tr: string, en: string) => (dil === "en" ? en : tr);
  // Kullanıcının kendi yazdığı düzeltme olduğu gibi döner; çevrilmez.
  if (k.duzeltme) return k.duzeltme;
  if (!k.kaynak_id) return t("Literatür listenizden iddiayı destekleyen kaynağı bağlayın.", "Link the source from your literature list that supports the claim.");
  if (k.kunye_durumu === "bakilmadi") return t("Künyeyi dizinde doğrulatın.", "Verify the citation details against the index.");
  if (k.kunye_durumu === "uyusmuyor") return t("Kaynakçadaki künyeyi dizindeki kayıtla karşılaştırıp düzeltin.", "Compare the reference-list entry with the index record and correct it.");
  if (!k.incelenen_metin)
    return k.erisim_durumu === "acik_erisim"
      ? t("Açık erişimli metinden ilgili bölümü ekleyin.", "Add the relevant section from the open-access text.")
      : t("Kaynaktan iddiayla ilgili bölümü ekleyin.", "Add the section of the source that relates to the claim.");
  if (!k.alinti) return t("Eklenen metinden iddiayı destekleyen cümleyi seçin.", "Select the sentence in the added text that supports the claim.");
  const destek = gecerliDestek(k);
  if (destek === "degerlendirilmedi") return t("İddia ile kanıtı karşılaştırın.", "Compare the claim with the evidence.");
  if (destek === "celisiyor") return t("İddiayı kanıta göre yeniden yazın ya da çelişkiyi tartışın.", "Rewrite the claim to fit the evidence, or discuss the contradiction.");
  if (destek === "dolayli" || destek === "kismen") return t("İddiayı daraltın ya da doğrudan kanıt sunan bir kaynak ekleyin.", "Narrow the claim, or add a source that offers direct evidence.");
  if (destek === "dogrulanamadi") return t("Daha ilgili bir bölüm ekleyin ya da başka bir kaynak arayın.", "Add a more relevant section, or look for another source.");
  if (insanIncelemesiOneriliyor(k)) return t("Otomatik değerlendirmeyi kendiniz kontrol edip onaylayın.", "Check and confirm the automated assessment yourself.");
  return t("Ek işlem gerekmiyor.", "No further action needed.");
}
