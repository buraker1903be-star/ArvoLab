import Link from "next/link";
import { ceviri } from "@/lib/dil-sunucu";
import { calismaBaglantilari, calismaBolumleri, type CalismaBolumu } from "@/lib/os/uygulamalar";
import { CalismaBaglamiYayinla } from "../../_components/calisma-baglami";

/*
  ÇALIŞMANIN SEKMELERİ: Özet · Yazım · Kanıt matrisi · Etik kurul · (makalede) Makale.

  Eskiden merkez, kanıt matrisi ve makale alanı birbirine üst çubuktaki
  düğmelerle ve sayfa içindeki karolarla bağlanıyordu; her sayfada
  başka bir yerde, başka bir adla. ArvoOS'taki bölüm şeridi gibi tek bir
  sıra, her sayfada aynı yerde.

  Uygulama listesinin bölümü değiller (lib/os/uygulamalar.ts): adresler
  çalışmanın kimliğini taşıyor ve "Makale" yalnızca makale türünde
  anlamlı. Türü bilen bu sunucu bileşeni; listeyi çalışma bağlamından
  üreten kural ise calismaBolumleri.
*/
/* Anahtarlar lib'de tanımlı: sekmeler ve kenar çubuğu alt menüsü aynı listeden. */
export type CalismaSekmesi = CalismaBolumu;

export default async function CalismaSekmeleri({
  calisma,
  aktif,
}: {
  calisma: { id: string; project_type: string; title?: string | null };
  aktif: CalismaSekmesi;
}) {
  const t = await ceviri();
  /*
    Ad, sıra ve adres TEK kaynaktan (lib/os/uygulamalar.ts: calismaBolumleri):
    kenar çubuğunun alt menüsü de oradan okuyor. 5.1d-4'e kadar liste burada
    ikinci kez yazılıydı (Özet, Yazım, Kanıt, Etik, makalede Makale); içerik
    aynıydı ama bir bölüm eklenirken iki yer birden değişmeliydi. "Makale
    yalnızca makale türünde" kuralı da artık tek yerde.
  */
  const baglam = { id: calisma.id, baslik: calisma.title ?? "", tur: calisma.project_type };
  const sekmeler = calismaBolumleri(baglam, t);
  /*
    Bu çalışmaya süzülmüş araçlar (Kaynaklar, Analiz, Belge Kontrol).
    17.11.2026'ya kadar kenar çubuğunun çalışma alt menüsünde "Bu
    çalışmada" başlığıyla duruyordu; alt menü kalkınca (editör açılınca
    gezinme değişmesin) sekme sırasının sonuna geldi: aynı yerde, aynı
    çalışma için.
  */
  const araclar = calismaBaglantilari(baglam, t).filter((b) => b.grup === "arac");

  /*
    Sekmeler her ekran boyunda görünür (17.11.2026): çalışmanın bölümleri
    için tek gezinme bu. Eskiden masaüstünde gizlenip kenar çubuğunun alt
    menüsünde gösteriliyordu. Çalışma bağlamı yine yayınlanıyor: Ctrl+K ve
    üst çubuk onu okuyor. "aktif"i sayfa bildirir (sunucu bileşeni adresi
    okumuyor); adresten hesaplananla aynı olduğu testte sabit
    (tests/unit/calisma-sekmeleri.test.ts).
  */
  return (
    <>
    <CalismaBaglamiYayinla id={calisma.id} baslik={calisma.title ?? ""} tur={calisma.project_type} />
    <nav className="calisma-sekmeleri" aria-label={t({ tr: "Çalışma bölümleri", en: "Work sections" })}>
      {sekmeler.map((sekme) => (
        <Link key={sekme.key} href={sekme.href} aria-current={sekme.key === aktif ? "page" : undefined}>
          {sekme.label}
        </Link>
      ))}
      <span className="calisma-sekmeleri-ayrac" aria-hidden="true" />
      {araclar.map((arac) => (
        <Link key={arac.key} href={arac.href} className="calisma-sekmeleri-arac">
          {arac.label}
        </Link>
      ))}
    </nav>
    </>
  );
}
