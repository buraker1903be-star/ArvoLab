"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { CalismaBaglami } from "@/lib/os/uygulamalar";

/*
  ÇALIŞMA BAĞLAMI (Phase 3, 04.11.2026). Gezinme düzende (layout) duruyor
  ve hangi çalışmanın açık olduğunu bilmiyor; çalışmayı okuyan SAYFA
  biliyor. Sayfa <CalismaBaglamiYayinla> ile çalışmayı bildirir,
  gezinme useCalismaBaglami ile okur ve o çalışmanın bölümlerini
  gösterir (lib/os/uygulamalar.ts: calismaBaglantilari).

  Bağlam sayfa kapanınca SİLİNMİYOR: öğrenci çalışmadan o çalışmaya
  süzülmüş Kaynaklar'a (?calisma=<id>) geçtiğinde bölümler yerinde
  kalsın. Görünüp görünmeyeceğine adres karar verir (calismaIcindeMi):
  başka bir çalışmaya ya da genel sayfaya geçince gizlenir.

  Saklanan şey yalnızca kimlik, başlık ve tür — kullanıcının zaten
  görmekte olduğu sayfadan; yeni bir okuma ya da yetki yok.
*/
let mevcut: CalismaBaglami | null = null;
const dinleyiciler = new Set<() => void>();

function abone(dinle: () => void) {
  dinleyiciler.add(dinle);
  return () => dinleyiciler.delete(dinle);
}

export function useCalismaBaglami(): CalismaBaglami | null {
  return useSyncExternalStore(
    abone,
    () => mevcut,
    () => null,
  );
}

export function CalismaBaglamiYayinla({ id, baslik, tur }: CalismaBaglami) {
  useEffect(() => {
    if (mevcut?.id === id && mevcut.baslik === baslik && mevcut.tur === tur) return;
    mevcut = { id, baslik, tur };
    dinleyiciler.forEach((d) => d());
  }, [id, baslik, tur]);
  return null;
}
