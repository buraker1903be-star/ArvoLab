"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { flushSync } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useCeviri, useDil } from "@/app/_components/dil-saglayici";
import { YEREL } from "@/lib/dil";
import { anahtardanTarih, ayBasi, ayEkle, ayIzgarasi, gunAnahtari, gunEkle, gunFarki, sinirDisi } from "@/lib/takvim-izgara";

/*
  TARİH SEÇİCİ (28.10.2026). Yerel <input type="date"> tarayıcıya göre
  başka görünüyordu: Chrome'da "gg.aa.yyyy" yer tutuculu, kenarı siyah,
  küçük bir kutu; Safari'de düz metin; teslim tarihi kartında panelin geri
  kalanıyla hiç uyuşmuyordu. Burada düğmeye basınca takvim açılıyor: ay
  ay gezilir, bugün halkalı, seçilen gün dolu, sınır dışındaki günler
  (geçmiş, teslimden sonrası) seçilemez.

  Değer "YYYY-AA-GG" olarak GİZLİ ALANLA gidiyor — yerel tarih kutusunun
  gönderdiği biçimin aynısı, sunucu işlemleri değişmedi. `gerekli`
  verilirse görünmez bir metin alanı tarayıcının kendi "bu alanı
  doldurun" uyarısını taşıyor: gizli alan zorunlu olamıyor ve boş tarihle
  gönderilen form sunucuda hata dönerdi.

  Klavye: oklar gün/hafta, PageUp/PageDown ay, Home/End hafta başı/sonu,
  Enter seçer, Esc kapatır ve odağı düğmeye geri verir.
*/

export default function TarihSecici({
  name,
  deger: baslangic = "",
  enAz,
  enCok,
  gerekli = false,
  etiket,
  yerTutucu,
  degisince,
  sinif,
}: {
  name?: string;
  deger?: string | null;
  enAz?: string | null;
  enCok?: string | null;
  gerekli?: boolean;
  /** Ekran okuyucu etiketi. */
  etiket: string;
  yerTutucu?: string;
  degisince?: (deger: string) => void;
  sinif?: string;
}) {
  const t = useCeviri();
  const dil = useDil();
  const yerel = YEREL[dil];
  const kimlik = useId();
  const [deger, setDeger] = useState(baslangic ?? "");
  const [oncekiBaslangic, setOncekiBaslangic] = useState(baslangic);
  if (baslangic !== oncekiBaslangic) {
    setOncekiBaslangic(baslangic);
    setDeger(baslangic ?? "");
  }
  const [acik, setAcik] = useState(false);
  const [odak, setOdak] = useState("");
  const [bugun, setBugun] = useState("");
  const [yon, setYon] = useState({ yukari: false, sag: false });
  const kok = useRef<HTMLDivElement>(null);
  const dugme = useRef<HTMLButtonElement>(null);
  const izgara = useRef<HTMLDivElement>(null);

  /* Türkçede hafta Pazartesi başlar, ABD İngilizcesinde Pazar. */
  const haftaBasi: 0 | 1 = dil === "en" ? 0 : 1;
  const bicim = (anahtar: string, secenek: Intl.DateTimeFormatOptions) => {
    const tarih = anahtardanTarih(anahtar);
    return tarih ? new Intl.DateTimeFormat(yerel, { ...secenek, timeZone: "UTC" }).format(tarih) : "";
  };

  useEffect(() => {
    if (!acik) return;
    const disari = (olay: PointerEvent) => {
      if (!kok.current?.contains(olay.target as Node)) setAcik(false);
    };
    document.addEventListener("pointerdown", disari);
    return () => document.removeEventListener("pointerdown", disari);
  }, [acik]);

  /* Odaktaki gün düğmesine klavye odağını taşı (ay değişince de). */
  useEffect(() => {
    if (acik && odak) izgara.current?.querySelector<HTMLButtonElement>(`[data-gun="${odak}"]`)?.focus();
  }, [acik, odak]);

  const sinirla = (anahtar: string) => (enAz && anahtar < enAz ? enAz : enCok && anahtar > enCok ? enCok : anahtar);

  const ac = () => {
    /* "Bugün" tarayıcının günü: kullanıcı neredeyse orası. Sunucunun
       Türkiye günüyle gece yarısı farkı en fazla bir gün ve sınırlar
       (enAz) zaten sunucudan geliyor. */
    const simdi = new Date();
    const bugunAnahtari = gunAnahtari(new Date(Date.UTC(simdi.getFullYear(), simdi.getMonth(), simdi.getDate())));
    setBugun(bugunAnahtari);
    const kutu = dugme.current?.getBoundingClientRect();
    if (kutu) {
      setYon({
        yukari: window.innerHeight - kutu.bottom < 380 && kutu.top > window.innerHeight - kutu.bottom,
        sag: kutu.left + 300 > window.innerWidth,
      });
    }
    setOdak(sinirla(anahtardanTarih(deger) ? deger : bugunAnahtari));
    setAcik(true);
  };

  const kapat = () => {
    setAcik(false);
    dugme.current?.focus();
  };

  const sec = (anahtar: string) => {
    if (anahtar && sinirDisi(anahtar, enAz, enCok)) return;
    flushSync(() => setDeger(anahtar));
    degisince?.(anahtar);
    kapat();
  };

  const tus = (olay: KeyboardEvent<HTMLDivElement>) => {
    const adim: Record<string, () => string> = {
      ArrowLeft: () => gunEkle(odak, -1),
      ArrowRight: () => gunEkle(odak, 1),
      ArrowUp: () => gunEkle(odak, -7),
      ArrowDown: () => gunEkle(odak, 7),
      PageUp: () => ayEkle(odak, olay.shiftKey ? -12 : -1),
      PageDown: () => ayEkle(odak, olay.shiftKey ? 12 : 1),
      Home: () => gunEkle(odak, -((anahtardanTarih(odak)!.getUTCDay() - haftaBasi + 7) % 7)),
      End: () => gunEkle(odak, 6 - ((anahtardanTarih(odak)!.getUTCDay() - haftaBasi + 7) % 7)),
    };
    if (olay.key === "Escape") {
      olay.preventDefault();
      kapat();
    } else if (adim[olay.key]) {
      olay.preventDefault();
      setOdak(adim[olay.key]());
    }
  };

  const gunler = odak ? ayIzgarasi(odak, haftaBasi) : [];
  const haftaGunleri = gunler.slice(0, 7).map((g) => ({ kisa: bicim(g.anahtar, { weekday: "short" }), uzun: bicim(g.anahtar, { weekday: "long" }) }));
  const oncekiAyKapali = Boolean(odak && enAz && gunEkle(ayBasi(odak), -1) < enAz);
  const sonrakiAyKapali = Boolean(odak && enCok && ayEkle(ayBasi(odak), 1) > enCok);
  const aylar = Array.from({ length: 12 }, (_, i) => {
    const deger2 = String(i + 1).padStart(2, "0");
    return { deger: deger2, ad: bicim(`2026-${deger2}-01`, { month: "long" }) };
  });
  const buYil = Number((bugun || "2026").slice(0, 4));
  const ilkYil = enAz ? Number(enAz.slice(0, 4)) : buYil - 70;
  const sonYil = enCok ? Number(enCok.slice(0, 4)) : buYil + 10;
  const odakYili = Number(odak.slice(0, 4)) || buYil;
  const yillar = Array.from({ length: Math.max(1, Math.max(sonYil, odakYili) - Math.min(ilkYil, odakYili) + 1) }, (_, i) => String(Math.min(ilkYil, odakYili) + i));
  const kalan = deger && bugun ? gunFarki(bugun, deger) : null;

  const goreli = (fark: number) => {
    if (fark === 0) return t({ tr: "bugün", en: "today" });
    const sayi = Math.abs(fark);
    if (fark > 0) return t({ tr: `${sayi} gün sonra`, en: `in ${sayi} day${sayi === 1 ? "" : "s"}` });
    return t({ tr: `${sayi} gün önce`, en: `${sayi} day${sayi === 1 ? "" : "s"} ago` });
  };

  return (
    <div className={`tarih-secici${sinif ? ` ${sinif}` : ""}`} ref={kok} data-acik={acik || undefined}>
      {name ? <input type="hidden" name={name} value={deger} /> : null}
      <button
        ref={dugme}
        type="button"
        className="tarih-secici-dugme"
        aria-haspopup="dialog"
        aria-expanded={acik}
        aria-controls={`${kimlik}-takvim`}
        aria-label={deger ? `${etiket}: ${bicim(deger, { dateStyle: "full" })}` : etiket}
        onClick={() => (acik ? setAcik(false) : ac())}
        onKeyDown={(olay) => {
          if (olay.key === "ArrowDown" && !acik) {
            olay.preventDefault();
            ac();
          }
        }}
      >
        <CalendarDays size={16} className="tarih-secici-simge" aria-hidden="true" />
        {deger ? (
          <span className="tarih-secici-deger">{bicim(deger, { day: "numeric", month: "long", year: "numeric" })}</span>
        ) : (
          <span className="tarih-secici-bos">{yerTutucu ?? t({ tr: "Tarih seçin", en: "Pick a date" })}</span>
        )}
      </button>
      {/* Düğmeden SONRA: bir <label> içinde etiket tıklaması ilk denetime, yani düğmeye gitsin. */}
      {gerekli ? (
        <input className="tarih-secici-zorunlu" tabIndex={-1} aria-hidden="true" required value={deger} onChange={() => undefined} onFocus={() => dugme.current?.focus()} />
      ) : null}

      {acik ? (
        <div
          id={`${kimlik}-takvim`}
          role="dialog"
          aria-label={etiket}
          className="tarih-secici-pencere"
          data-yukari={yon.yukari || undefined}
          data-sag={yon.sag || undefined}
          onKeyDown={tus}
          /* Form alanları <label> içinde: pencerenin boş yerine tıklamak
             etiketi etkinleştirip düğmeye "tıklıyor" ve takvimi kapatıyordu. */
          onClick={(olay) => olay.preventDefault()}
        >
          <div className="tarih-secici-baslik">
            <button type="button" className="tarih-secici-ok" disabled={oncekiAyKapali} aria-label={t({ tr: "Önceki ay", en: "Previous month" })} onClick={() => setOdak(sinirla(ayEkle(odak, -1)))}>
              <ChevronLeft size={16} aria-hidden="true" />
            </button>
            {/* Ay ve yıl doğrudan seçilebilir: doktora tarihi gibi yıllar
                önceki bir gün ok tuşuyla ay ay gidilerek bulunmaz. */}
            <span className="tarih-secici-ay-yil">
              <select
                className="tarih-secici-ay-sec"
                aria-label={t({ tr: "Ay", en: "Month" })}
                value={odak.slice(5, 7)}
                onChange={(olay) => setOdak(sinirla(ayEkle(odak, Number(olay.target.value) - Number(odak.slice(5, 7)))))}
              >
                {aylar.map((ay) => (
                  <option key={ay.deger} value={ay.deger}>
                    {ay.ad}
                  </option>
                ))}
              </select>
              <select
                className="tarih-secici-ay-sec"
                aria-label={t({ tr: "Yıl", en: "Year" })}
                value={odak.slice(0, 4)}
                onChange={(olay) => setOdak(sinirla(ayEkle(odak, (Number(olay.target.value) - Number(odak.slice(0, 4))) * 12)))}
              >
                {yillar.map((yil) => (
                  <option key={yil} value={yil}>
                    {yil}
                  </option>
                ))}
              </select>
            </span>
            <button type="button" className="tarih-secici-ok" disabled={sonrakiAyKapali} aria-label={t({ tr: "Sonraki ay", en: "Next month" })} onClick={() => setOdak(sinirla(ayEkle(odak, 1)))}>
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
          <div className="tarih-secici-izgara" ref={izgara} role="group" aria-label={bicim(odak, { month: "long", year: "numeric" })}>
            {haftaGunleri.map((g) => (
              <abbr key={g.uzun} title={g.uzun} className="tarih-secici-hafta">
                {g.kisa}
              </abbr>
            ))}
            {gunler.map((g) => {
              const kapali = sinirDisi(g.anahtar, enAz, enCok);
              return (
                <button
                  key={g.anahtar}
                  type="button"
                  data-gun={g.anahtar}
                  className="tarih-secici-gun"
                  data-disari={!g.buAy || undefined}
                  aria-pressed={g.anahtar === deger}
                  aria-current={g.anahtar === bugun ? "date" : undefined}
                  aria-label={bicim(g.anahtar, { dateStyle: "full" })}
                  disabled={kapali}
                  tabIndex={g.anahtar === odak ? 0 : -1}
                  onClick={() => sec(g.anahtar)}
                >
                  {g.gun}
                </button>
              );
            })}
          </div>
          <div className="tarih-secici-alt">
            <span className="tarih-secici-not">
              {kalan !== null ? goreli(kalan) : t({ tr: "Bir gün seçin", en: "Select a day" })}
            </span>
            {!sinirDisi(bugun, enAz, enCok) ? (
              <button type="button" className="tarih-secici-metin-dugme" onClick={() => sec(bugun)}>
                {t({ tr: "Bugün", en: "Today" })}
              </button>
            ) : null}
            {!gerekli && deger ? (
              <button type="button" className="tarih-secici-metin-dugme" onClick={() => sec("")}>
                <X size={13} aria-hidden="true" /> {t({ tr: "Temizle", en: "Clear" })}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
