/*
  Müsvedde ile literatür listesinin birbirini denetlemesi.

  Ekosistemin asıl kazancı burada: iki birim ayrı ayrı doğru ama birlikte
  yanlış olabiliyor. Kullanıcı bir kaynağı "kullanıldı" diye işaretliyor ama
  metinde ona hiç atıf yapmamış oluyor; ya da metinde atıf var, literatür
  listesinde karşılığı yok. İkisini yan yana koyan kimse olmadığı için bu
  ancak jüri önünde ortaya çıkıyordu.

  Yapay zekâ gerekmiyor: atıf çıkarma ve eşleştirme zaten kuralla yapılıyor
  (lib/apa7.ts). Kaynakça Doğrulama sayfasındaki denetimin aynısı, farkı
  kullanıcının hiçbir şey yapıştırmasına gerek olmaması — metin ve liste
  zaten çalışmaya bağlı.

  Saf modül; testi tests/unit/calisma-tutarlilik.test.ts.
*/

import { crossCheck, extractInTextCitations, type ParsedReference } from "@/lib/apa7";

export type KaynakSatiri = {
  id: string;
  title: string;
  authors: string | null;
  year: string | null;
  status: string;
};

export type Tutarsizlik = {
  tur: "atifsiz_kaynak" | "kaynaksiz_atif";
  baslik: string;
  aciklama: string;
};

/** Literatür kaydını apa7'nin beklediği biçime çevirir. */
function kaynagaCevir(kaynak: KaynakSatiri): ParsedReference {
  return {
    raw: [kaynak.authors, kaynak.year ? `(${kaynak.year})` : null, kaynak.title].filter(Boolean).join(" "),
    authors: kaynak.authors ? [kaynak.authors] : null,
    year: kaynak.year,
    title: kaynak.title,
    issues: [],
  };
}

const kisalt = (metin: string, sinir = 90) => (metin.length > sinir ? `${metin.slice(0, sinir)}…` : metin);

/**
 * Metinle liste arasındaki tutarsızlıklar.
 *
 * Metin yoksa hiçbir şey söylenmez: boş müsveddede her kaynak "atıfsız"
 * görünürdü ve bu, henüz yazmaya başlamamış kullanıcıya atılmış bir
 * yanlış alarm olurdu. Aynı gerekçeyle, literatür listesi boşken metindeki
 * atıflar "kaynaksız" sayılmaz.
 */
export function metinListeTutarsizliklari(duzMetin: string | null, kaynaklar: KaynakSatiri[]): Tutarsizlik[] {
  const metin = (duzMetin ?? "").trim();
  if (metin.length < 200) return [];

  const atiflar = extractInTextCitations(metin);
  const sonuc = crossCheck(atiflar, kaynaklar.map(kaynagaCevir));
  const tutarsizliklar: Tutarsizlik[] = [];

  /*
    "Kullanıldı" işaretli ama metinde atfı olmayan kaynaklar. Yalnızca bu
    durumdakiler bildirilir: "incelenecek" ve "okundu" kaynaklarının metinde
    geçmemesi normaldir, henüz kullanılmamışlardır.
  */
  const kullanilanBasliklar = new Set(
    kaynaklar.filter((kaynak) => kaynak.status === "used").map((kaynak) => kaynak.title),
  );
  const atifsiz = sonuc.referencesWithoutCitation
    .map((kayit) => kayit.title ?? "")
    .filter((baslik) => baslik && kullanilanBasliklar.has(baslik));

  if (atifsiz.length)
    tutarsizliklar.push({
      tur: "atifsiz_kaynak",
      baslik: `${atifsiz.length} kaynak "kullanıldı" işaretli ama metinde atfı yok`,
      aciklama: `${atifsiz.slice(0, 3).map((b) => kisalt(b)).join(" · ")}${atifsiz.length > 3 ? " …" : ""}. Metinde atıf yapın ya da durumu "okundu" olarak değiştirin.`,
    });

  // Liste boşken her atıf "kaynaksız" görünürdü; o bir tutarsızlık değil,
  // henüz kaynak girilmemiş olmasıdır.
  if (kaynaklar.length) {
    const kaynaksiz = [...new Set(sonuc.citationsWithoutReference.map((atif) => atif.raw))];
    if (kaynaksiz.length)
      tutarsizliklar.push({
        tur: "kaynaksiz_atif",
        baslik: `Metinde ${kaynaksiz.length} atfın literatürde karşılığı yok`,
        aciklama: `${kaynaksiz.slice(0, 5).join(" · ")}${kaynaksiz.length > 5 ? " …" : ""}. Kaynağı literatür listesine ekleyin ya da atfı kontrol edin.`,
      });
  }

  return tutarsizliklar;
}
