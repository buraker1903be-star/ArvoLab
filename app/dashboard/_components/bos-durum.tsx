import Link from "next/link";
import type { LucideIcon } from "lucide-react";

/*
  Panelin tek boş durum kalıbı.

  Eskiden her sayfa kendi çözümünü yazıyordu: kimi `section.empty-state`,
  kimi `p.muted.text-base`, asistan sayfası ise hiç tanımlanmamış bir sınıf
  (`dash-empty`) kullandığı için stilsiz düz metin gösteriyordu. Aynı durum
  sayfadan sayfaya başka göründüğü için panel derlenmemiş duruyordu.

  Daha önemlisi: boş durumların çoğu yalnızca "yok" diyordu. Kullanıcı ne
  yapacağını sayfadan öğrenemiyordu. Bu yüzden `eylem` bilerek öne çıkarıldı
  — boş bir ekran, bir sonraki adımı göstermek için en iyi yerdir.

  Bölüm içi boşluklarda `kompakt` kullanılır: sayfa genelinde kullanılan
  büyük kutu, bir listenin altında orantısız durur.
*/

export default function BosDurum({
  ikon: Ikon,
  baslik,
  aciklama,
  eylem,
  kompakt = false,
}: {
  ikon?: LucideIcon;
  /** Tek cümlelik durum; yoksa yalnızca açıklama çıkar. */
  baslik?: string;
  aciklama: string;
  /** Bir sonraki adım. Boş ekranda kullanıcıyı yalnız bırakmamak için. */
  eylem?: { etiket: string; href: string };
  kompakt?: boolean;
}) {
  return (
    <section className={kompakt ? "empty-state is-kompakt" : "empty-state"}>
      {Ikon ? (
        <span className="empty-state-icon" aria-hidden="true">
          <Ikon size={kompakt ? 20 : 26} strokeWidth={1.6} />
        </span>
      ) : null}
      {baslik ? <strong className="empty-state-baslik">{baslik}</strong> : null}
      <p>{aciklama}</p>
      {eylem ? (
        <Link href={eylem.href} className="projects-primary-button">
          {eylem.etiket}
        </Link>
      ) : null}
    </section>
  );
}
