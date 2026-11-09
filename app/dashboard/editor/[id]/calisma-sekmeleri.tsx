import { CalismaBaglamiYayinla } from "../../_components/calisma-baglami";

/*
  ÇALIŞMANIN BÖLÜMLERİ — yalnızca bağlamı bildirir (V4.3-B2).

  Eskiden bu bileşen Kanıt, Etik ve Makale sayfalarının içine kendi sekme
  şeridini (Özet · Yazım · Kanıt matrisi · Etik kurul · Makale) çiziyordu.
  Kenar çubuğu başka bir küme tutuyordu ve Yazım, Kaynaklar, Analiz
  sayfalarında telefonda hiç bölüm gezinmesi yoktu. Artık bölümler TEK
  yerde: yerleşimdeki çalışma şeridi (_components/calisma-seridi.tsx) ve
  kenar çubuğu, ikisi de lib/os/uygulamalar.ts'teki calismaBaglantilari'ni
  okur. Bu bileşen sayfanın hangi çalışmada olduğunu bildirmeye devam eder;
  `aktif` artık gerekmiyor (etkin bölüm adresten bulunur), çağıranlar
  değişmesin diye tip olarak kaldı.
*/
export type CalismaSekmesi = "merkez" | "yazim" | "kanit" | "etik" | "makale";

export default function CalismaSekmeleri({
  calisma,
}: {
  calisma: { id: string; project_type: string; title?: string | null };
  aktif: CalismaSekmesi;
}) {
  return <CalismaBaglamiYayinla id={calisma.id} baslik={calisma.title ?? ""} tur={calisma.project_type} />;
}
