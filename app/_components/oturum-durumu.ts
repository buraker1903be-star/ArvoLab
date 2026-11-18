"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/*
  SEKME OTURUMUNDA KALAN DURUM (19.11.2026, bağlamlı çalışma alanı).
  Çalışma alanında araçlar arasında gidip gelirken (Makale bul → belge →
  Kaynaklar → geri) ya da başka bir çalışma sayfasına geçip dönerken arama
  sorgusu, süzgeçler, sonuçlar, seçili PDF ve liste konumu kaybolmasın
  (onaylı tasarımın "durum koruma" maddesi). sessionStorage: sekmeye özgü,
  sekme kapanınca silinir; kalıcı bir tercih değil.

  İLK ÇİZİM SUNUCUYLA AYNI. Değer depodan bağlandıktan (mount) sonra okunur;
  ilk çizimde okumak sunucuda çizilen HTML ile tarayıcıdakini ayırırdı.
  Depo kapalıysa (gizli sekme) durum yalnızca bellekte yaşar; akış düşmez.
  Anahtar null ise hiç saklanmaz.
*/
export function useOturumDurumu<T>(anahtar: string | null, varsayilan: T): [T, (deger: T | ((onceki: T) => T)) => void, boolean] {
  const [deger, setDeger] = useState<T>(varsayilan);
  const [yuklendi, setYuklendi] = useState(false);
  const anahtarRef = useRef(anahtar);
  useEffect(() => {
    anahtarRef.current = anahtar;
  });

  useEffect(() => {
    let okunan: { var: true; deger: T } | null = null;
    if (anahtar) {
      try {
        const ham = window.sessionStorage.getItem(anahtar);
        if (ham !== null) okunan = { var: true, deger: JSON.parse(ham) as T };
      } catch {
        /* Bozuk ya da erişilemeyen depo: varsayılanla devam. */
      }
    }
    /* Depo yalnızca bağlandıktan sonra okunabilir: ilk çizim sunucuyla aynı kalmalı. */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (okunan) setDeger(okunan.deger);
    setYuklendi(true);
  }, [anahtar]);

  const yaz = useCallback((yeni: T | ((onceki: T) => T)) => {
    setDeger((onceki) => {
      const sonraki = typeof yeni === "function" ? (yeni as (o: T) => T)(onceki) : yeni;
      const k = anahtarRef.current;
      if (k) {
        try {
          window.sessionStorage.setItem(k, JSON.stringify(sonraki));
        } catch {
          /* Kota ya da gizli sekme: yalnızca bellekte. */
        }
      }
      return sonraki;
    });
  }, []);

  return [deger, yaz, yuklendi];
}
