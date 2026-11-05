import Image from "next/image";

/*
  ARVOLAB LOGOSU — markanın TEK çizimi (05.11.2026, kurum sahibinin isteği).

  Eskiden uygulamanın sol üstünde logonun yerine kodla çizilmiş bir "A"
  işareti (svg) ve yanında "Arvo<em>Lab</em>" yazısı vardı; giriş
  ekranı ve e-postalar ise gerçek logoyu kullanıyordu. Artık her yerde
  orijinal dosya: public/arvolab-logo.png (1920×1080, saydam zemin).
  Yeniden çizilmez, metinle taklit edilmez.

  Dosyanın yalnızca ortadaki %39'luk yüksekliği logo, üstü ve altı
  saydam boşluk. Küçük alanda olduğu gibi konsa logo üçte birine
  küçülürdü; bu yüzden kutu logonun görünür oranında (4,22 : 1) ve
  object-fit: cover yalnızca saydam boşluğu kırpar — pikseller ve oran
  değişmez (base.css .arvolab-logo).

  Koyu tema: lacivert "ARVO" koyu zeminde okunmuyor. Giriş ekranında
  baştan beri kullanılan tek renk beyaz uygulama (filter) her yerde
  aynı; ikinci bir dosya ya da arka plan kutusu eklenmedi.

  Logo bir bağlantının içindeyse adı bağlantı taşır: alt="" verin.
*/
export default function ArvoLabLogosu({ className, alt = "ArvoLab", oncelikli = false }: { className?: string; alt?: string; oncelikli?: boolean }) {
  return (
    <Image
      className={className ? `arvolab-logo ${className}` : "arvolab-logo"}
      src="/arvolab-logo.png"
      alt={alt}
      width={1920}
      height={1080}
      sizes="(max-width: 760px) 140px, 180px"
      priority={oncelikli}
    />
  );
}
