"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { flushSync } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import type { Tone } from "@/lib/status-tone";
import { useAcilirKonum } from "./acilir-konum";

/*
  SÜZGEÇ SEÇİCİSİ (28.10.2026). Liste çubuklarındaki yerel <select>'in yerini
  alır. Yerel açılır liste işletim sisteminin gri menüsüydü: on dört
  seçeneklik durum süzgecinde "Teslimi geçmiş" ile "Yazım aşamasında" aynı
  düz listede, renksiz ve gruplanmamış duruyordu. Burada seçenekler başlıklı
  gruplara ayrılıyor, durum rengi noktayla görünüyor, seçili olan işaretli.

  Erişilebilirlik WAI-ARIA'nın "yalnızca seçim yapılan combobox" kalıbı:
  odak hep düğmede kalır, etkin seçenek aria-activedescendant ile
  bildirilir. Klavye yerel seçiciyle aynı: oklar, Home/End, Enter/Boşluk,
  Esc, harfe basınca o harfle başlayan seçenek.

  Değer GİZLİ ALANLA gönderiliyor: süzgeç formları (next/form) adresi
  form alanlarından kuruyor, sunucu tarafı hiçbir şey fark etmiyor.
  Formlarda (kayıt, ayarlar) yerel <select> kalıyor: orada mobilin yerel
  seçicisi daha iyi, ve onlar components.css'teki ortak görünümü alıyor.
*/

export type SeciciSecenek = { deger: string; etiket: string; ton?: Tone };
export type SeciciGrup = { baslik?: string; secenekler: SeciciSecenek[] };

export default function Secici({
  name,
  deger,
  gruplar,
  etiket,
  onEk,
  otomatikGonder = false,
  degisince,
}: {
  /** Gizli alanın adı; verilmezse alan yazılmaz (yalnızca `degisince`). */
  name?: string;
  deger: string;
  gruplar: SeciciGrup[];
  /** Ekran okuyucu etiketi. */
  etiket: string;
  /** Düğmede değerin önünde soluk yazılan kısa ad ("Durum"). */
  onEk?: string;
  /** Seçim değişince içinde bulunduğu formu gönderir (süzgeç çubukları). */
  otomatikGonder?: boolean;
  degisince?: (deger: string) => void;
}) {
  const kimlik = useId();
  const [secili, setSecili] = useState(deger);
  /* Değer dışarıdan değişirse (geri tuşu, adres değişikliği) onu izle. */
  const [oncekiDeger, setOncekiDeger] = useState(deger);
  if (deger !== oncekiDeger) {
    setOncekiDeger(deger);
    setSecili(deger);
  }
  const [acik, setAcik] = useState(false);
  const [etkin, setEtkin] = useState(-1);
  const kok = useRef<HTMLDivElement>(null);
  const dugme = useRef<HTMLButtonElement>(null);
  const liste = useRef<HTMLUListElement>(null);
  const arama = useRef({ metin: "", zaman: 0 });
  useAcilirKonum(acik, dugme, liste);

  const duz = gruplar.flatMap((g) => g.secenekler);
  /* Her grubun düz listedeki başlangıç sırası (etkin seçenek düz sırayla tutuluyor). */
  const baslangiclar = gruplar.map((_, g) => gruplar.slice(0, g).reduce((n, onceki) => n + onceki.secenekler.length, 0));
  /* Ton noktası yalnızca renkli seçeneği olan listede; sıralama listesinde boş sütun olmasın. */
  const tonlu = duz.some((s) => s.ton);
  const seciliSecenek = duz.find((s) => s.deger === secili) ?? duz[0];
  const secenekKimligi = (i: number) => `${kimlik}-s${i}`;

  /* Dışarı tıklayınca kapan. pointerdown: tıklama bir bağlantıya gidiyorsa
     menü gezinmeden önce kapanmış olsun. */
  useEffect(() => {
    if (!acik) return;
    const disari = (olay: PointerEvent) => {
      if (!kok.current?.contains(olay.target as Node)) setAcik(false);
    };
    document.addEventListener("pointerdown", disari);
    return () => document.removeEventListener("pointerdown", disari);
  }, [acik]);

  /* Etkin seçenek görünür kalsın (uzun listede klavyeyle inerken). */
  useEffect(() => {
    if (!acik || etkin < 0) return;
    document.getElementById(secenekKimligi(etkin))?.scrollIntoView({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acik, etkin]);

  const ac = (baslangic?: number) => {
    setEtkin(baslangic ?? Math.max(0, duz.findIndex((s) => s.deger === secili)));
    setAcik(true);
  };

  const sec = (i: number) => {
    const secenek = duz[i];
    setAcik(false);
    dugme.current?.focus();
    if (!secenek || secenek.deger === secili) return;
    /* Gizli alan formu göndermeden ÖNCE yeni değeri taşımalı. */
    flushSync(() => setSecili(secenek.deger));
    degisince?.(secenek.deger);
    if (otomatikGonder) dugme.current?.form?.requestSubmit();
  };

  const harfleAra = (harf: string) => {
    const simdi = Date.now();
    const a = arama.current;
    a.metin = simdi - a.zaman > 700 ? harf : a.metin + harf;
    a.zaman = simdi;
    const aranan = a.metin.toLocaleLowerCase();
    const bas = acik ? etkin : duz.findIndex((s) => s.deger === secili);
    for (let k = 1; k <= duz.length; k++) {
      /* Tek harfte bir sonrakine geç (aynı harfle başlayanlar arasında dolaşmak için). */
      const i = (bas + (a.metin.length > 1 ? k - 1 : k) + duz.length) % duz.length;
      if (duz[i].etiket.toLocaleLowerCase().startsWith(aranan)) return i;
    }
    return -1;
  };

  const tus = (olay: KeyboardEvent<HTMLButtonElement>) => {
    const { key } = olay;
    if (!acik) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(key)) {
        olay.preventDefault();
        ac();
      } else if (key.length === 1 && /\S/.test(key)) {
        const i = harfleAra(key);
        if (i >= 0) ac(i);
      }
      return;
    }
    if (key === "Escape") {
      olay.preventDefault();
      setAcik(false);
    } else if (key === "Tab") {
      setAcik(false);
    } else if (key === "ArrowDown") {
      olay.preventDefault();
      setEtkin((i) => Math.min(duz.length - 1, i + 1));
    } else if (key === "ArrowUp") {
      olay.preventDefault();
      setEtkin((i) => Math.max(0, i - 1));
    } else if (key === "Home" || key === "PageUp") {
      olay.preventDefault();
      setEtkin(0);
    } else if (key === "End" || key === "PageDown") {
      olay.preventDefault();
      setEtkin(duz.length - 1);
    } else if (key === " " && arama.current.metin && Date.now() - arama.current.zaman <= 700) {
      /* Yazarak aramanın ortasındaki boşluk aramanın parçası ("yazım a…");
         eskiden etkin seçeneği seçip süzgeç formunu gönderiyordu. */
      olay.preventDefault();
      const i = harfleAra(key);
      if (i >= 0) setEtkin(i);
    } else if (key === "Enter" || key === " ") {
      olay.preventDefault();
      sec(etkin);
    } else if (key.length === 1 && /\S/.test(key)) {
      const i = harfleAra(key);
      if (i >= 0) setEtkin(i);
    }
  };

  return (
    <div className="secici" ref={kok} data-acik={acik || undefined}>
      {name ? <input type="hidden" name={name} value={secili} /> : null}
      <button
        ref={dugme}
        type="button"
        className="secici-dugme"
        role="combobox"
        aria-label={etiket}
        aria-haspopup="listbox"
        aria-expanded={acik}
        aria-controls={`${kimlik}-liste`}
        aria-activedescendant={acik && etkin >= 0 ? secenekKimligi(etkin) : undefined}
        onClick={() => (acik ? setAcik(false) : ac())}
        onKeyDown={tus}
      >
        {onEk ? <span className="secici-onek">{onEk}</span> : null}
        {seciliSecenek?.ton ? <span className="secici-nokta" data-tone={seciliSecenek.ton} aria-hidden="true" /> : null}
        <span className="secici-deger">{seciliSecenek?.etiket}</span>
        <ChevronDown size={15} className="secici-ok" aria-hidden="true" />
      </button>
      <ul
        ref={liste}
        id={`${kimlik}-liste`}
        role="listbox"
        aria-label={etiket}
        className="secici-liste"
        popover="manual"
        hidden={!acik}
        tabIndex={-1}
      >
        {gruplar.map((grup, g) => (
          <li key={g} role="presentation" className="secici-grup">
            {grup.baslik ? (
              <span className="secici-grup-baslik" aria-hidden="true">
                {grup.baslik}
              </span>
            ) : null}
            <ul role="group" aria-label={grup.baslik}>
              {grup.secenekler.map((s, j) => {
                const i = baslangiclar[g] + j;
                const seciliMi = s.deger === secili;
                return (
                  <li
                    key={s.deger}
                    id={secenekKimligi(i)}
                    role="option"
                    aria-selected={seciliMi}
                    className="secici-secenek"
                    data-etkin={i === etkin || undefined}
                    onPointerMove={() => setEtkin(i)}
                    /* Fare basışında düğme odağı kaybetmesin; seçim click'te. */
                    onMouseDown={(olay) => olay.preventDefault()}
                    onClick={() => sec(i)}
                  >
                    {tonlu ? <span className="secici-nokta" data-tone={s.ton} aria-hidden="true" /> : null}
                    <span className="secici-secenek-ad">{s.etiket}</span>
                    {seciliMi ? <Check size={15} className="secici-isaret" aria-hidden="true" /> : null}
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
