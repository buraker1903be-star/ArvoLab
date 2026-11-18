"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Dugme } from "@/app/_components/ui/dugme";

/*
  Kimlik formlarının gönder düğmesi. Gönderim sürerken düğme KİLİTLENİR
  (disabled) ve aria-busy taşır; yazı "…yapılıyor" olur. Eskiden şifremi
  unuttum sayfasının düğmesi bekleme durumunu hiç göstermiyordu: yavaş
  bağlantıda iki kez basan kullanıcı iki sıfırlama isteği gönderip hız
  sınırını (3 / 15 dk) kendi eliyle yakıyordu.

  Form JavaScript yüklenmeden de çalışır: düğme sıradan bir submit'tir,
  useFormStatus yalnızca bekleme görünümünü ekler.
*/
export default function GonderDugmesi({ metin, bekleyen, sonEk }: { metin: string; bekleyen: string; sonEk?: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Dugme type="submit" tamGenislik yukleniyor={pending} disabled={pending}>
      {pending ? bekleyen : metin}
      {pending ? null : sonEk}
    </Dugme>
  );
}
