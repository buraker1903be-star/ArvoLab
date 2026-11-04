import { calismaBaglantilari, calismaIcindeMi, etkinBaglanti, etkinBolum, etkinUygulama, type CalismaBaglami, type OsUygulama } from "./uygulamalar";
import { ceviriciKur, type Cevirici } from "@/lib/dil";

/*
  KONUM YOLU (breadcrumb) — Signature OS, 04.11.2026.

  Üst çubuğun solunda "Çalışmalarım › Türkiye'de Enflasyon… › Yazım".
  Eskiden üst çubukta yalnızca açık uygulamanın adı vardı; bir
  çalışmanın içinde hangi çalışmada ve hangi bölümünde olunduğu yalnızca
  kenar çubuğundan okunuyordu (tablette ve daraltılmış kenar çubuğunda
  hiç okunmuyordu).

  Karar YENİ bir "neredeyim" mantığı kurmuyor: kenar çubuğunun çalışma
  bağlamıyla (calismaIcindeMi, calismaBaglantilari, etkinBaglanti) ve
  uygulama listesiyle (etkinUygulama, etkinBolum) aynı fonksiyonları
  kullanıyor. İki ayrı mantık bir gün birbirinden farklı yer gösterirdi.

  Son öğenin bağlantısı yok (bulunulan sayfa, aria-current="page").
*/
export type KonumOgesi = { label: string; href: string | null };

export function konumYolu(girdi: {
  yol: string;
  sorgu: URLSearchParams;
  uygulamalar: OsUygulama[];
  baglam: CalismaBaglami | null;
  t?: Cevirici;
}): KonumOgesi[] {
  const t = girdi.t ?? ceviriciKur("tr");
  const { yol, sorgu, uygulamalar, baglam } = girdi;
  let ogeler: KonumOgesi[];

  if (baglam && calismaIcindeMi(baglam.id, yol, sorgu)) {
    const baglantilar = calismaBaglantilari(baglam, t);
    const ozet = baglantilar.find((b) => b.key === "merkez");
    const etkin = etkinBaglanti(baglantilar, yol);
    const calismalar = uygulamalar.find((u) => u.key === "tez");
    ogeler = [
      { label: calismalar?.label ?? t({ tr: "Çalışmalarım", en: "My works" }), href: calismalar?.href ?? "/dashboard/editor" },
      { label: baglam.baslik, href: ozet?.href ?? null },
    ];
    // Özet sayfasındayken çalışmanın adı son öğedir; başka bir bölümdeyken bölüm eklenir.
    if (etkin && etkin.key !== "merkez") ogeler.push({ label: etkin.label, href: etkin.href });
  } else {
    const uygulama = etkinUygulama(uygulamalar, yol);
    if (!uygulama) return [{ label: t({ tr: "Çalışma alanı", en: "Workspace" }), href: null }];
    ogeler = [{ label: uygulama.label, href: uygulama.href }];
    const bolum = uygulama.bolumler ? etkinBolum(uygulama.bolumler, yol) : null;
    if (bolum && bolum.href !== uygulama.href) ogeler.push({ label: bolum.label, href: bolum.href });
  }

  return ogeler.map((o, i) => (i === ogeler.length - 1 ? { ...o, href: null } : o));
}
