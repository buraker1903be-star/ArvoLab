"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { Editor } from "@tiptap/react";
import { olc, olcumAcikMi, olcumKaydet, olcumuAc, olcumuKapat } from "@/lib/editor-olcum";

/*
  Yazarken neyin beklettiğini GÖSTEREN panel (?olcum=1).

  Sentetik belgelerde ölçülen her şey ucuz çıktı (bkz. lib/editor-olcum.ts
  başındaki not); geriye kullanıcının kendi tezi kaldı. Panel iki şeyi
  ayırt etmek için var: tuşun kendi maliyeti mi büyüyor, yoksa araya
  giren bir iş mi (otomatik kayıt, taslak yazımı, yapı denetimi) ana iş
  parçacığını kilitliyor.

  "Tuş → kare" gerçek gecikmedir: tuşa basılmasıyla tarayıcının bir
  sonraki çizim karesine başlaması arasındaki süre. Araya bir iş girerse
  tuşun kendi maliyeti küçük kalır ama bu sayı büyür — şikâyetin ölçüsü
  budur.
*/

const ms = (n: number) => (n >= 100 ? n.toFixed(0) : n.toFixed(1));

/*
  Sorgu dizgisi sunucuda YOK: panel tamamen istemci işi. useSyncExternalStore
  sunucuda ve ilk çizimde aynı cevabı (kapalı) verdiği için hidrasyon
  uyuşmazlığı çıkmaz; effect içinde setState çağırmaya da gerek kalmaz.
*/
const abone = () => () => undefined;
const istemcide = () => olcumAcikMi(window.location.search);
const sunucuda = () => false;

export default function OlcumPaneli({ editor }: { editor: Editor | null }) {
  const acik = useSyncExternalStore(abone, istemcide, sunucuda);
  const [, tazele] = useState(0);

  useEffect(() => {
    if (!acik) return;
    olcumuAc();
    return () => olcumuKapat();
  }, [acik]);

  useEffect(() => {
    if (!acik || !editor) return;
    const el = editor.view.dom;

    /*
      Başlangıç tuşun KENDİSİNDE alınıyor, `input` olayında değil: araya
      giren iş tam da ikisinin arasında çalışıyor olabilir ve o durumda
      `input`'tan ölçmek gecikmeyi görünmez yapardı.
    */
    let basla = 0;
    const onKey = () => {
      if (basla === 0) basla = performance.now();
    };
    const onInput = () => {
      const t0 = basla;
      basla = 0;
      if (t0 === 0) return;
      olcumKaydet("tuş → işlem", performance.now() - t0);
      requestAnimationFrame(() => olcumKaydet("tuş → kare", performance.now() - t0));
    };
    el.addEventListener("keydown", onKey);
    el.addEventListener("input", onInput);

    // 50 ms'den uzun her ana iş parçacığı bloğu: gecikmenin kaynağı buradaysa görünür.
    let gozlemci: PerformanceObserver | null = null;
    try {
      gozlemci = new PerformanceObserver((liste) => {
        for (const kayit of liste.getEntries()) olcumKaydet("ana iş parçacığı engeli", kayit.duration);
      });
      gozlemci.observe({ entryTypes: ["longtask"] });
    } catch {
      // Tarayıcı desteklemiyorsa panelin geri kalanı yine çalışır.
    }

    const sayac = window.setInterval(() => tazele((n) => n + 1), 1000);
    return () => {
      el.removeEventListener("keydown", onKey);
      el.removeEventListener("input", onInput);
      gozlemci?.disconnect();
      window.clearInterval(sayac);
    };
  }, [acik, editor]);

  if (!acik || !editor) return null;

  const bayt = olc("belge boyutu (JSON)", () => JSON.stringify(editor.getJSON()).length);
  const satirlar = olcumuAc().ozet();

  return (
    <aside className="olcum-paneli" aria-label="Başarım ölçümü">
      <p className="olcum-baslik">
        Ölçüm · {(bayt / 1024).toFixed(0)} KB · {editor.state.doc.childCount} blok
      </p>
      <table className="olcum-tablo">
        <thead>
          <tr>
            <th scope="col">iş</th>
            <th scope="col">n</th>
            <th scope="col">ortanca</th>
            <th scope="col">p95</th>
            <th scope="col">en kötü</th>
          </tr>
        </thead>
        <tbody>
          {satirlar.map((satir) => (
            <tr key={satir.ad}>
              <td>{satir.ad}</td>
              <td>{satir.sayi}</td>
              <td>{ms(satir.ortanca)}</td>
              <td>{ms(satir.p95)}</td>
              <td>{ms(satir.enKotu)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="olcum-not">Süreler milisaniye. Panel yalnızca ?olcum=1 ile açılır.</p>
    </aside>
  );
}
