"use client";

import { useCallback, useState, type DragEvent } from "react";

/*
  SÜRÜKLE–BIRAK GERÇEKTEN ÇALIŞIYOR (24.11.2026).

  `.dropzone` sınıfı üç yerde kullanılıyordu (kılavuz yükleme, kaynak
  içe aktarma, veri çözümleme) ve üçünde de kesik çerçeve, bulut simgesi
  ve "bırakma alanı" görüntüsü vardı — ama uygulamada TEK BİR onDrop
  işleyicisi yoktu. Dosyayı sürükleyip bırakan kullanıcının dosyası
  tarayıcıda AÇILIYOR, sayfadan çıkıyordu: yüklemek istediği PDF, yerine
  uygulamanın kendisini kapatıyordu. Görüntüsüyle bir şey vaat edip
  yapmamak, yanlış sonuç göstermekle aynı sınıf bir kusur.

  Kanca üç şeyi birden veriyor: bırakma işleyicileri, sürükleme sırasında
  görsel geri bildirim (`data-surukleniyor`) ve biçim/boyut denetimi.
  Denetim BURADA, çünkü bırakılan dosya `accept` özniteliğinden geçmiyor:
  <input accept> yalnızca dosya seçiciyi süzer, sürüklenen dosyayı değil.
*/

export type DosyaBirakmaSecenekleri = {
  /** Kabul edilen uzantılar (".pdf") ve/veya MIME türleri ("application/pdf"). */
  kabul: string[];
  /** En büyük dosya boyutu (bayt); verilmezse boyuta bakılmaz. */
  enCokBayt?: number;
  /** Dosya geçerliyse çağrılır. */
  onDosya: (dosya: File) => void;
  /** Biçim ya da boyut tutmazsa; kullanıcıya gösterilecek metni çağıran yazar. */
  onHata?: (sebep: "bicim" | "boyut") => void;
};

/** Dosya kabul listesine uyuyor mu? Uzantı ve MIME türü birlikte denenir. */
export function dosyaUygun(dosya: File, kabul: string[]): boolean {
  if (!kabul.length) return true;
  const ad = dosya.name.toLocaleLowerCase("en-US");
  const tur = (dosya.type || "").toLocaleLowerCase("en-US");
  return kabul.some((k) => {
    const kural = k.trim().toLocaleLowerCase("en-US");
    if (!kural) return false;
    if (kural.startsWith(".")) return ad.endsWith(kural);
    if (kural.endsWith("/*")) return tur.startsWith(kural.slice(0, -1));
    return tur === kural;
  });
}

export function useDosyaBirakma({ kabul, enCokBayt, onDosya, onHata }: DosyaBirakmaSecenekleri) {
  const [surukleniyor, setSurukleniyor] = useState(false);

  const dene = useCallback(
    (dosya: File | undefined) => {
      if (!dosya) return;
      if (!dosyaUygun(dosya, kabul)) { onHata?.("bicim"); return; }
      if (enCokBayt && dosya.size > enCokBayt) { onHata?.("boyut"); return; }
      onDosya(dosya);
    },
    [kabul, enCokBayt, onDosya, onHata],
  );

  /*
    onDragOver'da preventDefault ŞART: yapılmazsa tarayıcı bırakmayı
    kabul etmez ve dosyayı kendi açar. onDragLeave yalnızca alanın
    DIŞINA çıkınca sıfırlanıyor; içerideki çocuklara girip çıkmak
    çerçeveyi titretiyordu (relatedTarget denetimi).
  */
  const ozellikler = {
    "data-surukleniyor": surukleniyor || undefined,
    onDragOver: (olay: DragEvent<HTMLElement>) => {
      olay.preventDefault();
      if (!surukleniyor) setSurukleniyor(true);
    },
    onDragLeave: (olay: DragEvent<HTMLElement>) => {
      const hedef = olay.relatedTarget as Node | null;
      if (hedef && olay.currentTarget.contains(hedef)) return;
      setSurukleniyor(false);
    },
    onDrop: (olay: DragEvent<HTMLElement>) => {
      olay.preventDefault();
      setSurukleniyor(false);
      dene(olay.dataTransfer?.files?.[0]);
    },
  };

  return { ozellikler, surukleniyor, dene };
}
