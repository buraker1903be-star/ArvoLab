/*
  KABUL KATALOĞU (G1 Aşama 5, 10.11.2026): her kabul betiğinin hangi
  önizleme sunucusuyla ve hangi argümanlarla koşulacağı TEK yerde.

  Neden: ön koşullar yalnızca dosya başlarındaki yorumlarda yazılıydı ve
  yanlış sunucuya karşı koşulan betik sıradan bir FAIL veriyordu. 10.11.2026'da
  yazma kipi kapalı bir sunucuya karşı otomatik kayıt kabulü "çakışma
  gösterilmedi" diye düştü ve bir ürün hatası sanıldı; aynı koşuda sekiz
  betik daha eksik bayrak ya da yanlış argümanla "iki sürümde de düşüyor"
  göründü. Bu tablo iki yerden okunur ve ikisi aynı cevabı almalı:
    - scripts/onizleme/onkosul.mjs: betik kendi kipinin ön koşulunu
      sunucunun bayrak beyanıyla (x-arvolab-onizleme) karşılaştırır,
      eksikse çıkış kodu 2 ile durur;
    - scripts/onizleme/kabul-hepsi.mjs: her kipi kendi bayraklarıyla
      başlatılmış ayrı bir sunucuda koşar.
  Tabloyu tests/unit/kabul-katalogu.test.ts denetler (her betik listede,
  her kipin bayrağı geçerli).

  gerekli: sunucunun beyanında olması gereken değerler. Burada YAZILMAYAN
  anahtarlar için: yaz ve ai serbesttir (betik iki hâlde de çalışır);
  senaryo, oturum, abonelik, hak, bos ve rol varsayılan olmalıdır — örnek
  veri değişmişse ekrana dayanan denetimler anlamsızlaşır.
  arg: betiğin argümanları; {taban}, {gunluk} (sunucu günlüğü dosyası) ve
  {yakalama} (zincirin paylaştığı dosya) koşturucuda doldurulur.
  taze: betik bellekteki örnek verinin değişmemiş olmasını varsayıyor;
  koşturucu her kip için zaten yeni sunucu açar, bu işaret elle koşanlar
  için ön koşul mesajına eklenir.
  zincir: aynı zincirdeki kipler SIRAYLA ve aynı .next önbelleğiyle
  koşmalı (ai-yetki: ilk kip sunucu eylemi isteğini yakalar, ötekiler onu
  oynatır; önbellek silinirse eylem kimliği değişir ve oynatma 404 alır).
*/

export const VARSAYILAN = {
  yaz: "0",
  ai: "0",
  senaryo: "varsayilan",
  oturum: "var",
  abonelik: "yok",
  hak: "var",
  bos: "0",
  rol: "varsayilan",
};
/* Yazılmadığında iki değeri de kabul edilen anahtarlar. */
export const SERBEST = ["yaz", "ai"];

const T = ["{taban}"];
const yazAi = { yaz: "1", ai: "1" };

export const KATALOG = {
  "ai-iz-kabul": { kipler: { varsayilan: { gerekli: yazAi, arg: T } } },
  "ai-kabul": { kipler: { varsayilan: { gerekli: yazAi, arg: T } } },
  "ai-yetki-kabul": {
    kipler: {
      yabanci: { gerekli: { ai: "1" }, arg: ["yabanci", "{yakalama}", "{taban}"], zincir: "ai-yetki" },
      oturumsuz: { gerekli: { ai: "1", oturum: "yok" }, arg: ["oturumsuz", "{yakalama}", "{taban}"], zincir: "ai-yetki" },
      abonelik: { gerekli: { ai: "1", abonelik: "bitti" }, arg: ["abonelik", "{yakalama}", "{taban}"], zincir: "ai-yetki" },
      hak: { gerekli: { ai: "1", hak: "bitti" }, arg: ["hak", "{yakalama}", "{taban}"], zincir: "ai-yetki" },
    },
  },
  "arac-cubugu-kabul": { kipler: { varsayilan: { gerekli: yazAi, arg: T } } },
  "asistan-paneli-kabul": { kipler: { varsayilan: { gerekli: {}, arg: T } } },
  "belge-geometri-kabul": {
    kipler: {
      varsayilan: { gerekli: {}, arg: T },
      kilavuz: { gerekli: { senaryo: "kilavuz-eski" }, arg: ["{taban}", "--kilavuz"] },
    },
  },
  "cikti-kabul": { kipler: { varsayilan: { gerekli: {}, arg: T, taze: true } } },
  "dogrulama-kabul": { kipler: { varsayilan: { gerekli: { oturum: "yok" }, arg: T } } },
  "doi-kotasi-kabul": { kipler: { varsayilan: { gerekli: { yaz: "1" }, arg: ["{gunluk}", "{taban}"], taze: true } } },
  "dokunma-kabul": { kipler: { varsayilan: { gerekli: {}, arg: T } } },
  "editor-merkezi-kabul": { kipler: { varsayilan: { gerekli: {}, arg: T } } },
  "gec-yanit-kabul": { kipler: { varsayilan: { gerekli: yazAi, arg: T } } },
  "genel-bakis-kabul": {
    kipler: {
      dolu: { gerekli: { bos: "0" }, arg: T },
      bos: { gerekli: { bos: "1" }, arg: T },
    },
  },
  "genel-bakis-sadelik-kabul": { kipler: { varsayilan: { gerekli: {}, arg: T } } },
  "gezinme-korumasi-kabul": { kipler: { varsayilan: { gerekli: yazAi, arg: T, taze: true } } },
  "kabuk-kabul": { kipler: { varsayilan: { gerekli: {}, arg: T } } },
  kabul: { kipler: { varsayilan: { gerekli: {}, arg: T } } },
  "kagit-gorunumu-kabul": { kipler: { varsayilan: { gerekli: {}, arg: T } } },
  "kagit-kabul": { kipler: { varsayilan: { gerekli: {}, arg: T } } },
  "kayit-kabul": {
    kipler: {
      varsayilan: { gerekli: { yaz: "1" }, arg: T, taze: true },
      "kilavuz-eski": { gerekli: { yaz: "1", senaryo: "kilavuz-eski" }, arg: ["{taban}", "--senaryo=kilavuz-eski"], taze: true },
      uyumsuz: { gerekli: { yaz: "1", senaryo: "uyumsuz" }, arg: ["{taban}", "--senaryo=uyumsuz"], taze: true },
      acilamadi: { gerekli: { yaz: "1", senaryo: "acilamadi" }, arg: ["{taban}", "--senaryo=acilamadi"], taze: true },
    },
  },
  "kaynak-ekleme-kabul": { kipler: { varsayilan: { gerekli: { yaz: "1" }, arg: T } } },
  "kaynak-kabul": { kipler: { varsayilan: { gerekli: { yaz: "1" }, arg: T } } },
  "kilavuz-bildirim-kabul": {
    kipler: {
      varsayilan: { gerekli: {}, arg: T },
      kilavuz: { gerekli: { senaryo: "kilavuz-eski" }, arg: ["{taban}", "--kilavuz"] },
    },
  },
  "klavye-kabul": { kipler: { varsayilan: { gerekli: yazAi, arg: T } } },
  "makale-kabul": { kipler: { varsayilan: { gerekli: yazAi, arg: T } } },
  "mobil-odak-kabul": { kipler: { varsayilan: { gerekli: {}, arg: T } } },
  "odak-esc-kabul": {
    kipler: {
      varsayilan: { gerekli: {}, arg: T },
      ai: { gerekli: { ai: "1" }, arg: ["{taban}", "--ai"] },
    },
  },
  "odak-kabul": { kipler: { varsayilan: { gerekli: {}, arg: T } } },
  "tablo-kabul": { kipler: { varsayilan: { gerekli: {}, arg: T } } },
  "yazim-hiyerarsi-kabul": { kipler: { varsayilan: { gerekli: {}, arg: T } } },
};

/** Beyan metnini ("yaz=1;ai=0;…") nesneye çevirir; çözülemeyen çift yok sayılır. */
export function beyaniCoz(metin) {
  const sonuc = {};
  for (const cift of String(metin ?? "").split(";")) {
    const [a, d] = cift.split("=");
    if (a && d !== undefined) sonuc[a.trim()] = d.trim();
  }
  return sonuc;
}

/**
 * Kipin ön koşulu beyanla karşılanıyor mu? Eksikler listesi döner (boş = tamam).
 * Her eksik: { anahtar, beklenen, bulunan }.
 */
export function eksikler(kip, beyan) {
  const sonuc = [];
  for (const anahtar of Object.keys(VARSAYILAN)) {
    const bulunan = beyan[anahtar];
    if (anahtar in kip.gerekli) {
      if (bulunan !== kip.gerekli[anahtar]) sonuc.push({ anahtar, beklenen: kip.gerekli[anahtar], bulunan });
    } else if (!SERBEST.includes(anahtar) && bulunan !== VARSAYILAN[anahtar]) {
      sonuc.push({ anahtar, beklenen: VARSAYILAN[anahtar], bulunan });
    }
  }
  return sonuc;
}

/** Kipin istediği sunucu ortamı (koşturucu bununla başlatır; elle koşana da bu komut önerilir). */
export function sunucuOrtami(kip) {
  const g = kip.gerekli;
  const ortam = { ARVOLAB_ONIZLEME: "1" };
  if (g.yaz === "1") ortam.ONIZLEME_YAZ = "1";
  if (g.ai === "1") Object.assign(ortam, { ONIZLEME_AI: "1", AI_ANAHTAR: "onizleme" });
  if (g.senaryo && g.senaryo !== "varsayilan") ortam.ONIZLEME_SENARYO = g.senaryo;
  if (g.oturum === "yok") ortam.ONIZLEME_OTURUM = "yok";
  if (g.abonelik && g.abonelik !== "yok") ortam.ONIZLEME_ABONELIK = g.abonelik;
  if (g.hak === "bitti") ortam.ONIZLEME_HAK = "bitti";
  if (g.bos === "1") ortam.ONIZLEME_BOS = "1";
  if (g.rol && g.rol !== "varsayilan") ortam.ONIZLEME_ROL = g.rol;
  return ortam;
}
