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

  Koyu tema (Signature OS 4.3, kurum sahibinin kuralı): ARVO beyaz, LAB
  orijinal yeşilinde. 4.3'e kadar koyu temada `filter: brightness(0)
  invert(1)` logonun TAMAMINI beyaza çeviriyordu; LAB'ın yeşili
  kayboluyordu. Resmî koyu varyant yok; public/arvolab-logo-koyu.png
  orijinalden teknik olarak üretildi (scripts/logo-koyu-varyant.py):
  yalnızca lacivert pikseller beyaza kaydı, yeşil pikseller ve saydamlık
  birebir aynı. Yeni bir logo çizilmedi. İki dosya da çizilir, tema
  hangisinin görüneceğini CSS'te seçer (base.css): tema sunucuda
  bilinmediği için JS ile seçmek ilk boyamada yanlış logoyu gösterirdi.
  Gizli olan `display: none` olduğu için ekran okuyucu tek logo okur.

  Logo bir bağlantının içindeyse adı bağlantı taşır: alt="" verin.

  `zemin="koyu"` (Signature OS 5, Phase 2): logo temadan bağımsız olarak
  koyu bir yüzeyin üstündeyse (kimlik ekranının lacivert marka alanı)
  yalnızca koyu varyant çizilir. Tema seçimi burada yanlış olurdu: açık
  temada lacivert ARVO lacivert zeminde kaybolurdu.
*/
export default function ArvoLabLogosu({
  className,
  alt = "ArvoLab",
  oncelikli = false,
  zemin = "tema",
}: {
  className?: string;
  alt?: string;
  oncelikli?: boolean;
  zemin?: "tema" | "koyu";
}) {
  const sinif = (tema: string) => (className ? `arvolab-logo ${tema} ${className}` : `arvolab-logo ${tema}`);
  if (zemin === "koyu") {
    return <Image className={className ? `arvolab-logo ${className}` : "arvolab-logo"} src="/arvolab-logo-koyu.png" alt={alt} width={1920} height={1080} sizes="200px" priority={oncelikli} />;
  }
  return (
    <>
      <Image className={sinif("arvolab-logo-acik")} src="/arvolab-logo.png" alt={alt} width={1920} height={1080} sizes="(max-width: 760px) 140px, 180px" priority={oncelikli} />
      <Image className={sinif("arvolab-logo-koyu")} src="/arvolab-logo-koyu.png" alt={alt} width={1920} height={1080} sizes="(max-width: 760px) 140px, 180px" priority={oncelikli} />
    </>
  );
}
