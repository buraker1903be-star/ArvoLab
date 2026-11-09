"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Ellipsis } from "lucide-react";
import { useCeviri } from "@/app/_components/dil-saglayici";
import { calismaBaglantilari, calismaIcindeMi, calismaSeridi, etkinBaglanti } from "@/lib/os/uygulamalar";
import { useCalismaBaglami } from "./calisma-baglami";
import AracMenusu from "./acilir-menu";

/*
  ÇALIŞMA ŞERİDİ (V4.3-B2). Bir çalışmanın içindeyken, kenar çubuğunun
  çalışma bölümü GÖRÜNMEDİĞİNDE (telefon, tablet, daraltılmış masaüstü)
  sayfanın üstünde: Özet · Yazım · Kaynaklar · Kanıt · Analiz ve "Daha
  fazla" (Etik kurul, makalede Makale, Belge Kontrol).

  ESKİDEN: telefonda/tablette bölümler yalnızca Kanıt, Etik ve Makale
  sayfalarında, sayfa içindeki ayrı bir sekme bileşeniyle (calisma-
  sekmeleri.tsx) ve FARKLI bir kümeyle görünüyordu; Yazım, Kaynaklar ve
  Analiz'de hiç yoktu. Kenar çubuğu başka, sekmeler başka liste
  tutuyordu. Artık iki yer de aynı listeyi okur (lib/os/uygulamalar.ts,
  calismaBaglantilari / calismaSeridi) ve şerit yerleşimde TEK yerde
  çizilir: ikinci bir gezinme sistemi yok.

  Şerit kaymaz: beş bölüm ve simge düğmesi 360 px'te sığar (kabuk-kabul
  denetler); etiket kesilmez. Çalışmalarım'da çizilmez: orası çalışma
  SEÇME ekranı, bölümleri kendi ayrıntısında. Yazım sayfasında da çizilmez
  (aşağıda: yazı alanının önceliği). Masaüstünde geniş kenar
  çubuğu varken CSS gizler (os-shell.css): aynı bağlantılar orada.
*/
export function CalismaSeridi() {
  const t = useCeviri();
  const yol = usePathname();
  const sorgu = useSearchParams();
  const baglam = useCalismaBaglami();
  /*
    Yazım sayfasında çizilmez: orada ekranın üstü yazı alanının
    (Editör Merkezi kabulü: telefonda ilk satır ≤320 px, 1024'te ≤400 px).
    Şerit ilk satırı ~45 px aşağı itiyordu (ölçüldü: 354 / 436 px). Yazımdan
    bölümlere başlıktaki geri düğmesi (Özet), ana gezinme (Kaynaklar, Analiz)
    ve Ctrl+K "Bu çalışmada" ile gidilir; bu, B2'den önceki hâlle aynı.
    Şeridi editör başlığıyla tek satırda birleştirmek C1'in işi.
  */
  if (!baglam || yol === "/dashboard/editor" || yol.endsWith("/write") || !calismaIcindeMi(baglam.id, yol, new URLSearchParams(sorgu.toString()))) return null;

  const hepsi = calismaBaglantilari(baglam, t);
  const { ana, diger } = calismaSeridi(hepsi);
  const etkin = etkinBaglanti(hepsi, yol);
  const digerEtkin = diger.some((b) => b.key === etkin?.key);
  // Şeritte kısa ad; tam ad ekran okuyucuda ("Kanıt" + " matrisi"): görünen metin adın başında kalır (WCAG 2.5.3).
  const kisa = (key: string, label: string) => (key === "kanit" ? t({ tr: "Kanıt", en: "Evidence" }) : label);

  return (
    <nav className="calisma-seridi" aria-label={t({ tr: "Çalışma bölümleri", en: "Work sections" })}>
      <ul className="calisma-seridi-liste">
        {ana.map((b) => {
          const gorunen = kisa(b.key, b.label);
          return (
            <li key={b.key}>
              <Link href={b.href} className="calisma-seridi-oge" aria-current={etkin?.key === b.key ? "page" : undefined}>
                {gorunen}
                {gorunen !== b.label ? <span className="sr-only">{b.label.slice(gorunen.length)}</span> : null}
              </Link>
            </li>
          );
        })}
        <li>
          <AracMenusu
            ikon={<Ellipsis size={20} aria-hidden="true" />}
            etiket={t({ tr: "Daha fazla", en: "More" })}
            aciklama={digerEtkin ? t({ tr: "Daha fazla (bulunduğunuz bölüm burada)", en: "More (current section is here)" }) : undefined}
            etiketiGizle
            dugmeSinifi={digerEtkin ? "calisma-seridi-oge calisma-seridi-daha is-active" : "calisma-seridi-oge calisma-seridi-daha"}
          >
            {diger.map((b) => (
              <Link key={b.key} href={b.href} className="arac-menu-oge" aria-current={etkin?.key === b.key ? "page" : undefined}>
                {b.label}
              </Link>
            ))}
          </AracMenusu>
        </li>
      </ul>
    </nav>
  );
}
