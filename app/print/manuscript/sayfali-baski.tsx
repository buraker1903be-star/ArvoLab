"use client";

import { useEffect, useState } from "react";
import { useCeviri } from "@/app/_components/dil-saglayici";

/*
  SAYFALI BASKI (27.10.2026, kurum sahibinin isteği: "PDF ile Word aynı
  olmalı, A4 kâğıdında Word gibi birebir görünmeli").

  Eskiden baskı görünümü tek uzun bir sayfaydı; sayfalara bölmeyi
  tarayıcının yazdırma penceresi yapıyordu. Sonuç Word'den üç yerde
  ayrılıyordu: içindekilerde sayfa numarası yoktu (tarayıcı bir başlığın
  hangi sayfaya düştüğünü sayfaya söylemiyor), dipnotlar sayfa altında
  değil metnin sonunda toplanıyordu ve ekranda neyin hangi sayfaya
  düştüğü baskı alınmadan görünmüyordu.

  Paged.js metni ekranda A4 sayfalara böler (CSS Paged Media): kenar
  boşlukları, sayfa numarası, bölüm başlarında yeni sayfa, içindekilerde
  gerçek sayfa numaraları (target-counter) ve sayfa altı dipnotlar. Word
  çıktısıyla aynı ölçüler kullanılıyor (tiptap-docx: 6 pt paragraf arası,
  başlıkta 12/6 pt, H1 +2 pt, H2 +1 pt).

  Kütüphane yalnızca bu sayfada, ihtiyaç anında yükleniyor. Yüklenemez ya
  da hata verirse sayfa eski tek parça görünümde kalır ve yazdırma yine
  çalışır — kâğıt çıkarmak, sayfalamadan önemlidir.
*/

/* Paged.js'in CSS ayrıştırıcısı :is() seçicisini bölüyor; burada seçiciler açık yazılır. */
const SAYFALI_CSS = `
.print-cover { break-after: page; }
.print-toc { break-after: page; }
.print-body .print-new-page { break-before: page; }
.print-body h1, .print-body h2, .print-body h3, .print-body h4 { break-after: avoid; }
.print-body img, .print-body table, .print-body .print-caption { break-inside: avoid; }
.print-toc a::after { content: target-counter(attr(href), page); }
.print-dipnot { float: footnote; display: block; }
.print-dipnot::footnote-call { content: counter(footnote); vertical-align: super; font-size: .7em; line-height: 0; }
@page { @footnote { border-top: 0.5pt solid; padding-top: 4pt; margin-top: 8pt; font-size: .85em; } }
`;

/**
 * Başlıklara içindekilerle aynı sırayla kimlik verir: target-counter onları bulsun.
 * Karşılaştırma boşluksuz ve başlığın DÜZ metniyle (numara hariç; data-baslik):
 * bağlantıdaki numara ile metin arasında boşluk düğümü olmadığından
 * "1.Giriş" ile "1. Giriş" eşleşmiyordu.
 */
/*
  Başlıktaki dipnotun gizli metni (satır içi dipnot, .print-dipnot) ve
  numarası textContent'e karışıyordu: "Giriş¹" "giriş11açıklama" okunuyor,
  eşleşme düşüyor, içindekilerde o başlığın sayfa numarası boş kalıyordu.
*/
function gorunenMetin(el: HTMLElement) {
  const kopya = el.cloneNode(true) as HTMLElement;
  kopya.querySelectorAll(".print-dipnot, .print-fn").forEach((d) => d.remove());
  return kopya.textContent;
}

function basliklaraKimlik(kok: ParentNode) {
  const sade = (m: string | null | undefined) => (m ?? "").replace(/\s+/g, "").toLocaleLowerCase("tr-TR");
  const baglantilar = [...kok.querySelectorAll<HTMLAnchorElement>(".print-toc a[data-toc-index]")];
  const basliklar = [...kok.querySelectorAll<HTMLElement>(".print-body h1, .print-body h2, .print-body h3")];
  let b = 0;
  for (const baglanti of baglantilar) {
    const aranan = sade(baglanti.dataset.baslik);
    // Bulunamazsa sıradaki bağlantı aynı yerden aramaya devam eder (başlıklar tüketilmez).
    for (let i = b; i < basliklar.length; i++) {
      if (aranan && sade(gorunenMetin(basliklar[i])).endsWith(aranan)) {
        basliklar[i].id = `bas-${baglanti.dataset.tocIndex}`;
        b = i + 1;
        break;
      }
    }
  }
}

export default function SayfaliBaski({ otomatikYazdir }: { otomatikYazdir: boolean }) {
  const t = useCeviri();
  const [durum, setDurum] = useState<"hazirlaniyor" | "hazir" | "kapali">("hazirlaniyor");
  useEffect(() => {
    let iptal = false;
    const kok = document.documentElement;
    kok.dataset.sayfali = "hazirlaniyor";
    const yazdir = () => {
      if (otomatikYazdir && !iptal) window.setTimeout(() => window.print(), 300);
    };
    (async () => {
      const kaynak = document.querySelector<HTMLElement>(".print-page > .print-sheet");
      const hedef = document.getElementById("sayfali-hedef");
      const kural = document.getElementById("sayfa-kurali");
      if (!kaynak || !hedef || !kural) throw new Error("baskı görünümü bulunamadı");
      basliklaraKimlik(kaynak);
      /*
        Kütüphanenin HAZIR DERLENMİŞ dosyası. Paket adıyla içe aktarınca
        kaynak dosyaları (src/) geliyor ve paketleyici onları bozuyor
        ("contains.call is not a function"); paketin exports haritası alt
        yola izin vermediği için göreli yol.
      */
      const { Previewer } = await import("../../../node_modules/pagedjs/dist/paged.esm.js");
      if (iptal) return;
      const sablon = document.createElement("template");
      sablon.innerHTML = kaynak.outerHTML;
      const sayfaKurali = kural.textContent ?? "";
      // Ham @page kuralı kalırsa yazdırırken Paged.js'in sayfalarına ikinci kez kenar boşluğu eklenir.
      kural.remove();
      await new Previewer().preview(sablon.content, [{ [`${location.origin}/sayfali.css`]: sayfaKurali + SAYFALI_CSS }], hedef);
      if (iptal) return;
      /* Kılavuzun yazı tipi ve boyutu .print-sheet'in değişkenlerinde; dipnot alanı
         ve sayfa numarası sayfanın kenarında, o kutunun DIŞINDA — değişkenler
         sayfaların kabına da veriliyor, yoksa dipnot arayüz yazı tipiyle çıkıyordu. */
      const kap = hedef.querySelector<HTMLElement>(".pagedjs_pages");
      if (kap) kap.setAttribute("style", kaynak.getAttribute("style") ?? "");
      kok.dataset.sayfali = "hazir";
      setDurum("hazir");
      yazdir();
    })().catch((hata) => {
      console.error("[baskı] sayfalama yapılamadı, tek parça görünüm kullanılıyor:", hata);
      kok.dataset.sayfali = "kapali";
      setDurum("kapali");
      yazdir();
    });
    return () => {
      iptal = true;
    };
  }, [otomatikYazdir]);

  return (
    <>
      {/* Uzun tezde sayfalama birkaç saniye sürüyor; donmuş sanılmasın. */}
      {durum === "hazirlaniyor" ? (
        <p className="sayfali-durum no-print" role="status">
          {t({
            tr: "Sayfalar hazırlanıyor… İçindekilerin sayfa numaraları ve dipnotlar yerleştiriliyor.",
            en: "Preparing pages… Placing table of contents page numbers and footnotes.",
          })}
        </p>
      ) : null}
      <div id="sayfali-hedef" />
    </>
  );
}
