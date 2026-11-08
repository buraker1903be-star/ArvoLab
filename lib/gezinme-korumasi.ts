/*
  GEZİNME KORUMASI (Signature OS 2.0 Aşama 2, 08.11.2026).

  Kurum sahibinin şartı: "Project Switcher ve diğer navigasyon
  geçişlerinde kaydedilmemiş metin kaybı olmamalı. Otomatik kayıt
  tamamlanmadan güvenli olmayan geçişe izin verme."

  ESKİDEN: editör kapanırken (panel içinde başka sayfaya geçiş) son
  değişiklikleri tarayıcıya taslak yazıp sunucuya kaydı BAŞLATIYOR ama
  SONUCUNU BEKLEMİYORDU. Kayıt düşerse (bağlantı, oturum, abonelik)
  kullanıcı çoktan başka sayfadaydı; metin yalnızca o tarayıcıdaki taslakta
  kalıyordu ve başka cihazdan açınca yoktu. Kullanıcı bunu bilmiyordu.

  ŞİMDİ: kaydedilmemiş metni olan bileşen (editör) burada bir KORUYUCU
  kaydettirir. Kabuk uygulama içi her geçişi (bağlantı tıklaması, komut
  paleti, çalışma değiştirici) bu modüle sorar: koruyucu kirliyse önce
  kayıt yapılır ve SONUCU beklenir; kayıt başarısızsa ya da zaman aşımına
  uğrarsa geçiş YAPILMAZ.

  Bu dosya saf: React/Next'e dokunmaz (tests/unit/gezinme-korumasi.test.ts).
  Kabuk tarafı: app/dashboard/_components/gezinme-korumasi.tsx.
*/

export type Koruyucu = {
  /** Kaydedilmemiş değişiklik ya da süren bir kayıt var mı? */
  kirliMi: () => boolean;
  /** Şimdi kaydet; sunucu kabul ettiyse true. */
  kaydet: () => Promise<boolean>;
  /*
    Kayıt düşünce kullanıcıya NE söyleneceği (Aşama 2.1, P2): taslak bu
    tarayıcıya gerçekten yazılabildi mi ve sunucunun verdiği neden. Pencere
    eskiden "taslak bu tarayıcıda tutuluyor" diyordu, depolama dolu ya da
    kapalıyken de — tam da sunucu kaydının başarısız olduğu anda.
  */
  durum?: () => { taslakYazildi: boolean; neden: string | null };
};

export type KayitSonucu = "temiz" | "kaydedildi" | "kaydedilemedi";

const koruyucular = new Set<Koruyucu>();

/** Koruyucuyu kaydeder; dönen işlev kaydı siler (bileşen kapanırken çağrılır). */
export function koruyucuKaydet(koruyucu: Koruyucu): () => void {
  koruyucular.add(koruyucu);
  return () => {
    koruyucular.delete(koruyucu);
  };
}

export function korumaGerekliMi(): boolean {
  for (const k of koruyucular) if (k.kirliMi()) return true;
  return false;
}

/*
  Varsayılan zaman aşımı 20 sn: büyük belgenin kaydı ağır bağlantıda
  birkaç saniye sürebiliyor, ama kullanıcıyı sonsuza kadar bekletmek de
  olmaz. Zaman aşımı "kaydedilemedi" sayılır — kayıt arka planda sürse
  bile sonucu bilinmeyen bir geçişe izin vermek şartı çiğner.
*/
export const KAYIT_ZAMAN_ASIMI_MS = 20_000;

export async function kaydiTamamla(zamanAsimiMs = KAYIT_ZAMAN_ASIMI_MS): Promise<KayitSonucu> {
  const kirliler = [...koruyucular].filter((k) => k.kirliMi());
  if (!kirliler.length) return "temiz";
  let zamanlayici: ReturnType<typeof setTimeout> | undefined;
  const asim = new Promise<false>((coz) => {
    zamanlayici = setTimeout(() => coz(false), zamanAsimiMs);
  });
  try {
    const sonuclar = await Promise.all(
      kirliler.map((k) =>
        Promise.race([
          k.kaydet().catch(() => false),
          asim,
        ]),
      ),
    );
    // Kayıt "başarılı" dese bile hâlâ kirliyse (kayıt sürerken yazılmış harf) güvenli değil.
    return sonuclar.every(Boolean) && !korumaGerekliMi() ? "kaydedildi" : "kaydedilemedi";
  } finally {
    clearTimeout(zamanlayici);
  }
}

/** Kirli koruyucuların kayıt durumu: kayıt düşünce pencere bunu söyler. */
export function koruyucuDurumu(): { taslakYazildi: boolean; neden: string | null } {
  let taslakYazildi = true;
  let neden: string | null = null;
  for (const k of koruyucular) {
    if (!k.kirliMi()) continue;
    // Durumunu söylemeyen koruyucu için taslak güvencesi VERİLMEZ: bilinmeyen, "yazıldı" değildir.
    const d = k.durum?.() ?? { taslakYazildi: false, neden: null };
    taslakYazildi &&= d.taslakYazildi;
    neden ??= d.neden;
  }
  return { taslakYazildi, neden };
}

/** Testler için: kayıtlı koruyucuları temizler. */
export function _koruyuculariSifirla() {
  koruyucular.clear();
}

/*
  BAĞLANTI TIKLAMASI UYGULAMA İÇİ BİR GEÇİŞ Mİ? Yalnızca bu durumda
  araya girilir; geri kalan her tıklama tarayıcıya ve Next'e bırakılır:
  - yeni sekme/pencere (Ctrl/Cmd/Shift/Alt, orta tuş, target=_blank):
    sayfa yerinde kalır, editör kapanmaz;
  - indirme bağlantısı, başka köken, mailto/tel;
  - aynı sayfanın çapası (#bolum): sayfa değişmez;
  - başka bir dinleyici zaten engellediyse.
*/
export type BaglantiTiklamasi = {
  href: string | null;
  target: string | null;
  download: boolean;
  dugme: number;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
  alt: boolean;
  engellendi: boolean;
};

export function uygulamaIciGecisMi(t: BaglantiTiklamasi, konum: { origin: string; pathname: string; search: string }): boolean {
  if (t.engellendi || !t.href) return false;
  if (t.dugme !== 0 || t.ctrl || t.meta || t.shift || t.alt) return false;
  if (t.download) return false;
  if (t.target && t.target !== "_self") return false;
  let hedef: URL;
  try {
    // Göreli adres BULUNULAN sayfaya göre çözülür ("#bolum" ve "?x=1" kökü değil bu sayfayı gösterir).
    hedef = new URL(t.href, `${konum.origin}${konum.pathname}${konum.search}`);
  } catch {
    return false;
  }
  if (hedef.origin !== konum.origin) return false;
  if (hedef.protocol !== "http:" && hedef.protocol !== "https:") return false;
  // Aynı sayfa ve aynı sorgu, yalnızca çapa farklı: sayfa değişmez, editör yerinde kalır.
  if (hedef.pathname === konum.pathname && hedef.search === konum.search && hedef.hash) return false;
  return true;
}
