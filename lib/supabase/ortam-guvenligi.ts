/*
  SUPABASE ORTAM GÜVENLİĞİ — TEK KARAR (Güvenli Test Ortamı, Aşama 1,
  05.11.2026). Saf modül: Next, React ve Supabase'e dokunmaz; Node da
  doğrudan çalıştırabilsin diye yalnızca tip ek açıklaması kullanır
  (enum, namespace yok). Testi tests/unit/supabase-ortam-guvenligi.test.ts.

  NEDEN: Vercel'de Supabase adresi, publishable key ve sunucu gizli
  anahtarı hem Production hem Preview için AYNI değerdi. Her dal
  önizlemesi canlı veritabanına bağlanıyordu; önizlemede denenen bir
  akış ya da migration fiilen üretimde denenmiş oluyordu.

  KURAL: Ortam etiketi tek başına yetmez; Supabase adresindeki GERÇEK
  proje kimliği (https://<ref>.supabase.co) beklenen kimlikle
  karşılaştırılır.

  - Üretim dışı (Vercel Preview, Development, yerel `next dev`/`next
    build`): bağlantı yalnızca TEST projesine. Üretim kimliği, test
    kimliği ve "test" etiketi tanımlı olmalı ve adres test projesini
    göstermeli. Biri eksikse ya da adres üretimi gösteriyorsa RED
    (fail-closed). Yerel Supabase (localhost/127.0.0.1) yalnızca
    Vercel dışındaki geliştirmede kabul edilir.
  - Üretim (VERCEL_ENV=production): adres ÜRETİM projesini göstermeli.
    Test kimliğiyle eşleşirse, etiket "uretim" değilse ya da kimlik
    biçimi geçersizse RED.
    GERİYE DÖNÜK UYUMLULUK: üretim kimliği henüz tanımlanmadıysa (bugünkü
    Production) bağlantı KESİLMEZ, uyarı verilir. Bir yapılandırma
    eksikliği canlıyı kapatmasın; ret yalnızca OLUMLU bir uyuşmazlıkta.
  - Sahte önizleme (ARVOLAB_ONIZLEME=1, üretim dışı): gerçek Supabase'e
    hiç gidilmez (lib/onizleme-takmalari.ts), karar "izin".

  Hata metinleri anahtar ya da değer içermez; yalnızca değişken adları ve
  proje kimliklerinin kendisi (gizli değil, adresin parçası).
*/

export type DagitimOrtami = "uretim" | "uretim-disi";

export type OrtamGirdisi = {
  /** Vercel'in VERCEL_ENV'i: "production" | "preview" | "development"; Vercel dışında boş. */
  vercelOrtami?: string | null;
  /**
   * DERLEME anında okunup koda gömülen VERCEL_ENV (next.config `env` →
   * ARVOLAB_DAGITIM_ORTAMI). Çalışma anındaki değer gelmezse bu kullanılır;
   * ikisi farklıysa ret. Bkz. dagitimOrtamiCoz.
   */
  derlemeOrtami?: string | null;
  supabaseUrl?: string | null;
  /** ARVOLAB_SUPABASE_ORTAMI: "uretim" | "test". */
  etiket?: string | null;
  /** ARVOLAB_URETIM_SUPABASE_REF */
  uretimRef?: string | null;
  /** ARVOLAB_TEST_SUPABASE_REF */
  testRef?: string | null;
  /** ARVOLAB_ONIZLEME: "1" ise sahte istemci (gerçek bağlantı yok). */
  onizleme?: string | null;
  /** ARVOLAB_TEK_PROJE: "1" ise üretim dışı ortamın ÜRETİM projesine bağlanması bilerek kabul edilir (supabaseOrtamKarari, "TEK PROJE BEYANI"). */
  tekProje?: string | null;
};

export type RedNedeni =
  | "adres-yok"
  | "adres-gecersiz"
  | "uretim-disi-uretime-bagli"
  | "uretim-disi-yapilandirma-eksik"
  | "uretim-disi-etiket-yanlis"
  | "uretim-disi-test-projesi-degil"
  | "yerel-supabase-vercelde"
  | "ref-bicimi-gecersiz"
  | "uretim-test-projesine-bagli"
  | "uretim-etiket-yanlis"
  | "uretim-projesi-degil"
  | "dagitim-ortami-celiskili";

export type OrtamKarari =
  | { tur: "izin"; ortam: DagitimOrtami; hedef: "uretim" | "test" | "yerel" | "sahte"; uyari?: string }
  | { tur: "red"; ortam: DagitimOrtami; neden: RedNedeni; mesaj: string };

/* Supabase proje kimliği: 20 küçük harf/rakam. */
const REF = /^[a-z0-9]{20}$/;

export function dagitimOrtami(vercelOrtami: string | null | undefined): DagitimOrtami {
  return vercelOrtami === "production" ? "uretim" : "uretim-disi";
}

/*
  ÇALIŞMA ANI + DERLEME ANI ORTAMI (Durak 0, 05.11.2026).
  Eskiden ortam yalnızca çalışma anındaki VERCEL_ENV'den okunuyordu. Vercel
  bu değişkeni normalde verir; ama bir gün çalışma anında gelmezse üretim
  sunucusu kendini "üretim dışı" sayar, test yapılandırması arar, bulamaz
  ve HER isteğe 503 döner. Önizleme bu hatayı göstermez: orada "yok" ile
  "preview" aynı sonucu verir. Derleme sırasında doğrulanan değer koda
  gömülüdür (next.config `env`); çalışma anı boşsa o kullanılır.

  - İkisi de var ve aynı      → o ortam.
  - Yalnızca biri var          → o ortam.
  - İkisi de yok               → üretim dışı (yerel geliştirme).
  - İkisi de var ve FARKLI     → çelişki, RET. Örnek: önizleme için
    derlenmiş (tarayıcı paketine test değerleri gömülü) bir paket üretim
    olarak çalışıyor. Hangisinin doğru olduğu bilinemez; bağlantı kurulmaz.
  Boş metin "yok" sayılır.
*/
export type DagitimCozumu = { tur: "tamam"; ortam: DagitimOrtami; kaynak: "calisma" | "derleme" | "yok" } | { tur: "celiski"; calisma: string; derleme: string };

export function dagitimOrtamiCoz(calisma: string | null | undefined, derleme: string | null | undefined): DagitimCozumu {
  const c = typeof calisma === "string" ? calisma.trim() : "";
  const d = typeof derleme === "string" ? derleme.trim() : "";
  if (c && d && c !== d) return { tur: "celiski", calisma: c, derleme: d };
  if (c) return { tur: "tamam", ortam: dagitimOrtami(c), kaynak: "calisma" };
  if (d) return { tur: "tamam", ortam: dagitimOrtami(d), kaynak: "derleme" };
  return { tur: "tamam", ortam: "uretim-disi", kaynak: "yok" };
}

/** Adresten proje kimliği: https://<ref>.supabase.co → ref; yerel Supabase → "yerel"; başka bir şey → null. */
export function projeKimligi(url: string | null | undefined): string | null {
  if (!url) return null;
  let adres: URL;
  try {
    adres = new URL(url);
  } catch {
    return null;
  }
  if (adres.hostname === "localhost" || adres.hostname === "127.0.0.1") return "yerel";
  const m = /^([a-z0-9]{20})\.supabase\.co$/.exec(adres.hostname);
  return adres.protocol === "https:" && m ? m[1] : null;
}

const temiz = (s: string | null | undefined) => (typeof s === "string" ? s.trim() : "");

export const TEK_PROJE_UYARISI =
  "Tek proje beyanı (ARVOLAB_TEK_PROJE=1): üretim dışı ortam ÜRETİM Supabase projesine bağlı. Burada yapılan her işlem canlı veriye yazılır.";

export function supabaseOrtamKarari(g: OrtamGirdisi): OrtamKarari {
  const cozum = dagitimOrtamiCoz(g.vercelOrtami, g.derlemeOrtami);
  if (cozum.tur === "celiski") {
    /* Taraflardan biri üretim diyorsa ortam "uretim" yazılır: günlükte üretimin etkilendiği görünsün. */
    const ortam: DagitimOrtami = cozum.calisma === "production" || cozum.derleme === "production" ? "uretim" : "uretim-disi";
    return {
      tur: "red",
      ortam,
      neden: "dagitim-ortami-celiskili",
      mesaj: `Dağıtım ortamı çelişkili: çalışma anı "${cozum.calisma}", derleme "${cozum.derleme}". Paket başka bir ortam için derlenmiş; yeniden dağıtın.`,
    };
  }
  const ortam = cozum.ortam;
  /* Vercel'de olup olmadığımız da iki kaynaktan: yerel Supabase yalnızca Vercel dışında. */
  const vercelde = Boolean(temiz(g.vercelOrtami) || temiz(g.derlemeOrtami));
  const red = (neden: RedNedeni, mesaj: string): OrtamKarari => ({ tur: "red", ortam, neden, mesaj });
  const uretimRef = temiz(g.uretimRef);
  const testRef = temiz(g.testRef);
  const etiket = temiz(g.etiket);

  if (ortam === "uretim-disi" && temiz(g.onizleme) === "1") return { tur: "izin", ortam, hedef: "sahte" };

  if (!temiz(g.supabaseUrl)) return red("adres-yok", "NEXT_PUBLIC_SUPABASE_URL tanımlı değil.");
  const ref = projeKimligi(g.supabaseUrl);
  if (!ref) return red("adres-gecersiz", "NEXT_PUBLIC_SUPABASE_URL bir Supabase proje adresi değil (https://<proje>.supabase.co).");
  if ((uretimRef && !REF.test(uretimRef)) || (testRef && !REF.test(testRef))) {
    return red("ref-bicimi-gecersiz", "ARVOLAB_URETIM_SUPABASE_REF / ARVOLAB_TEST_SUPABASE_REF biçimi geçersiz (20 küçük harf ve rakam).");
  }

  if (ortam === "uretim-disi") {
    /*
      TEK PROJE BEYANI (05.11.2026, kurum sahibinin kararı). Ayrı test
      projesi açılmadı; önizleme ve yerel geliştirme bilerek ÜRETİM
      projesine bağlanıyor. Beyan yalnızca adres tanımlı üretim kimliğini
      gösteriyorsa geçerli: kimlik bilinmeden ya da başka bir projeye karşı
      işe yaramaz, yani "rastgele bir projeye bağlan" demek değildir.
      Betiklerin kuralı (betikHedefKarari) bundan etkilenmez: şema kurulumu
      ve sentetik veri üretimde yine hiçbir koşulda çalışmaz.
    */
    if (uretimRef && ref === uretimRef && temiz(g.tekProje) === "1") {
      return { tur: "izin", ortam, hedef: "uretim", uyari: TEK_PROJE_UYARISI };
    }
    // Önce üretime bağlantı: yapılandırma eksik olsa da kimlik biliniyorsa en açık ret budur.
    if (uretimRef && ref === uretimRef) {
      return red("uretim-disi-uretime-bagli", "Üretim dışı ortam üretim Supabase projesine bağlanamaz (bilerek isteniyorsa ARVOLAB_TEK_PROJE=1).");
    }
    if (ref === "yerel") {
      return vercelde ? red("yerel-supabase-vercelde", "Vercel dağıtımı yerel Supabase adresine bağlanamaz.") : { tur: "izin", ortam, hedef: "yerel" };
    }
    if (!uretimRef || !testRef || !etiket) {
      return red(
        "uretim-disi-yapilandirma-eksik",
        "Üretim dışı ortamda ARVOLAB_SUPABASE_ORTAMI, ARVOLAB_URETIM_SUPABASE_REF ve ARVOLAB_TEST_SUPABASE_REF tanımlı olmalı; hangi projeye bağlanıldığı doğrulanamıyor.",
      );
    }
    if (uretimRef === testRef) return red("uretim-disi-yapilandirma-eksik", "Test ve üretim proje kimlikleri aynı olamaz.");
    if (etiket !== "test") return red("uretim-disi-etiket-yanlis", 'Üretim dışı ortamda ARVOLAB_SUPABASE_ORTAMI "test" olmalı.');
    if (ref !== testRef) return red("uretim-disi-test-projesi-degil", "Supabase adresi tanımlı test projesini göstermiyor.");
    return { tur: "izin", ortam, hedef: "test" };
  }

  // Üretim
  if (ref === "yerel") return red("uretim-projesi-degil", "Üretim yerel Supabase adresine bağlanamaz.");
  if (testRef && ref === testRef) return red("uretim-test-projesine-bagli", "Üretim test Supabase projesine bağlanamaz.");
  if (etiket && etiket !== "uretim") return red("uretim-etiket-yanlis", 'Üretimde ARVOLAB_SUPABASE_ORTAMI "uretim" olmalı.');
  if (!uretimRef) {
    return {
      tur: "izin",
      ortam,
      hedef: "uretim",
      uyari: "ARVOLAB_URETIM_SUPABASE_REF tanımlı değil: üretimin doğru projeye bağlandığı doğrulanamıyor (bağlantı kesilmedi).",
    };
  }
  if (ref !== uretimRef) return red("uretim-projesi-degil", "Supabase adresi tanımlı üretim projesini göstermiyor.");
  return { tur: "izin", ortam, hedef: "uretim" };
}

/*
  Sunucu anahtarının ait olduğu proje. Eski biçim anahtarlar (JWT) proje
  kimliğini ve rolü taşır; adresle başka projenin anahtarı birlikte
  verilmişse yakalanır. Yeni biçim (sb_secret_…, sb_publishable_…) opaktır,
  burada doğrulanamaz: null döner, karar adrese göre verilmiş olur.
  Yalnızca yükün AYRIŞTIRILMASI; imza doğrulanmaz, anahtar hiçbir yere
  yazılmaz.
*/
export function anahtarProjesi(anahtar: string | null | undefined): { ref: string | null; rol: string | null } | null {
  const parcalar = temiz(anahtar).split(".");
  if (parcalar.length !== 3) return null;
  try {
    const b64 = parcalar[1].replace(/-/g, "+").replace(/_/g, "/");
    const yuk = JSON.parse(atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, "="))) as { ref?: unknown; role?: unknown };
    return { ref: typeof yuk.ref === "string" ? yuk.ref : null, rol: typeof yuk.role === "string" ? yuk.role : null };
  } catch {
    return null;
  }
}

/** Anahtar başka bir projeye aitse ret mesajı; doğrulanamıyorsa ya da uyumluysa null. */
export function anahtarUyusmazligi(supabaseUrl: string | null | undefined, anahtar: string | null | undefined): string | null {
  const ref = projeKimligi(supabaseUrl);
  const a = anahtarProjesi(anahtar);
  if (!ref || ref === "yerel" || !a?.ref) return null;
  return a.ref === ref ? null : "Supabase anahtarı adresteki projeye ait değil.";
}

/**
 * process.env'den girdi; Next istemci paketinde de çalışır (değerler next.config'de gömülür).
 * `derlemeOrtami`: çağıran `process.env.ARVOLAB_DAGITIM_ORTAMI` yazarak verir — Next
 * yalnızca bu DÜZ yazımı derlemede değerle değiştirir; buradaki `env.X` okuması
 * çalışma anındaki nesneye bakar ve gömülü değeri GÖRMEZ.
 */
export function ortamGirdisi(env: Record<string, string | undefined>, derlemeOrtami?: string | null): OrtamGirdisi {
  return {
    vercelOrtami: env.VERCEL_ENV ?? env.NEXT_PUBLIC_VERCEL_ENV ?? null,
    derlemeOrtami: derlemeOrtami ?? null,
    supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL ?? null,
    etiket: env.ARVOLAB_SUPABASE_ORTAMI ?? null,
    uretimRef: env.ARVOLAB_URETIM_SUPABASE_REF ?? null,
    testRef: env.ARVOLAB_TEST_SUPABASE_REF ?? null,
    onizleme: env.ARVOLAB_ONIZLEME ?? null,
    tekProje: env.ARVOLAB_TEK_PROJE ?? null,
  };
}

/* Parametre özelliği (constructor(public …)) yok: Node'un tip ayıklaması onu çalıştıramaz. */
export class SupabaseOrtamHatasi extends Error {
  readonly karar: Extract<OrtamKarari, { tur: "red" }>;
  constructor(karar: Extract<OrtamKarari, { tur: "red" }>) {
    super(`Supabase ortam güvenliği: ${karar.mesaj} (${karar.neden})`);
    this.name = "SupabaseOrtamHatasi";
    this.karar = karar;
  }
}

/**
 * Bağlantı kurmadan önce çağrılır: ret varsa fırlatır, uyarı varsa bir kez
 * günlüğe yazar. Sunucu, tarayıcı, yönetim istemcisi ve ara katman AYNI
 * fonksiyonu kullanır.
 */
let uyarildi = false;
export function supabaseOrtaminiDogrula(env: Record<string, string | undefined>, derlemeOrtami?: string | null): Extract<OrtamKarari, { tur: "izin" }> {
  const karar = supabaseOrtamKarari(ortamGirdisi(env, derlemeOrtami));
  if (karar.tur === "red") throw new SupabaseOrtamHatasi(karar);
  if (karar.uyari && !uyarildi) {
    uyarildi = true;
    console.warn(`[supabase-ortam] ${karar.uyari}`);
  }
  return karar;
}

/*
  MİGRATION VE BETİK HEDEFİ (Aşama 1). `supabase db push`, şema kurulumu
  ve sentetik veri betikleri hedef projeyi buradan sorar
  (scripts/supabase-hedef.mjs). Varsayılan hedef TEST: üretime yalnızca
  açık bayrak (--uretim) VE tam onay cümlesiyle ("ÜRETİME UYGULA <ref>")
  izin verilir; sentetik veri üretime HİÇBİR koşulda yazılmaz.
*/
export type BetikTuru = "migration" | "sema-kurulumu" | "sentetik-veri";
export type HedefKarari = { tur: "izin"; hedef: "test" | "uretim" } | { tur: "red"; mesaj: string };

/*
  KODDA SABİT ÜRETİM KİMLİĞİ (05.11.2026). Betiklerin kararı eskiden
  YALNIZCA ortam değişkenlerine dayanıyordu: ARVOLAB_TEST_SUPABASE_REF ile
  ARVOLAB_URETIM_SUPABASE_REF yer değiştirirse üretim projesi "test"
  sayılıyor, şema kurulumu ve sentetik veri izin alıyordu. O gün zararı
  yalnızca ikinci bir kapı önlüyordu (kurulum dolu veritabanına kurmaz,
  sentetik veri ortam işaretini ister). Bu kimlik değişkenden OKUNMAZ;
  hangi değişken ne derse desin üretim projesi tanınır. Proje kimliği bir
  sır değildir (her istemcinin adresinde görünür).

  Kapsam BİLEREK betiklerle sınırlı: uygulamanın çalışma anı kararı
  (supabaseOrtamKarari) değişmedi — önizleme bugün ARVOLAB_TEK_PROJE=1
  beyanıyla bu projeye bağlanıyor. Üretim projesi bir gün değişirse bu
  satır da değişmeli; değişmezse yeni üretim projesi bu korumayı kaybeder
  (ama ortam değişkenli eski koruma sürer).
*/
export const SABIT_URETIM_SUPABASE_REF = "zpfpocyajnxcketdjbxm";

/**
 * Metinlerden herhangi biri (adres, kimlik, `supabase link` dosyası) sabit
 * üretim kimliğini İÇERİYOR mu. Ayrıştırmaya güvenmeyen ikinci denetim:
 * adres beklenmedik bir biçimdeyse ayrıştırıcı kimliği okuyamayabilir,
 * metin araması yine yakalar. Büyük/küçük harf ve URL kodlaması gözetilmez.
 */
export function uretimProjesiniGosteriyor(...metinler: (string | null | undefined)[]): boolean {
  return metinler.some((m) => {
    const ham = temiz(m).toLowerCase();
    if (!ham) return false;
    let cozulmus = ham;
    try {
      cozulmus = decodeURIComponent(ham);
    } catch {
      /* bozuk kodlama: ham metne bakılır */
    }
    return ham.includes(SABIT_URETIM_SUPABASE_REF) || cozulmus.includes(SABIT_URETIM_SUPABASE_REF);
  });
}

export function betikHedefKarari(g: {
  tur: BetikTuru;
  hedefRef: string | null | undefined;
  uretimRef: string | null | undefined;
  testRef: string | null | undefined;
  uretimIstendi?: boolean;
  onayMetni?: string | null;
}): HedefKarari {
  const hedef = temiz(g.hedefRef);
  const uretim = temiz(g.uretimRef);
  const test = temiz(g.testRef);
  /* Sabit kimlik denetimleri ortam değişkenli kurallardan ÖNCE: değişkenler yanlış olsa da sonuç değişmez. */
  if (uretimProjesiniGosteriyor(test)) {
    return { tur: "red", mesaj: "ARVOLAB_TEST_SUPABASE_REF üretim projesini gösteriyor; test ve üretim kimlikleri yer değiştirmiş olabilir." };
  }
  if (uretimProjesiniGosteriyor(hedef) && (g.tur === "sema-kurulumu" || g.tur === "sentetik-veri")) {
    return { tur: "red", mesaj: "Hedef üretim projesi (kodda sabit kimlik); bu betik üretimde hiçbir koşulda çalışmaz." };
  }
  if (!REF.test(hedef)) return { tur: "red", mesaj: "Hedef proje kimliği okunamadı ya da geçersiz." };
  if (!REF.test(uretim) || !REF.test(test)) return { tur: "red", mesaj: "ARVOLAB_URETIM_SUPABASE_REF ve ARVOLAB_TEST_SUPABASE_REF geçerli biçimde tanımlı olmalı." };
  if (uretim === test) return { tur: "red", mesaj: "Test ve üretim proje kimlikleri aynı olamaz." };
  if (hedef === test) return g.uretimIstendi ? { tur: "red", mesaj: "--uretim verildi ama hedef test projesi." } : { tur: "izin", hedef: "test" };
  if (hedef !== uretim) return { tur: "red", mesaj: "Hedef proje ne test ne üretim olarak tanımlı; bilinmeyen projeye uygulanmaz." };
  if (g.tur === "sentetik-veri" || g.tur === "sema-kurulumu") return { tur: "red", mesaj: "Bu betik üretim projesinde hiçbir koşulda çalışmaz." };
  if (!g.uretimIstendi) return { tur: "red", mesaj: "Hedef ÜRETİM projesi. Üretime uygulamak için --uretim bayrağı ve onay cümlesi gerekir." };
  if (temiz(g.onayMetni) !== `ÜRETİME UYGULA ${uretim}`) return { tur: "red", mesaj: `Onay cümlesi eksik ya da yanlış (beklenen: "ÜRETİME UYGULA <üretim kimliği>").` };
  return { tur: "izin", hedef: "uretim" };
}

/** Postgres bağlantı adresinden proje kimliği: db.<ref>.supabase.co ya da havuz kullanıcı adı postgres.<ref>. */
export function veritabaniAdresiProjesi(adres: string | null | undefined): string | null {
  let u: URL;
  try {
    u = new URL(temiz(adres));
  } catch {
    return null;
  }
  if (!/^postgres(ql)?:$/.test(u.protocol)) return null;
  const dogrudan = /^db\.([a-z0-9]{20})\.supabase\.co$/.exec(u.hostname);
  if (dogrudan) return dogrudan[1];
  const havuz = /^postgres\.([a-z0-9]{20})$/.exec(decodeURIComponent(u.username));
  return havuz && /\.pooler\.supabase\.com$/.test(u.hostname) ? havuz[1] : null;
}

/*
  ÜCRETLİ VE DIŞA GİDEN ANAHTARLAR (Aşama 1). Test ortamında üretimin AI,
  e-posta ve cron anahtarları KULLANILMAMALI. Bir anahtarın üretime mi
  teste mi ait olduğu değerinden anlaşılmaz; bu yüzden kural beyana
  dayanır: üretim dışında bu değişkenlerden biri tanımlıysa, Vercel'de
  ARVOLAB_TEST_ANAHTARLARI=1 ile "bunlar test anahtarı" diye AYRICA
  beyan edilmiş olmalı. Beyan yoksa derleme durur (next.config.ts).
  Eskiden önizleme OPENAI_API_KEY ve CRON_SECRET'in üretim değerlerini
  alıyordu (ikisi de Production + Preview hedefliydi).
  AI geçidinin koduna dokunulmaz: denetim yalnızca yapılandırmaya bakar.
*/
export const DIS_ANAHTARLAR = ["AI_ANAHTAR", "OPENAI_API_KEY", "RESEND_API_KEY", "CRON_SECRET", "PRODUCT_BRIDGE_SECRET"] as const;

export function anahtarAyrimiKarari(env: Record<string, string | undefined>): { tur: "izin"; uyari?: string } | { tur: "red"; mesaj: string } {
  if (dagitimOrtami(env.VERCEL_ENV) === "uretim") return { tur: "izin" };
  if (temiz(env.ARVOLAB_ONIZLEME) === "1") return { tur: "izin" };
  const tanimli = DIS_ANAHTARLAR.filter((ad) => temiz(env[ad]));
  if (!tanimli.length || temiz(env.ARVOLAB_TEST_ANAHTARLARI) === "1") return { tur: "izin" };
  /*
    Tek proje beyanı veritabanıyla birlikte dış anahtarları da kapsar: ayrı
    test anahtarı yok, önizleme üretimin anahtarlarını kullanıyor. Bu bir
    "test anahtarıdır" beyanı DEĞİL (o yalan olurdu); bilinen bir durumun
    kabulü. Uyarı derleme günlüğüne düşer.
  */
  if (temiz(env.ARVOLAB_TEK_PROJE) === "1") {
    return { tur: "izin", uyari: `Tek proje beyanı: üretim dışı ortam üretim anahtarlarını kullanıyor (${tanimli.join(", ")}).` };
  }
  return {
    tur: "red",
    mesaj: `Üretim dışı ortamda ${tanimli.join(", ")} tanımlı ama test anahtarı olduğu beyan edilmemiş (ARVOLAB_TEST_ANAHTARLARI=1). Üretim anahtarlarını bu ortamdan kaldırın ya da test anahtarlarıyla değiştirip beyan edin.`,
  };
}
