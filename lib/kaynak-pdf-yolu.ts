/*
  KAYNAK PDF'İ DEPO YOLLARI (P52b-1). Saf modül; testi
  tests/unit/kaynak-pdf-yolu.test.ts.

  Bir yol yalnızca TAM KALIBA uyuyorsa kabul edilir; önek denetimi yetmez.
  Eskiden öğrencinin yüklemesi `startsWith("<çalışma>/kaynak-pdf/")` ile
  denetleniyordu: aynı çalışmadaki BAŞKA bir künyenin dosya yolu da bu
  önekle başladığı için kabul ediliyor, sonra o künye değiştirildiğinde
  "eski dosya" diye ötekinin PDF'i siliniyordu (denetim B-PATH-1). `..`,
  ters bölü, çift bölü ya da beklenmeyen karakter taşıyan bir yol da
  önek denetiminden geçiyordu.

  Yeni yollar (yalnızca küçük harf, rakam ve tire):
    otomatik:  <çalışma>/kaynak-pdf/<16 hex>-<rastgele uuid>.pdf
               (sunucu üretir, lib/kaynak-pdf-yazimi.ts → otomatikYol)
    yükleme:   <çalışma>/kaynak-pdf/y-<kullanıcı>-<rastgele uuid>.pdf
               (tarayıcı üretir; kullanıcı kimliği yolda, sunucu oturumla
               karşılaştırır: başkasının yüklediği dosya "benim yüklemem"
               diye kayda bağlanamaz)

  Ad RASTGELE kimlikle biter, zamanla değil. Eskiden milisaniyelik zaman
  kullanılıyordu: aynı milisaniyede iki işlem aynı adı üretiyordu. Ardışık
  ikincisi "zaten var" ile düşüyor, EŞZAMANLI olanlarda Storage ikincisini
  hata vermeden üzerine yazıyordu — bir künyenin PDF'i ötekinin baytlarıyla
  değişebiliyordu (denetim/p52b1/toctou.mjs, Y3a/Y3b). Rastgele ad, bir
  dosyayı yalnızca onu üreten işlemin bilmesini de sağlar: telafinin
  silmeye karar verdiği dosyayı meşru bir başka işlem sahiplenemez.

  ESKİ biçimler (bu değişiklikten önce yazılmış kayıtlar) yalnızca
  SİLİNEBİLİR olarak tanınır, yeni kayda bağlanamaz: kullanıcı eski bir
  PDF'i değiştirdiğinde eski dosya temizlenebilmeli, yoksa her değiştirme
  bir yetim bırakır.
    eski otomatik: <çalışma>/kaynak-pdf/<16 hex>-<13 haneli zaman>.pdf
    eski yükleme:  <çalışma>/kaynak-pdf/y-<13 haneli zaman>.pdf
*/

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const UUID_TAM = new RegExp(`^${UUID}$`);
const OTOMATIK = new RegExp(`^(${UUID})/kaynak-pdf/[0-9a-f]{16}-${UUID}\\.pdf$`);
const YUKLEME = new RegExp(`^(${UUID})/kaynak-pdf/y-(${UUID})-${UUID}\\.pdf$`);
const ESKI_OTOMATIK = new RegExp(`^(${UUID})/kaynak-pdf/[0-9a-f]{16}-\\d{13}\\.pdf$`);
const ESKI_YUKLEME = new RegExp(`^(${UUID})/kaynak-pdf/y-\\d{13}\\.pdf$`);

export type YolTuru = "otomatik" | "yukleme" | "eski";

export type YolCozumu =
  | { gecerli: true; tur: YolTuru; projectId: string; yukleyen: string | null }
  | { gecerli: false };

/** Yolu tam kalıba göre çözer; büyük harf, `..`, `\`, `//`, boşluk ya da fazladan bölüm geçersizdir. */
export function kaynakPdfYoluCoz(yol: unknown): YolCozumu {
  if (typeof yol !== "string" || yol.length > 200) return { gecerli: false };
  const o = OTOMATIK.exec(yol);
  if (o) return { gecerli: true, tur: "otomatik", projectId: o[1], yukleyen: null };
  const y = YUKLEME.exec(yol);
  if (y) return { gecerli: true, tur: "yukleme", projectId: y[1], yukleyen: y[2] };
  const e = ESKI_OTOMATIK.exec(yol) ?? ESKI_YUKLEME.exec(yol);
  if (e) return { gecerli: true, tur: "eski", projectId: e[1], yukleyen: null };
  return { gecerli: false };
}

/** Öğrencinin bu çalışma için kendi yüklediği (yeni biçimde) dosyanın yolu mu? */
export function yuklemeYoluMu(yol: unknown, projectId: string, kullaniciId: string): boolean {
  const c = kaynakPdfYoluCoz(yol);
  return c.gecerli && c.tur === "yukleme" && c.projectId === projectId.toLowerCase() && c.yukleyen === kullaniciId.toLowerCase();
}

/** Bu çalışmanın kaynak PDF klasöründe, kalıba uyan (silinmesi düşünülebilecek) bir yol mu? Eski biçimler dahil. */
export function calismaninKaynakPdfYoluMu(yol: unknown, projectId: string): boolean {
  const c = kaynakPdfYoluCoz(yol);
  return c.gecerli && c.projectId === projectId.toLowerCase();
}

/** Tarayıcının yükleme yolu (kaynak-pdf-satiri.tsx). Kimlikler küçük harfe çevrilir: kalıp yalnızca küçük harf kabul eder. */
export function yuklemeYolu(projectId: string, kullaniciId: string, kimlik: string = crypto.randomUUID()): string {
  const p = projectId.toLowerCase();
  const k = kullaniciId.toLowerCase();
  const r = kimlik.toLowerCase();
  if (!UUID_TAM.test(p) || !UUID_TAM.test(k) || !UUID_TAM.test(r)) throw new Error("Geçersiz kimlik.");
  return `${p}/kaynak-pdf/y-${k}-${r}.pdf`;
}
