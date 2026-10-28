"use client";

import { useCeviri } from "@/app/_components/dil-saglayici";
import type { Metin } from "@/lib/dil";
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
const MESAJLAR: Record<string, Metin> = {
  "odeme-baslatilamadi": {
    tr: "Ödeme sayfası şu an açılamadı. Birazdan tekrar deneyin; sürerse bize yazın.",
    en: "The payment page could not be opened right now. Try again shortly; if it persists, contact us.",
  },
  "kurum-aboneligi": {
    tr: "Aboneliğinizi kurumunuz ödüyor; kişisel ödeme alınmıyor. Kurum yöneticinize iletin.",
    en: "Your institution pays for your subscription; personal payments are not accepted. Contact your institution's administrator.",
  },
  "abonelik-kapali": {
    tr: "Bu işlem için aboneliğinizin açık olması gerekiyor.",
    en: "This action requires an active subscription.",
  },
};

export default function ActionErrorToast() {
  const t = useCeviri();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const kod = params.get("error");

  useEffect(() => {
    if (!kod) return;
    showToast("error", t(MESAJLAR[kod] ?? { tr: "İşlem tamamlanamadı. Tekrar deneyin.", en: "The action could not be completed. Try again." }));
    const kalan = new URLSearchParams(params);
    kalan.delete("error");
    const sorgu = kalan.toString();
    router.replace(sorgu ? `${pathname}?${sorgu}` : pathname, { scroll: false });
  }, [kod, params, pathname, router, t]);

  return null;
}
