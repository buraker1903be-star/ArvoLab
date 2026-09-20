"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { showToast } from "./toast-events";

/*
  Sunucu işlemlerinin yönlendirmeyle bildirdiği hatalar (?error=…). Eskiden bu
  parametreyi hiçbir sayfa okumuyordu: ödeme bağlantısı üretilemediğinde
  "Kartla öde" diyen kullanıcı sessizce aynı ekrana dönüyordu. Metin buradan
  gelir, adresten değil: dışarıdan hazırlanmış bir bağlantı sahte mesaj
  gösteremesin.
*/
const MESAJLAR: Record<string, string> = {
  "odeme-baslatilamadi": "Ödeme sayfası şu an açılamadı. Birazdan tekrar deneyin; sürerse bize yazın.",
  "kurum-aboneligi": "Aboneliğinizi kurumunuz ödüyor; kişisel ödeme alınmıyor. Kurum yöneticinize iletin.",
  "abonelik-kapali": "Bu işlem için aboneliğinizin açık olması gerekiyor.",
};

export default function ActionErrorToast() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const kod = params.get("error");

  useEffect(() => {
    if (!kod) return;
    showToast("error", MESAJLAR[kod] ?? "İşlem tamamlanamadı. Tekrar deneyin.");
    const kalan = new URLSearchParams(params);
    kalan.delete("error");
    const sorgu = kalan.toString();
    router.replace(sorgu ? `${pathname}?${sorgu}` : pathname, { scroll: false });
  }, [kod, params, pathname, router]);

  return null;
}
