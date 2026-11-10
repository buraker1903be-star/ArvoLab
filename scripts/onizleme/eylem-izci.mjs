/*
  SUNUCU EYLEMİ İZCİSİ (G1 Aşama 5, 10.11.2026): "editör boştayken sunucuya
  istek gitmedi" denetiminin gözlemcisi (arac-cubugu-kabul.mjs).

  Eskiden açılışın bittiği an sabit 700 ms beklemeyle varsayılıyordu ve
  "sonraki her sunucu eylemi" hata sayılıyordu. Makine yüklüyken açılışın
  kendi okuması (getLiteratureSources: Kaynaklar listesi) bu sınırdan 0,1–
  0,2 sn sonra geliyor ve "boştayken 1 sunucu isteği" diye düşüyordu
  (10.11.2026'da 45 açılışta 3 kez yeniden üretildi; 36 sakin açılışta 0).
  Hayalet kayıt değildi, ama denetim ikisini ayıramıyordu.
  Artık:
    - açılış, bekleyen sunucu eylemi kalmayınca ve belirli bir süre yeni
      eylem gelmeyince BİTMİŞ sayılır (sabit süre yok, üst sınır var);
    - boştaki eylemler sınıflandırılır: belge yazımı ("type":"doc" taşıyan
      gövde) ve açılışta görülmemiş eylem HATA; açılışta görülmüş bir
      okumanın gecikmiş tekrarı hata değildir ama rapora yazılır.
  Raporda gövdenin İÇERİĞİ yok: eylem adı, kimliğin başı, tür, bayt ve
  argüman sayısı. Belge metni ya da başka bir değer günlüğe girmez.
*/

/** İstemci paketindeki createServerReference çağrılarından kimlik → eylem adı. */
export function eylemAdlariniCoz(js) {
  const adlar = {};
  const kalip = /createServerReference[^(]*\)\(\s*"([0-9a-f]{40,})"/g;
  for (let m; (m = kalip.exec(js)); ) {
    const ad = js.slice(m.index + m[0].length, m.index + m[0].length + 1500).match(/"([A-Za-z_$][\w$]*)"\s*\)/);
    if (ad) adlar[m[1]] = ad[1];
  }
  return adlar;
}

/** Bir isteğin gövdesinden yalnızca biçimi çıkarır (içerik saklanmaz). */
export function istekBicimi(govde) {
  const metin = String(govde ?? "");
  let argumanSayisi = null;
  try {
    const cozulen = JSON.parse(metin);
    if (Array.isArray(cozulen)) argumanSayisi = cozulen.length;
  } catch {
    /* çok parçalı (FormData) gövde: sayı bilinmiyor */
  }
  return { belgeYazimi: /"type":"doc"/.test(metin), bayt: Buffer.byteLength(metin), argumanSayisi };
}

/**
 * Boştaki eylemleri sınıflandırır.
 * tur: "belge-yazimi" (HATA) | "beklenmeyen" (HATA) | "acilis-tekrari" (bilgi).
 */
export function bostakileriSiniflandir(bostakiler, acilisKimlikleri) {
  return bostakiler.map((i) => ({
    ...i,
    tur: i.belgeYazimi ? "belge-yazimi" : acilisKimlikleri.has(i.kimlik) ? "acilis-tekrari" : "beklenmeyen",
  }));
}

export const hataMi = (i) => i.tur !== "acilis-tekrari";

export function anlat(i) {
  const arg = i.argumanSayisi === null ? "?" : i.argumanSayisi;
  return `${i.ad ?? "(adı çözülemedi)"} [${i.kimlik.slice(0, 12)}] ${i.tur}, POST, gövde ${i.bayt} bayt, ${arg} argüman, yanıt ${i.durum ?? "bekliyor"}`;
}

/**
 * Sayfaya bağlanır; sayfa açılmadan ÖNCE çağrılmalı (paketler ve istekler
 * baştan görülsün).
 */
export function eylemIzci(sayfa) {
  const adlar = {};
  const istekler = [];
  const bekleyen = new Map();
  let sonOlay = Date.now();
  sayfa.on("response", async (r) => {
    if (!/\.js(\?|$)/.test(r.url())) return;
    try {
      Object.assign(adlar, eylemAdlariniCoz(await r.text()));
    } catch {
      /* gövdesi okunamayan paket: ad "(adı çözülemedi)" kalır */
    }
  });
  sayfa.on("request", (r) => {
    const kimlik = r.headers()["next-action"];
    if (r.method() !== "POST" || !kimlik) return;
    const kayit = { kimlik, zaman: Date.now(), durum: null, ...istekBicimi(r.postData()) };
    istekler.push(kayit);
    bekleyen.set(r, kayit);
    sonOlay = Date.now();
  });
  const bitti = (r, durum) => {
    const kayit = bekleyen.get(r);
    if (!kayit) return;
    kayit.durum = durum;
    bekleyen.delete(r);
    sonOlay = Date.now();
  };
  sayfa.on("requestfinished", async (r) => bitti(r, (await r.response())?.status() ?? "yanıtsız"));
  sayfa.on("requestfailed", (r) => bitti(r, `başarısız (${r.failure()?.errorText ?? "?"})`));

  return {
    /**
     * Açılış okumaları bitene kadar bekler: bekleyen eylem yok ve `sessiz` ms
     * boyunca yeni eylem gelmedi. `azami` aşılırsa yine döner (bekleyenler
     * rapora girer); bekleme süresi denetim değildir, bir sınırdır.
     */
    async acilisiBekle({ sessiz = 1200, azami = 20000 } = {}) {
      const bas = Date.now();
      while (Date.now() - bas < azami && (bekleyen.size > 0 || Date.now() - sonOlay < sessiz)) {
        await sayfa.waitForTimeout(100);
      }
      return { sinir: istekler.length, kimlikler: new Set(istekler.map((i) => i.kimlik)), bekleyen: bekleyen.size, sure: Date.now() - bas };
    },
    /** Sınırdan sonraki eylemler, adları çözülmüş ve sınıflandırılmış. */
    bostakiler(acilis) {
      const sonrakiler = istekler.slice(acilis.sinir).map((i) => ({ ...i, ad: adlar[i.kimlik] }));
      return bostakileriSiniflandir(sonrakiler, acilis.kimlikler);
    },
  };
}
