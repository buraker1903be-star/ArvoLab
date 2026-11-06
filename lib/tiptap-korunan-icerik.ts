import type { NodeType, Schema } from "@tiptap/pm/model";

/*
  EDİTÖRÜN TANIMADIĞI İÇERİĞİ KORUMA (S1.3, 06.11.2026)

  Sorun: Tiptap kayıtlı JSON'u açarken `schema.nodeFromJSON` bir hata
  fırlatırsa (tanımadığı düğüm ya da işaret türü, zorunlu özniteliği eksik
  düğüm, boş metin düğümü) belgeyi düzeltmeye çalışmıyor, editörü BOŞ
  başlatıyor (@tiptap/core createNodeFromContent → ""). Bir eklenti
  listeden düştüğünde ya da başka bir sürüm/araç belgeye bilinmeyen bir
  düğüm yazdığında tezin TAMAMI ekranda kayboluyordu. 8fb36dc'den beri kayıt
  kilitliydi ama "Yedekle ve devam et" boş editörü açıyordu: kullanıcı
  yazınca kayıt "boş + yazılan"ı sunucuya yazıyor, özgün metin yalnızca
  geçmişteki yedekte kalıyordu.

  Çözüm: belge editöre verilmeden ÖNCE, şemaya uymayan her parça olduğu
  gibi (JSON metni olarak) bir "korunan öğe"nin içine saklanır:
    - tanınmayan / öznitelikleri geçersiz / yerine uymayan düğüm →
      korunanBlok (blok yerinde) ya da korunanSatirIci (satır içinde)
    - tanınmayan / öznitelikleri geçersiz işaret → korunanIsaret
  Belgenin geri kalanı editörde düzenlenebilir hâlde açılır. Kayıtta
  `korunanIcerigiGeriSar` saklanan JSON'u yerine geri koyar: sunucuya giden
  belge özgünüyle aynı bilinmeyen düğümleri taşır, yani yazdırma, paylaşım
  ve Word çıktısı eskisi gibi davranır ve eklenti geri geldiğinde içerik
  kendiliğinden yerindedir.

  Korunan öğe hiçbir zaman veritabanına yazılmaz (sunucu da geri sarar,
  app/actions/manuscript.ts). Böylece çıktı yollarının bu düğümleri tanıması
  gerekmez.

  Kayıpsızlık sınırı: TANINAN bir düğümün şemada olmayan özniteliğini
  ProseMirror sessizce düşürür (computeAttrs). Bu bir hata değil, biçim
  kaybıdır; lib/format-loss.ts'in alanı. Burada ele alınmıyor.

  Bu dosya saf: yalnızca kendisine verilen şemayı kullanır, Tiptap'ın
  editörüne, React'e ya da tarayıcıya dokunmaz (tests/unit).
*/

export const KORUNAN_BLOK = "korunanBlok";
export const KORUNAN_SATIR_ICI = "korunanSatirIci";
export const KORUNAN_ISARET = "korunanIsaret";

export interface JsonIsaret {
  type?: unknown;
  attrs?: Record<string, unknown> | null;
  [anahtar: string]: unknown;
}

export interface JsonDugum {
  type?: unknown;
  attrs?: Record<string, unknown> | null;
  content?: unknown;
  marks?: unknown;
  text?: unknown;
  [anahtar: string]: unknown;
}

/** Korunan öğenin taşıdığı öznitelikler: özgün JSON metni ve gösterim için tür adı. */
export interface KorunanOznitelik {
  tur: string;
  json: string;
}

/*
  Açılış kararı:
    temiz       belge olduğu gibi açılır (hiçbir şeye dokunulmadı)
    korundu     şemaya uymayan parçalar korunan öğeye alındı; geri kalanı
                düzenlenebilir, kayıtta özgün parçalar yerine geri konur
    yapi-hatasi ProseMirror belgeyi kurabiliyor ama içerik kuralı tutmuyor
                (ör. boş tablo hücresi). Tiptap bu belgeyi BOŞALTMADAN
                gösterir; düzenleme yedekten sonra açılabilir
    acilamadi   ne olursa olsun belge kurulamıyor: editör BOŞ açılacak.
                Bu durumda düzenleme ve kayıt hiçbir koşulda açılmaz
*/
export type AcilisDurumu = "temiz" | "korundu" | "yapi-hatasi" | "acilamadi";

export interface HazirlikSonucu {
  durum: AcilisDurumu;
  /** Editöre verilecek belge. "acilamadi"da özgün belge (editör onu açamaz; yalnızca bilgi için). */
  icerik: unknown;
  /** Korunan öğe sayısı, türlerine göre (arayüz ve test için). */
  korunan: { tur: string; sayi: number }[];
  /** yapi-hatasi / acilamadi için ProseMirror'ın hata metni (günlük için; kullanıcı metni DEĞİL). */
  hata?: string;
}

const nesneMi = (deger: unknown): deger is Record<string, unknown> =>
  typeof deger === "object" && deger !== null && !Array.isArray(deger);

const turAdi = (deger: unknown): string => (typeof deger === "string" && deger ? deger.slice(0, 80) : "?");

/*
  ProseMirror öznitelik doğrulaması (spec'teki `validate`) nodeFromJSON'da
  çağrılıyor ama tiplerde @internal. Yoksa (eski sürüm) doğrulama yok demek.
*/
type DogrulanabilirTip = { checkAttrs?: (attrs: unknown) => void };
const ozniteligiDogrula = (tip: unknown, attrs: unknown) => (tip as DogrulanabilirTip).checkAttrs?.(attrs);

class Sayac {
  private readonly turler = new Map<string, number>();
  ekle(tur: string) {
    this.turler.set(tur, (this.turler.get(tur) ?? 0) + 1);
  }
  birlestir(diger: Sayac) {
    for (const [tur, sayi] of diger.turler) this.turler.set(tur, (this.turler.get(tur) ?? 0) + sayi);
  }
  get bos() {
    return this.turler.size === 0;
  }
  liste() {
    return [...this.turler].map(([tur, sayi]) => ({ tur, sayi })).sort((a, b) => a.tur.localeCompare(b.tur));
  }
}

function korunanDugum(ozgun: unknown, satirIci: boolean): JsonDugum {
  const tur = nesneMi(ozgun) ? turAdi(ozgun.type) : "?";
  return { type: satirIci ? KORUNAN_SATIR_ICI : KORUNAN_BLOK, attrs: { tur, json: JSON.stringify(ozgun) } };
}

/* Düğümün KENDİSİ (çocukları olmadan) şemada kurulabiliyor mu: tür, öznitelik, işaret. */
function dugumKurulabilir(tip: NodeType, dugum: JsonDugum): boolean {
  try {
    if (tip.isText) {
      if (typeof dugum.text !== "string" || dugum.text.length === 0) return false;
      return true;
    }
    const attrs = nesneMi(dugum.attrs) ? dugum.attrs : null;
    const kurulan = tip.create(attrs);
    ozniteligiDogrula(tip, kurulan.attrs);
    return true;
  } catch {
    return false;
  }
}

function isaretleriHazirla(schema: Schema, isaretler: unknown, sayac: Sayac): JsonIsaret[] | undefined | null {
  if (isaretler === undefined) return undefined;
  if (!Array.isArray(isaretler)) return null;
  return isaretler.map((isaret: unknown) => {
    if (nesneMi(isaret) && typeof isaret.type === "string") {
      const tip = schema.marks[isaret.type];
      if (tip) {
        try {
          const attrs = nesneMi(isaret.attrs) ? isaret.attrs : null;
          ozniteligiDogrula(tip, tip.create(attrs).attrs);
          return isaret as JsonIsaret;
        } catch {
          /* geçersiz öznitelik: aşağıda korunur */
        }
      }
    }
    sayac.ekle(nesneMi(isaret) ? turAdi(isaret.type) : "?");
    return { type: KORUNAN_ISARET, attrs: { tur: nesneMi(isaret) ? turAdi(isaret.type) : "?", json: JSON.stringify(isaret) } };
  });
}

/*
  Bir düğümü hazırlar. Çocuklar ebeveynin içerik kuralına sırayla uymalı
  (ContentMatch). Uymayan çocuk — tanınan bir tür olsa bile — korunan öğeye
  alınır. Korunan öğe de oraya giremiyorsa (tablo satırı yalnızca hücre
  kabul eder) ya da içerik eksik kalıyorsa (boş hücre), koruma BİR ÜST
  düğüme taşınır: bütün satır, gerekirse bütün tablo tek kutuda korunur.
  Daha az düzenlenebilir ama kayıpsız ve geçerli; belge en üstte (doc)
  her blok yerine korunan blok kabul ettiği için yükseltme orada durur.
*/
function dugumHazirla(schema: Schema, dugum: unknown, satirIci: boolean, sayac: Sayac): JsonDugum {
  if (!nesneMi(dugum) || typeof dugum.type !== "string") {
    sayac.ekle("?");
    return korunanDugum(dugum, satirIci);
  }
  const tip = schema.nodes[dugum.type];
  /*
    Korunan türler veritabanında bulunmaz (kayıt geri sarar). Yine de gelirse
    (doğrudan yazılmış kayıt) tanınan tür gibi davranır: "temiz" yol da onu
    olduğu gibi açıyor, ikisi aynı kuralı izlemeli. json'u bozuksa kayıtta
    geri sarılamaz ve sunucu kaydı reddeder — üzerine yazmak yerine durur.
  */
  if (!tip || !dugumKurulabilir(tip, dugum)) {
    sayac.ekle(turAdi(dugum.type));
    return korunanDugum(dugum, satirIci);
  }
  // Çocuklarda yapılan sayımlar, yükseltme olursa geçersiz kalır: ayrı sayaçta tutulur.
  const yerel = new Sayac();
  const marks = isaretleriHazirla(schema, dugum.marks, yerel);
  let content: JsonDugum[] | null | undefined;
  if (dugum.content !== undefined) content = Array.isArray(dugum.content) ? cocuklariHazirla(schema, tip, dugum.content, yerel) : null;
  else if (!tip.isLeaf && !tip.contentMatch.validEnd) content = null; // zorunlu içeriği hiç yok
  if (marks === null || content === null) {
    sayac.ekle(turAdi(dugum.type));
    return korunanDugum(dugum, satirIci);
  }
  sayac.birlestir(yerel);
  const sonuc: JsonDugum = { ...dugum };
  if (marks !== undefined) sonuc.marks = marks;
  if (content !== undefined) sonuc.content = content;
  return sonuc;
}

/** Çocukları hazırlar; ebeveynin içerik kuralı korunan öğeyle de sağlanamıyorsa null. */
function cocuklariHazirla(schema: Schema, ebeveyn: NodeType, cocuklar: unknown[], sayac: Sayac): JsonDugum[] | null {
  const satirIci = ebeveyn.inlineContent;
  const yerTutucu = schema.nodes[satirIci ? KORUNAN_SATIR_ICI : KORUNAN_BLOK];
  let eslesme = ebeveyn.contentMatch;
  const sonuc: JsonDugum[] = [];
  for (const cocuk of cocuklar) {
    let hazir = dugumHazirla(schema, cocuk, satirIci, sayac);
    let tip = schema.nodes[hazir.type as string];
    let sonraki = tip ? eslesme.matchType(tip) : null;
    const isaretUymuyor =
      sonraki &&
      Array.isArray(hazir.marks) &&
      (hazir.marks as JsonIsaret[]).some((m) => {
        const mt = schema.marks[m.type as string];
        return !mt || !ebeveyn.allowsMarkType(mt);
      });
    if ((!sonraki || isaretUymuyor) && yerTutucu && hazir.type !== yerTutucu.name) {
      // Yerine uymayan (ya da ebeveynin izin vermediği işareti taşıyan) tanınan düğüm.
      sayac.ekle(turAdi(nesneMi(cocuk) ? cocuk.type : "?"));
      hazir = korunanDugum(cocuk, satirIci);
      tip = yerTutucu;
      sonraki = eslesme.matchType(tip);
    }
    if (!sonraki) return null;
    eslesme = sonraki;
    sonuc.push(hazir);
  }
  return eslesme.validEnd ? sonuc : null;
}

function kurulabilir(schema: Schema, icerik: unknown): { kuruldu: boolean; gecerli: boolean; hata?: string } {
  try {
    const dugum = schema.nodeFromJSON(icerik);
    try {
      dugum.check();
      return { kuruldu: true, gecerli: true };
    } catch (hata) {
      return { kuruldu: true, gecerli: false, hata: String((hata as Error)?.message ?? hata) };
    }
  } catch (hata) {
    return { kuruldu: false, gecerli: false, hata: String((hata as Error)?.message ?? hata) };
  }
}

/**
 * Kayıtlı belgeyi editöre verilecek hâle getirir. Şemaya uyan belgeye
 * dokunmaz (aynı nesneyi döndürür).
 */
export function korunacakIcerigiHazirla(icerik: unknown, schema: Schema): HazirlikSonucu {
  const ilk = kurulabilir(schema, icerik);
  if (ilk.gecerli) return { durum: "temiz", icerik, korunan: [] };

  if (!nesneMi(icerik) || icerik.type !== schema.topNodeType.name || !Array.isArray(icerik.content)) {
    return { durum: ilk.kuruldu ? "yapi-hatasi" : "acilamadi", icerik, korunan: [], hata: ilk.hata };
  }
  const sayac = new Sayac();
  const cocuklar = cocuklariHazirla(schema, schema.topNodeType, icerik.content, sayac);
  if (!cocuklar) return { durum: ilk.kuruldu ? "yapi-hatasi" : "acilamadi", icerik, korunan: sayac.liste(), hata: ilk.hata };
  const hazir: JsonDugum = { ...icerik, content: cocuklar };
  const sonra = kurulabilir(schema, hazir);
  if (sonra.gecerli && !sayac.bos) return { durum: "korundu", icerik: hazir, korunan: sayac.liste() };
  /*
    Hazırlık belgeyi geçerli kılamadı. Kurulabiliyorsa (yalnızca içerik
    kuralı tutmuyor) Tiptap onu boşaltmadan gösterir: hazırlanmış hâli ver ki
    tanınmayan parçalar yine korunsun. Kurulamıyorsa editör boş açılacak.
  */
  if (sonra.kuruldu) return { durum: "yapi-hatasi", icerik: sayac.bos ? icerik : hazir, korunan: sayac.liste(), hata: sonra.hata ?? ilk.hata };
  if (ilk.kuruldu) return { durum: "yapi-hatasi", icerik, korunan: [], hata: ilk.hata };
  return { durum: "acilamadi", icerik, korunan: sayac.liste(), hata: sonra.hata ?? ilk.hata };
}

function jsonCoz(metin: unknown): { tamam: true; deger: unknown } | { tamam: false } {
  if (typeof metin !== "string") return { tamam: false };
  try {
    return { tamam: true, deger: JSON.parse(metin) };
  } catch {
    return { tamam: false };
  }
}

/**
 * Korunan öğeleri özgün JSON'larıyla değiştirir (kayıt ve sunucu). Korunan
 * öğe yoksa aynı nesneyi döndürür. Çözülemeyen (bozulmuş) korunan öğe
 * olduğu gibi kalır — veri uydurulmaz; sunucu böyle bir belgeyi reddeder.
 */
export function korunanIcerigiGeriSar<T>(icerik: T): T {
  // Değişmeyen dal aynı referansla döner; böylece korunan öğe yoksa çağıran aynı nesneyi alır.
  const isaretGeriSar = (isaretler: unknown): unknown => {
    if (!Array.isArray(isaretler)) return isaretler;
    const yeni = isaretler.map((m: unknown) => {
      if (nesneMi(m) && m.type === KORUNAN_ISARET && nesneMi(m.attrs)) {
        const cozulen = jsonCoz(m.attrs.json);
        if (cozulen.tamam) return cozulen.deger;
      }
      return m;
    });
    return yeni.some((m, i) => m !== isaretler[i]) ? yeni : isaretler;
  };
  const gez = (dugum: unknown): unknown => {
    if (!nesneMi(dugum)) return dugum;
    if ((dugum.type === KORUNAN_BLOK || dugum.type === KORUNAN_SATIR_ICI) && nesneMi(dugum.attrs)) {
      const cozulen = jsonCoz(dugum.attrs.json);
      return cozulen.tamam ? cozulen.deger : dugum;
    }
    let yeni: Record<string, unknown> = dugum;
    const marks = isaretGeriSar(dugum.marks);
    if (marks !== dugum.marks) yeni = { ...yeni, marks };
    if (Array.isArray(dugum.content)) {
      const content = dugum.content.map(gez);
      if (content.some((c, i) => c !== (dugum.content as unknown[])[i])) yeni = { ...yeni, content };
    }
    return yeni;
  };
  return gez(icerik) as T;
}

/** Belgede (editör biçiminde) korunan öğe var mı / kaç tane. */
export function korunanOgeSayisi(icerik: unknown): number {
  let sayi = 0;
  const gez = (dugum: unknown) => {
    if (!nesneMi(dugum)) return;
    if (dugum.type === KORUNAN_BLOK || dugum.type === KORUNAN_SATIR_ICI) sayi++;
    if (Array.isArray(dugum.marks)) for (const m of dugum.marks) if (nesneMi(m) && m.type === KORUNAN_ISARET) sayi++;
    if (Array.isArray(dugum.content)) dugum.content.forEach(gez);
  };
  gez(icerik);
  return sayi;
}

/** Korunan öğenin kısa önizlemesi: özgün JSON'daki metinlerin ilk ~80 karakteri (gösterim için). */
export function korunanOnizleme(json: unknown, sinir = 80): string {
  const cozulen = jsonCoz(json);
  if (!cozulen.tamam) return "";
  const parcalar: string[] = [];
  let uzunluk = 0;
  const gez = (dugum: unknown) => {
    if (uzunluk >= sinir || !nesneMi(dugum)) return;
    if (typeof dugum.text === "string") {
      parcalar.push(dugum.text);
      uzunluk += dugum.text.length;
    }
    if (Array.isArray(dugum.content)) dugum.content.forEach(gez);
  };
  gez(cozulen.deger);
  const metin = parcalar.join(" ").replace(/\s+/g, " ").trim();
  return metin.length > sinir ? `${metin.slice(0, sinir - 1)}…` : metin;
}
