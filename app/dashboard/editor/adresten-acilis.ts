"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/*
  "?yeni=1" İLE AÇILAN PENCERE (Phase 3 stabilizasyonu, 04.11.2026).

  Eskiden pencere adresteki "yeni=1"i yalnızca İLK çizimde okuyordu
  (useState(acikBasla)). Başka sayfadan gelince doğru açılıyordu, ama
  Çalışmalarım'dayken boş durumun "İlk çalışmayı oluştur"u ya da Ctrl+K'nın
  "Yeni çalışma"sı aynı sayfada adresi değiştiriyor, bileşen yeniden
  kurulmuyor ve HİÇBİR ŞEY olmuyordu — sayfa yenilenince açılıyordu.

  Şimdi değer sonradan true olunca da pencere açılır (önceki değerle
  karşılaştırma, çizim sırasında: efekt içinde setState bir tur geç açar).
  Kapanınca "yeni" adresten silinir; silinmezse aynı bağlantıya ikinci
  basış adresi değiştirmez ve yine bir şey olmazdı.
*/
export function useAdrestenAcilis(acikBasla: boolean) {
  const router = useRouter();
  const yol = usePathname();
  const sorgu = useSearchParams();
  const [acik, setAcik] = useState(acikBasla);
  const [onceki, setOnceki] = useState(acikBasla);
  if (acikBasla !== onceki) {
    setOnceki(acikBasla);
    if (acikBasla) setAcik(true);
  }

  const adresiTemizle = () => {
    if (sorgu.get("yeni") !== "1") return;
    const kalan = new URLSearchParams(sorgu.toString());
    kalan.delete("yeni");
    const metin = kalan.toString();
    router.replace(metin ? `${yol}?${metin}` : yol, { scroll: false });
  };

  return { acik, setAcik, adresiTemizle };
}
