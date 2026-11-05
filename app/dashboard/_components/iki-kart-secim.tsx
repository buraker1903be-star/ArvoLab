"use client";

import { useRef, useState, type ReactNode } from "react";
import { useCeviri } from "@/app/_components/dil-saglayici";
import { useEkranSinifi } from "./ekran-sinifi";

/*
  YAN YANA İKİ KART, SOLDA SEÇİM (26.10.2026). Kanıt matrisi penceresinde
  solda iddialar, sağda seçili iddianın zinciri ve işlemleri.

  Satırlar ve ayrıntılar SUNUCUDA çiziliyor (içlerinde sunucu işlemli
  formlar var); bu bileşen yalnızca hangisinin görüneceğini tutuyor.
  Eskiden her iddia listede açılır satırdı: ikinci iddiayı açan öğrenci
  birincinin zincirini aşağı itiyor, uzun listede nerede olduğunu
  kaybediyordu.

  Signature OS 4.1 (05.11.2026): ortak standartta bu, AYRINTI PANELİNİN
  "yanında" biçimi (öteki: sayfa/ayrinti-paneli.tsx). Telefonda iki kart
  üst üste düşüyor ve seçilen kaydın ayrıntısı listenin ALTINDA
  açılıyordu: kullanıcı bir satıra dokunuyor, ekranda hiçbir şey
  değişmiyor, ayrıntının aşağıda açıldığını fark etmiyordu. Ekran
  okuyucu da yalnızca aria-live ile bir şey duyuyordu. Şimdi telefonda
  seçim ayrıntıya kaydırır ve odağı oraya taşır; ayrıntının başında
  listeye dönen bir düğme var. Masaüstünde odak satırda kalır (iki kart
  yan yana, bakış zaten oraya gidiyor).
*/
export type Secenek = { id: string; satir: ReactNode; ayrinti: ReactNode };

export default function IkiKartSecim({
  solBaslik,
  solUst,
  solAlt,
  secenekler,
  bos,
  sayfa = false,
}: {
  solBaslik: string;
  /** Listenin üstünde (ör. "İddia ekle"). */
  solUst?: ReactNode;
  /** Listenin altında (ör. liste boşken ne yapıldığını anlatan kısa liste). */
  solAlt?: ReactNode;
  secenekler: Secenek[];
  /** Hiç seçenek yokken sağ kartta yazan. */
  bos: ReactNode;
  /** Modül sayfasında (Belge Kontrol): kaymayan tek ekranın iki kartı. */
  sayfa?: boolean;
}) {
  const t = useCeviri();
  const ekran = useEkranSinifi();
  const [secili, setSecili] = useState(secenekler[0]?.id ?? null);
  const gosterilen = secenekler.find((s) => s.id === secili) ?? secenekler[0] ?? null;
  const ayrinti = useRef<HTMLElement>(null);
  const liste = useRef<HTMLUListElement>(null);
  const solKart = useRef<HTMLElement>(null);

  /* Kartlar üst üste mi? Kırılım sayfada 900, pencerede 760 piksel;
     sayıyı burada tekrar yazmak yerine yerleşime bakılıyor. */
  const sec = (id: string) => {
    setSecili(id);
    const sol = solKart.current?.getBoundingClientRect();
    const sag = ayrinti.current?.getBoundingClientRect();
    if (!sol || !sag || sag.top < sol.bottom - 1) return;
    requestAnimationFrame(() => {
      ayrinti.current?.focus({ preventScroll: true });
      ayrinti.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  };

  return (
    <div className={sayfa ? "gb-sutunlar kaynaklar-ikili" : "pencere-iki-kart"}>
      <section ref={solKart} className={sayfa ? "gb-kart gb-sutun kayan-kart" : "pencere-kart"}>
        <h3 className="pencere-kart-baslik">{solBaslik}</h3>
        {solUst}
        {secenekler.length ? (
          <ul className="secim-listesi" ref={liste}>
            {secenekler.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className="secim-satir"
                  aria-pressed={s.id === gosterilen?.id}
                  onClick={() => sec(s.id)}
                >
                  {s.satir}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {solAlt}
      </section>
      <section
        ref={ayrinti}
        tabIndex={-1}
        className={sayfa ? "gb-kart gb-sutun kayan-kart secim-ayrinti" : "pencere-kart pencere-sonuc secim-ayrinti"}
        aria-live="polite"
        aria-label={t({ tr: "Seçilen kaydın ayrıntısı", en: "Details of the selected item" })}
      >
        {ekran === "telefon" && gosterilen && secenekler.length > 1 ? (
          <button
            type="button"
            className="link-button secim-listeye-don"
            onClick={() => liste.current?.querySelector<HTMLElement>("[aria-pressed='true']")?.focus()}
          >
            {t({ tr: "↑ Listeye dön", en: "↑ Back to list" })}
          </button>
        ) : null}
        {gosterilen ? gosterilen.ayrinti : <div className="gb-bos">{bos}</div>}
      </section>
    </div>
  );
}
