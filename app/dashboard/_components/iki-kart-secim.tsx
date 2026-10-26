"use client";

import { useState, type ReactNode } from "react";

/*
  YAN YANA İKİ KART, SOLDA SEÇİM (26.10.2026). Kanıt matrisi penceresinde
  solda iddialar, sağda seçili iddianın zinciri ve işlemleri.

  Satırlar ve ayrıntılar SUNUCUDA çiziliyor (içlerinde sunucu işlemli
  formlar var); bu bileşen yalnızca hangisinin görüneceğini tutuyor.
  Eskiden her iddia listede açılır satırdı: ikinci iddiayı açan öğrenci
  birincinin zincirini aşağı itiyor, uzun listede nerede olduğunu
  kaybediyordu.
*/
export type Secenek = { id: string; satir: ReactNode; ayrinti: ReactNode };

export default function IkiKartSecim({
  solBaslik,
  solUst,
  secenekler,
  bos,
  sayfa = false,
}: {
  solBaslik: string;
  /** Listenin üstünde (ör. "İddia ekle"). */
  solUst?: ReactNode;
  secenekler: Secenek[];
  /** Hiç seçenek yokken sağ kartta yazan. */
  bos: ReactNode;
  /** Modül sayfasında (Belge Kontrol): kaymayan tek ekranın iki kartı. */
  sayfa?: boolean;
}) {
  const [secili, setSecili] = useState(secenekler[0]?.id ?? null);
  const gosterilen = secenekler.find((s) => s.id === secili) ?? secenekler[0] ?? null;

  return (
    <div className={sayfa ? "gb-sutunlar kaynaklar-ikili" : "pencere-iki-kart"}>
      <section className={sayfa ? "gb-kart gb-sutun kayan-kart" : "pencere-kart"}>
        <h3 className="pencere-kart-baslik">{solBaslik}</h3>
        {solUst}
        {secenekler.length ? (
          <ul className="secim-listesi">
            {secenekler.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className="secim-satir"
                  aria-pressed={s.id === gosterilen?.id}
                  onClick={() => setSecili(s.id)}
                >
                  {s.satir}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
      <section className={sayfa ? "gb-kart gb-sutun kayan-kart" : "pencere-kart pencere-sonuc"} aria-live="polite">
        {gosterilen ? gosterilen.ayrinti : <div className="gb-bos">{bos}</div>}
      </section>
    </div>
  );
}
