/*
  BEKLEYEN KAYIT DEVRİ (Signature OS 2.0 Aşama 2.1, 08.11.2026).

  SORUN (ölçüldü, 08.11.2026): tarayıcının geri/ileri düğmesi uygulama içi
  gezinme korumasını (lib/gezinme-korumasi.ts) atlıyor, çünkü Next App
  Router geçmiş hareketini `popstate` ile kendisi işliyor ve bu olay İPTAL
  EDİLEMİYOR. Editör kapanırken kaydı başlatıyordu ama SONUCUNU
  BEKLEMİYORDU: kayıt düşerse (bağlantı, oturum, sürüm çakışması) metin
  yalnızca tarayıcı taslağında kalıyor ve kullanıcıya hiçbir şey
  söylenmiyordu. Negatif kontrol: eski kodla "kayıt hatası varken geri"
  senaryosunda uyarı yok; başarılı geri/ileri senaryoları eski kodla da
  geçiyor (kayıt isteği gidiyordu). Bağlantı tıklamasında ise eski kayıt
  sunucuya HİÇ ulaşmıyordu (Aşama 2) — orada koruma geçişi bekletiyor.

  ÇÖZÜM: geçişi durdurmak değil (desteklenen ve güvenilir bir yolu yok;
  geçmiş kaydı hileleri kullanıcıyı geri/ileri döngüsüne sokar), kaydı
  geçişte KAYBETMEMEK. Editör kapanırken içeriğin anlık görüntüsünü alır
  ve kayıt işini buraya DEVREDER; sayfa değişse de yerinde kalan kabuk
  (gezinme-korumasi.tsx) gezinme bittikten sonra işi gönderir, geçici
  hatada yeniden dener. Kayıt olmazsa kullanıcının vardığı sayfada kalıcı
  bir uyarı durur: hangi çalışma, taslağın nerede olduğu, yeniden deneme ve
  çalışmaya dönüş. Sessiz kayıp yok; uyarı kayıt olana ya da kullanıcı
  çalışmaya dönene kadar kalkmaz.

  Bu dosya saf (React/Next yok): tests/unit/bekleyen-kayit.test.ts.
*/

export type DevirSonucu = { tur: "kaydedildi" } | { tur: "hata"; neden: string; kalici: boolean };

export type Devir = {
  /** Çalışma kimliği: aynı çalışmanın yeni devri eskisinin yerini alır (en güncel içerik). */
  anahtar: string;
  baslik: string;
  /** Çalışmaya dönüş adresi (editör). */
  adres: string;
  /** Kapanırken taslak tarayıcıya yazılabildi mi (lib/taslak-durumu.ts ile aynı dürüstlük). */
  taslakYazildi: boolean;
  gonder: () => Promise<DevirSonucu>;
};

export type DevirDurumu = Devir & { durum: "bekliyor" | "gonderiliyor" | "hata"; neden?: string; kalici?: boolean };

let liste: DevirDurumu[] = [];
const dinleyiciler = new Set<() => void>();
const yaz = (yeni: DevirDurumu[]) => {
  liste = yeni;
  dinleyiciler.forEach((d) => d());
};

export function devirAbone(d: () => void): () => void {
  dinleyiciler.add(d);
  return () => {
    dinleyiciler.delete(d);
  };
}
export const devirler = (): readonly DevirDurumu[] => liste;

/** Editör kapanırken: kayıt işini kabuğa devret. Aynı çalışmanın bekleyen devri yenisiyle değişir. */
export function kayitDevret(devir: Devir) {
  yaz([...liste.filter((d) => d.anahtar !== devir.anahtar), { ...devir, durum: "bekliyor" }]);
}

/*
  Editör aynı çalışma için yeniden açılınca HATALI devri bırakır: o andan
  sonra taslak teklifi editörün kendi akışıyla (taslağı geri yükle) sürer;
  iki ayrı yerden aynı metni yazmaya çalışmak çakışma üretirdi. Süren ya da
  bekleyen devre dokunulmaz: o kayıt bitsin.
*/
export function hataliDevriBirak(anahtar: string) {
  if (liste.some((d) => d.anahtar === anahtar && d.durum === "hata")) yaz(liste.filter((d) => !(d.anahtar === anahtar && d.durum === "hata")));
}

const uyu = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/*
  Bekleyenleri sırayla gönderir. Geçici hatada (bağlantı) birkaç kez
  bekleyerek yeniden dener; kalıcı hatada (oturum kapalı, yetki, sürüm
  çakışması) denemez, hemen uyarıya geçer. Aynı anda tek çalıştırma.
*/
let calisiyor = false;
export async function bekleyenleriGonder(secenek: { yenidenDeneme?: number; aralikMs?: number; uyu?: (ms: number) => Promise<void> } = {}) {
  if (calisiyor) return;
  calisiyor = true;
  const deneme = secenek.yenidenDeneme ?? 2;
  const aralik = secenek.aralikMs ?? 1500;
  const bekle = secenek.uyu ?? uyu;
  try {
    for (;;) {
      const sira = liste.find((d) => d.durum === "bekliyor");
      if (!sira) return;
      const durumYaz = (ek: Partial<DevirDurumu>) => yaz(liste.map((d) => (d === sira || (d.anahtar === sira.anahtar && d.gonder === sira.gonder) ? { ...d, ...ek } : d)));
      durumYaz({ durum: "gonderiliyor" });
      let sonuc: DevirSonucu = { tur: "hata", neden: "", kalici: false };
      for (let i = 0; i <= deneme; i++) {
        try {
          sonuc = await sira.gonder();
        } catch (hata) {
          sonuc = { tur: "hata", neden: hata instanceof Error ? hata.message : String(hata), kalici: false };
        }
        if (sonuc.tur === "kaydedildi" || sonuc.kalici) break;
        if (i < deneme) await bekle(aralik * (i + 1));
      }
      // Bu sırada aynı çalışmanın daha yeni bir devri geldiyse onun durumu korunur.
      const hala = liste.find((d) => d.anahtar === sira.anahtar);
      if (!hala || hala.gonder !== sira.gonder) continue;
      if (sonuc.tur === "kaydedildi") yaz(liste.filter((d) => d !== hala));
      else yaz(liste.map((d) => (d === hala ? { ...d, durum: "hata", neden: sonuc.neden, kalici: sonuc.kalici } : d)));
    }
  } finally {
    calisiyor = false;
  }
}

/** Uyarıdaki "Yeniden dene": hatalı devri yeniden sıraya alır. */
export function yenidenDene(anahtar: string) {
  yaz(liste.map((d) => (d.anahtar === anahtar && d.durum === "hata" ? { ...d, durum: "bekliyor", neden: undefined } : d)));
}

/** Testler için. */
export function _devirleriSifirla() {
  liste = [];
  calisiyor = false;
}
