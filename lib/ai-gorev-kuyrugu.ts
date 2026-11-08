/*
  ASİSTAN GÖREV KUYRUĞU (V4.3-0 P0-1, 08.11.2026).

  ESKİ HATA: seçim üstündeki Arvo AI menüsünden (Akademikleştir, Kısalt,
  Genişlet) gelen görev tek bir değişkende bekletiliyordu. Panel görevi
  ALIP siliyor, sonra gonder() önceki yanıt beklendiği için erken
  dönüyordu: görev hiçbir iz bırakmadan kayboluyordu. Menü çoktan
  kapanmıştı, kullanıcıya hiçbir şey söylenmiyordu.

  ŞİMDİ: görevler sırayla bekler. Panel yalnızca boşken görev alır.
  Görev, menüye basıldığı andaki seçimi taşır (izlenen aralığın kimliği ve
  metni): sırası geldiğinde o anki seçim değil, kullanıcının seçtiği metin
  işlenir. Metin arada değiştiyse görev işlenmez ve neden söylenir
  (yazim-paneli.tsx).

  Saf modül: tarayıcıya, React'e ve editöre dokunmaz
  (tests/unit/ai-gorev-kuyrugu.test.ts).
*/

export type DisGorev = "akademik" | "kisalt" | "genislet";

export type KuyrukGorevi = {
  gorev: DisGorev;
  /** İzlenen aralığın kimliği (lib/tiptap-asistan-araligi.ts); menüye basıldığı anda izlemeye alınır. */
  oneriId: string;
  /** O anki seçimin metni: sırası gelince aralık hâlâ bu metni taşımalı. */
  secimMetni: string;
};

/*
  Üst sınır: her görev bir asistan isteği ve bir kredi. Sınırsız sıra, yanlışlıkla
  art arda basılan düğmenin kullanıcının bilmediği istekler biriktirmesi
  demek.
*/
export const KUYRUK_EN_FAZLA = 3;

export type EklemeSonucu = "eklendi" | "dolu" | "yinelendi";

export type GorevKuyrugu = {
  ekle(g: KuyrukGorevi): EklemeSonucu;
  /** Sıradaki görevi alır ve kuyruktan çıkarır (aynı görev iki kez işlenmesin). */
  al(): KuyrukGorevi | null;
  uzunluk(): number;
  /** Kuyruğu boşaltır; çıkarılan görevleri döndürür (izledikleri aralıklar bırakılsın diye). */
  bosalt(): KuyrukGorevi[];
};

export function gorevKuyrugu(enFazla = KUYRUK_EN_FAZLA): GorevKuyrugu {
  let liste: KuyrukGorevi[] = [];
  return {
    ekle(g) {
      /* Aynı metin için aynı görev zaten sıradaysa (çift tıklama) ikincisi eklenmez. */
      if (liste.some((x) => x.gorev === g.gorev && x.secimMetni === g.secimMetni)) return "yinelendi";
      if (liste.length >= enFazla) return "dolu";
      liste = [...liste, g];
      return "eklendi";
    },
    al() {
      const [ilk, ...kalan] = liste;
      liste = kalan;
      return ilk ?? null;
    },
    uzunluk: () => liste.length,
    bosalt() {
      const cikan = liste;
      liste = [];
      return cikan;
    },
  };
}
