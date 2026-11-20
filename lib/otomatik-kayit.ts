/*
  OTOMATİK KAYIT KARARLARI (Signature OS 5 / P52a1, 15.11.2026).

  Yazım editörünün kayıt akışı (app/dashboard/editor/[id]/write/
  manuscript-editor.tsx) 3.700 satırlık bileşenin içinde duruyordu ve
  hiçbir kararı test edilemiyordu: ne zaman gönderilir, ne zaman atlanır,
  bir hatadan sonra ne olur, taslak hangi anahtara yazılır. Bileşen artık
  bu kararları buradan okuyor; zamanlayıcı, localStorage ve sunucu çağrısı
  bileşende kaldı. Saf modül: Next, React, Supabase ya da window yok
  (AGENTS.md → tests/unit). Testi tests/unit/otomatik-kayit.test.ts.

  Davranış bilerek AYNI tutuldu; değişen iki şey var ve ikisi de bir hatayı
  kapatıyor:
    1. Bağlantı hatasında sabit 10 sn yerine üstel geri çekilme (en çok
       2 dk). Eskiden ağ kesintisinde tam belge (~1 MB'a kadar) 10 saniyede
       bir, sonsuza kadar yeniden gönderiliyordu.
    2. Yerel taslak SEKME başına. Eskiden aynı çalışmanın iki sekmesi aynı
       localStorage anahtarına yazıyordu: son yazan, öteki sekmenin
       kaydedilememiş metnini siliyordu.
*/

/* ---------- Zamanlama (bileşenden taşındı, değerler aynı) ---------- */

export const AUTOSAVE_DELAY_MS = 1500;
/* Büyük belgelerde (190 sayfalık tez ≈ 0,9 MB) her 1,5 sn'de tüm metni göndermek ve tarayıcı
   taslağına yazmak bağlantıyı ve cihazı yorar; aralık belgenin boyutuna göre açılır. */
export const LARGE_DOC_BYTES = 300_000;
export const autosaveDelay = (bytes: number) => (bytes > LARGE_DOC_BYTES ? 4000 : AUTOSAVE_DELAY_MS);
export const draftDelay = (bytes: number) => (bytes > LARGE_DOC_BYTES ? 3000 : 500);

/*
  BAĞLANTI HATASINDAN SONRA YENİDEN DENEME: 10 → 20 → 40 → 80 → 120 sn,
  sonra 120 sn'de sabit. İlk deneme eskisiyle aynı (10 sn): kısa bir
  kopmada kullanıcı farkı görmez. ±%20 sapma: aynı çalışmanın iki sekmesi
  (ya da kesinti dönüşü aynı anda uyanan çok sayıda öğrenci) sunucuya aynı
  saniyede yüklenmesin. Sapma da 2 dakikayı aşmaz.
*/
export const TEKRAR_ILK_MS = 10_000;
export const TEKRAR_EN_FAZLA_MS = 120_000;
const SAPMA = 0.2;

/** `deneme`: art arda başarısız bağlantı denemesi sayısı (1'den başlar). `rastgele`: [0,1). */
export function tekrarGecikmesi(deneme: number, rastgele: () => number = Math.random): number {
  const n = Math.max(1, Math.floor(deneme));
  const taban = Math.min(TEKRAR_EN_FAZLA_MS, TEKRAR_ILK_MS * 2 ** Math.min(n - 1, 10));
  const sapmali = taban * (1 + SAPMA * (2 * rastgele() - 1));
  return Math.round(Math.min(TEKRAR_EN_FAZLA_MS, Math.max(TEKRAR_ILK_MS * (1 - SAPMA), sapmali)));
}

/*
  Kullanıcı yazarken bir sonraki kaydın ne zaman deneneceği. Bağlantı
  hatası sürerken her tuş vuruşu yeniden 1,5 sn'lik bir deneme kurmamalı:
  geri çekilme, yazmaya devam eden kullanıcıda da geçerli (eskiden 10 sn'lik
  bekleme her tuşta 1,5 sn'ye iniyordu).
*/
export function sonrakiKayitGecikmesi(bytes: number, ardisikBaglantiHatasi: number, rastgele: () => number = Math.random): number {
  if (ardisikBaglantiHatasi > 0) return Math.max(autosaveDelay(bytes), tekrarGecikmesi(ardisikBaglantiHatasi, rastgele));
  return autosaveDelay(bytes);
}

/*
  Yazarken kurulan kaydın zamanı (markDirty). Geri çekilme sürerken
  BEKLEYEN denemenin bitiş zamanı korunur: yeni tuş vuruşu yalnızca
  gönderilecek metni günceller, deneme saatini ileri itmez. Eskiden
  (P52a1 ilk hâli) her tuş zamanlayıcıyı sıfırlayıp tam geri çekilme
  aralığını yeniden kuruyordu: tek bir hatadan sonra beş saniyede bir yazan
  kullanıcıda otomatik deneme hiç gelmiyor, bağlantı dönse bile kayıt ancak
  kullanıcı 10–120 sn durunca yapılıyordu (Codex incelemesi, 15.11.2026).
  Bekleyen deneme yoksa ya da süresi geçtiyse yeni bir aralık kurulur.
*/
export function yazarkenKayitZamani(
  simdi: number,
  bytes: number,
  ardisikBaglantiHatasi: number,
  bekleyenDenemeSonu: number | null,
  rastgele: () => number = Math.random,
): { gecikme: number; denemeSonu: number | null } {
  if (ardisikBaglantiHatasi > 0 && bekleyenDenemeSonu !== null && bekleyenDenemeSonu > simdi) {
    return { gecikme: bekleyenDenemeSonu - simdi, denemeSonu: bekleyenDenemeSonu };
  }
  const gecikme = sonrakiKayitGecikmesi(bytes, ardisikBaglantiHatasi, rastgele);
  return { gecikme, denemeSonu: ardisikBaglantiHatasi > 0 ? simdi + gecikme : null };
}

/* ---------- Gönderme kararı ---------- */

export type KayitKarari = "gonder" | "gerek-yok" | "uyumsuz" | "engelli";

/*
  Bir kayıt denemesinde istek gönderilecek mi? Sıra önemli:
    - uyumsuz içerikte "benim sürümümü kaydet" (zorla) de budanmış metni
      yazardı → hiç gönderilmez;
    - engel (çakışma, oturum, yetki/abonelik, eski sürüm) yalnızca zorla
      kayıtla aşılır;
    - metin değişmediyse (revizyon aynı) istek YOK — hayalet kaydın
      (R1, 14.11.2026) ikinci savunma hattı: bir "update" olayı belgeyi
      değiştirmeden gelse bile revizyon artmadıkça sunucuya gidilmez.
*/
export function kayitKarari(d: {
  icerikUyumsuz: boolean;
  engelli: boolean;
  zorla: boolean;
  revizyon: number;
  kaydedilenRevizyon: number;
}): KayitKarari {
  if (d.icerikUyumsuz) return "uyumsuz";
  if (d.engelli && !d.zorla) return "engelli";
  if (!d.zorla && d.revizyon === d.kaydedilenRevizyon) return "gerek-yok";
  return "gonder";
}

/* ---------- Sonuçtan sonraki durum ---------- */

export type KayitDurumu = "saved" | "dirty" | "saving" | "error" | "conflict";

export type SunucuSonucu =
  | { success: true; updatedAt: string }
  | { success?: false; error: string; conflict?: boolean; sessionExpired?: boolean; forbidden?: boolean; abonelik?: boolean };

export type SonucKarari = {
  durum: KayitDurumu;
  /** Otomatik kayıt durdurulur; yalnızca kullanıcı eylemi (yenile, zorla kaydet) açar. */
  engelle: boolean;
  oturumBitti: boolean;
  abonelikBitti: boolean;
  /** "geri-cekilme": bağlantı sorunu, tekrarGecikmesi ile yeniden denenir. "yeniden": araya yazılan metin var. */
  sonraki: "yok" | "geri-cekilme" | "yeniden";
  /** Art arda bağlantı hatası sayacının yeni değeri (başarıda ve kalıcı hatada sıfır). */
  ardisikBaglantiHatasi: number;
};

/*
  Sunucunun cevabı (ya da fırlatılan hata) → durum. Kalıcı hatalar
  (çakışma, oturum, yetki/abonelik, yeni sürüm yayınlandı) yeniden
  DENENMEZ: denemek asla başarmaz ve gerçek bir çakışmayı yeniden denemek
  er geç "zorla"ya varır — çakışma kullanıcıya bırakılır, sessizce üzerine
  yazılmaz. Yalnızca bağlantı sorunu ve tanınmayan sunucu hatası geri
  çekilmeyle yeniden denenir.
*/
export function kayitSonucuKarari(
  sonuc: { tur: "cevap"; cevap: SunucuSonucu } | { tur: "hata"; mesaj: string },
  d: { ardisikBaglantiHatasi: number; araYazildi: boolean },
): SonucKarari {
  const temel = { oturumBitti: false, abonelikBitti: false };
  if (sonuc.tur === "hata") {
    if (eskiSurumHatasiMi(sonuc.mesaj)) {
      return { ...temel, durum: "error", engelle: true, sonraki: "yok", ardisikBaglantiHatasi: 0 };
    }
    return { ...temel, durum: "error", engelle: false, sonraki: "geri-cekilme", ardisikBaglantiHatasi: d.ardisikBaglantiHatasi + 1 };
  }
  const c = sonuc.cevap;
  if (c.success) {
    return { ...temel, durum: d.araYazildi ? "dirty" : "saved", engelle: false, sonraki: d.araYazildi ? "yeniden" : "yok", ardisikBaglantiHatasi: 0 };
  }
  if (c.conflict) return { ...temel, durum: "conflict", engelle: true, sonraki: "yok", ardisikBaglantiHatasi: 0 };
  if (c.sessionExpired) return { ...temel, durum: "error", engelle: true, oturumBitti: true, sonraki: "yok", ardisikBaglantiHatasi: 0 };
  if (c.forbidden) return { ...temel, durum: "error", engelle: true, abonelikBitti: Boolean(c.abonelik), sonraki: "yok", ardisikBaglantiHatasi: 0 };
  // Tanınmayan sunucu hatası (geçici veritabanı sorunu vb.): bağlantı hatası gibi geri çekilerek.
  return { ...temel, durum: "error", engelle: false, sonraki: "geri-cekilme", ardisikBaglantiHatasi: d.ardisikBaglantiHatasi + 1 };
}

/*
  Yeni sürüm yayınlanınca açık sayfadaki server action kimliği geçersizleşir
  ("Failed to find Server Action"). Bu ağ hatası değil: yeniden denemek asla
  başarmaz, sayfa yenilenmelidir.
*/
export function eskiSurumHatasiMi(mesaj: string): boolean {
  return /Failed to find Server Action|Server Action .* was not found/i.test(mesaj);
}

/* ---------- Tek uçuş ---------- */

/*
  AYNI ANDA TEK KAYIT. Bir kayıt sürerken gelen çağrı öncekinin bitmesini
  bekler, sonra KENDİ işini çalıştırır; iş, kararını (kayitKarari) beklemeden
  sonra verdiği için öncekinin kaydettiği metni ikinci kez göndermez
  ("gerek-yok"). Aynı anda bekleyen birden çok çağrı da sırayla, tek tek
  çalışır: bekleme döngüsü her uyanışta yeniden bakar, çünkü bir önceki
  bekleyen o arada yeni bir uçuş başlatmış olabilir. Bileşendeki eski
  `while (inFlightRef.current) await …` ile aynı sözleşme, artık testli.
*/
export function tekUcusluCalistirici<T>() {
  let ucusta: Promise<T> | null = null;
  return {
    get mesgul() {
      return ucusta !== null;
    },
    async calistir(is: () => Promise<T>): Promise<T> {
      while (ucusta) {
        try {
          await ucusta;
        } catch {
          // öncekinin hatası bu çağrının sonucu değil
        }
      }
      const p = is();
      ucusta = p;
      try {
        return await p;
      } finally {
        if (ucusta === p) ucusta = null;
      }
    },
  };
}

/* ---------- Yerel taslak: sekme başına anahtar ---------- */

/*
  Anahtar biçimleri (hepsi okunur, yalnızca sonuncusu yazılır):
    arvolab:manuscript-draft:<çalışma>                       — 29.10.2026 öncesi
    arvolab:manuscript-draft:<çalışma>:<kullanıcı>           — 29.10–15.11.2026, sekmeler ortak
    arvolab:manuscript-draft:<çalışma>:<kullanıcı>:<sekme>   — P52a1
  Sekme kimliği SAYFA YÜKLEMESİ başına üretilir (sessionStorage DEĞİL:
  "sekmeyi çoğalt" sessionStorage'ı kopyalıyor ve iki sekme yine aynı
  anahtara yazardı). Yeniden yüklenen sekme yeni anahtar alır; önceki
  yüklemenin taslağı açılışta bulunup önerilir — kurtarma deneyimi aynı.
  Kullanıcı kimliği yoksa (oturum çözülemedi) ortak anahtar kullanılır;
  başkasının taslağını öğrenciye göstermemek, sekme ayrımından önemli.
*/
const ONEK = "arvolab:manuscript-draft:";

export function taslakAnahtari(projectId: string, kullaniciId: string | null, sekmeId: string | null): string {
  if (!kullaniciId) return `${ONEK}${projectId}`;
  return sekmeId ? `${ONEK}${projectId}:${kullaniciId}:${sekmeId}` : `${ONEK}${projectId}:${kullaniciId}`;
}

/*
  Bu kullanıcının bu çalışmaya ait taslak anahtarı mı? Başka çalışmanın ya
  da başka kullanıcının anahtarı ASLA eşleşmez (ortak bilgisayarda
  danışmanın öğrencinin taslağını görmesi 29.10.2026'da kapatıldı). Eski
  kullanıcısız anahtar geçiş dönemi okunur: içindeki metin kaybolmasın.
*/
export function taslakAnahtariMi(anahtar: string, projectId: string, kullaniciId: string | null): boolean {
  const kok = `${ONEK}${projectId}`;
  if (anahtar === kok) return true;
  if (!kullaniciId) return false;
  const kullaniciKoku = `${kok}:${kullaniciId}`;
  if (anahtar === kullaniciKoku) return true;
  return anahtar.startsWith(`${kullaniciKoku}:`) && /^[A-Za-z0-9-]{1,64}$/.test(anahtar.slice(kullaniciKoku.length + 1));
}

export type YerelTaslak<D> = { content: D; baseUpdatedAt: string | null; writtenAt: string };

/*
  KURTARILABİLİR TASLAKLAR: bu kullanıcının bu çalışmaya ait taslakları,
  EN YENİDEN eskiye. Açılışta ilki önerilir; ötekiler aynı teklif bandından
  ("Öncekini göster") erişilebilir kalır. Eskiden yalnızca en yeni görünüyor,
  öncekine ancak en yeni çözülüp sayfa yeniden açılınca ulaşılıyordu — iki
  sekmenin ayrı kaydedilmemiş metni varsa biri gözden kaçabiliyordu. Bozuk ya
  da tarihsiz kayıt listeye girmez. Eşit tarihte anahtar sırası
  belirleyicidir: aynı girdi her açılışta aynı sırayı versin.
*/
export function kurtarilabilirTaslaklar<D>(
  kayitlar: { anahtar: string; ham: string | null }[],
  projectId: string,
  kullaniciId: string | null,
): { anahtar: string; taslak: YerelTaslak<D> }[] {
  const liste: { anahtar: string; taslak: YerelTaslak<D>; zaman: number }[] = [];
  for (const { anahtar, ham } of kayitlar) {
    if (!ham || !taslakAnahtariMi(anahtar, projectId, kullaniciId)) continue;
    let taslak: YerelTaslak<D>;
    try {
      taslak = JSON.parse(ham) as YerelTaslak<D>;
    } catch {
      continue;
    }
    const zaman = Date.parse(taslak?.writtenAt ?? "");
    if (!taslak || taslak.content == null || !Number.isFinite(zaman)) continue;
    liste.push({ anahtar, taslak, zaman });
  }
  liste.sort((a, b) => b.zaman - a.zaman || a.anahtar.localeCompare(b.anahtar));
  return liste.map(({ anahtar, taslak }) => ({ anahtar, taslak }));
}

/** Açılışta önerilecek taslak: kurtarilabilirTaslaklar'ın ilki (en yeni). */
export function onerilecekTaslak<D>(
  kayitlar: { anahtar: string; ham: string | null }[],
  projectId: string,
  kullaniciId: string | null,
): { anahtar: string; taslak: YerelTaslak<D> } | null {
  return kurtarilabilirTaslaklar<D>(kayitlar, projectId, kullaniciId)[0] ?? null;
}

/*
  TEKLİF SIRASI (teklif bandının iki düğmesi). "Öncekini göster": gösterilen
  sıranın sonuna gider, sıradaki öne gelir — döngü, hiçbir taslak
  düşmez. "Yok say": YALNIZCA gösterilen taslak çıkar (çağıran onun
  anahtarını siler), sıradaki önerilir; liste biterse teklif kapanır.
*/
export function sonrakiTeklif<T>(sira: T[]): T[] {
  return sira.length > 1 ? [...sira.slice(1), sira[0]] : sira;
}
export function teklifiYokSay<T>(sira: T[]): T[] {
  return sira.slice(1);
}

/*
  DIŞA AKTARMADAN ÖNCE KAYDEDİLMEMİŞ TASLAK (20.11.2026). Word ve teslim
  paketi (ZIP) sunucudaki son KAYITTAN üretiliyor. Bu tarayıcıda o kayıttan
  daha yeni bir taslak varsa (kayıt başarısız oldu, sekme kapandı) indirilen
  dosya eski sürüm olur ve bunu kimse söylemiyordu. Bu işlev o durumu bulur;
  çağıran indirmeyi yapmaz ve kullanıcıyı editöre yönlendirir.

  Kullanıcı kimliğine bakılmaz (dışa aktaran kendi tarayıcısında): bu
  çalışmanın herhangi bir taslağı, kayıttan yeniyse yeter. Yanlış bir
  "kaydedilmemiş değişiklik var" uyarısı yalnızca bekletir; kaçırılan bir
  taslak eski sürümü teslim ettirir.
*/
export function kaydedilmemisTaslakVar(
  kayitlar: { anahtar: string; ham: string | null }[],
  projectId: string,
  sunucuGuncelleme: string | null,
): boolean {
  const kayitZamani = Date.parse(sunucuGuncelleme ?? "");
  const kok = `${ONEK}${projectId}`;
  return kayitlar.some(({ anahtar, ham }) => {
    if (!ham || (anahtar !== kok && !anahtar.startsWith(`${kok}:`))) return false;
    try {
      const taslak = JSON.parse(ham) as { writtenAt?: string; content?: unknown };
      const yazildi = Date.parse(taslak?.writtenAt ?? "");
      if (taslak?.content == null || !Number.isFinite(yazildi)) return false;
      // Kayıt zamanı bilinmiyorsa taslağın kendisi yeterli kanıt.
      return !Number.isFinite(kayitZamani) || yazildi > kayitZamani;
    } catch {
      return false;
    }
  });
}
