/*
  SIGNATURE OS 5 — ORTAK BİLEŞENLERİN SAF KARARLARI.

  Bileşenler (app/_components/ui/) React'e bağlı; tests/unit React'e
  dokunamıyor. Sınıf adı, aria bağlantısı ve klavye kararı burada durur ki
  test üretimle AYNI kodu sınasın, kendi kopyasını değil.

  Bütün sınıflar "os5-" önekli: Phase 1'de mevcut ekranların görünümü
  değişmemeli (kurum sahibinin kararı, 12.11.2026). Önekli sınıfı yalnızca
  yeni bileşenler üretir; eski ekranlar kendi sınıflarıyla çizilmeye devam
  eder. Ekranlar Phase 2–5'te tek tek bu bileşenlere geçirilecek.
*/

export type DugmeTuru = "birincil" | "ikincil" | "sessiz" | "tehlike";
export type DugmeBoyutu = "normal" | "sik";

export function dugmeSinifi({
  tur = "birincil",
  boyut = "normal",
  tamGenislik = false,
  ek,
}: {
  tur?: DugmeTuru;
  boyut?: DugmeBoyutu;
  tamGenislik?: boolean;
  ek?: string;
} = {}): string {
  const siniflar = ["os5-dugme", `os5-dugme--${tur}`];
  if (boyut === "sik") siniflar.push("os5-dugme--sik");
  if (tamGenislik) siniflar.push("os5-dugme--tam");
  if (ek) siniflar.push(ek);
  return siniflar.join(" ");
}

/** Alanın açıklama ve hata metinlerinin kimlikleri; ikisi de aynı kökten türer. */
export function alanKimlikleri(kok: string) {
  return { aciklama: `${kok}-aciklama`, hata: `${kok}-hata` };
}

/*
  aria-describedby: önce hata, sonra açıklama. Ekran okuyucu ilk kimliği
  önce okur; alan hatalıyken kullanıcının önce NEYİN yanlış olduğunu duyması
  gerekir. Hiçbiri yoksa öznitelik hiç yazılmaz (boş metin geçersiz bir
  başvurudur).
*/
export function aciklamaBaglantisi(kok: string, { aciklama, hata }: { aciklama?: boolean; hata?: boolean }): string | undefined {
  const k = alanKimlikleri(kok);
  const liste = [hata ? k.hata : null, aciklama ? k.aciklama : null].filter(Boolean);
  return liste.length ? liste.join(" ") : undefined;
}

/*
  Sekme listesinde klavye (WAI-ARIA "tabs" kalıbı): ok tuşları dolaşır ve
  uçlarda sarar, Home/End uçlara gider. Döndürülen değer yeni sekmenin
  sırası; tuş bu listede değilse null (olay tarayıcıya bırakılır).
*/
export function sekmeTusu(tus: string, sira: number, adet: number): number | null {
  if (adet <= 0) return null;
  switch (tus) {
    case "ArrowRight":
    case "ArrowDown":
      return (sira + 1) % adet;
    case "ArrowLeft":
    case "ArrowUp":
      return (sira - 1 + adet) % adet;
    case "Home":
      return 0;
    case "End":
      return adet - 1;
    default:
      return null;
  }
}

/** Karakter sayacı: sınır yoksa gösterilmez; sınıra %90'dan sonra yaklaşıldığı bildirilir. */
export function sayacDurumu(uzunluk: number, sinir?: number): { metin: string; yakin: boolean } | null {
  if (!sinir || sinir <= 0) return null;
  return { metin: `${uzunluk} / ${sinir}`, yakin: uzunluk >= Math.ceil(sinir * 0.9) };
}

export type DurumTuru = "bos" | "yukleniyor" | "hata";

/*
  Durum bileşeninin erişilebilirlik rolü. Yükleniyor kibar bir duyuru
  (status, polite); hata kesinti (alert); boş durum bir duyuru değil,
  sayfanın içeriğidir — rol verilmez, yoksa her çizimde okunur.
*/
export function durumRolu(tur: DurumTuru): { role?: "status" | "alert"; "aria-live"?: "polite" | "assertive" } {
  if (tur === "yukleniyor") return { role: "status", "aria-live": "polite" };
  if (tur === "hata") return { role: "alert", "aria-live": "assertive" };
  return {};
}
