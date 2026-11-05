import type { ReactNode } from "react";

/*
  DURUM GÖSTERGESİ — StatusIndicator (Signature OS 4.1, 05.11.2026).

  Görünüm `.status-pill`'den (yazı + tonun noktası). Bu bileşen iki şeyi
  sabitliyor:
  1) Durum hiçbir zaman YALNIZCA renkle söylenmez: hapın içinde her zaman
     yazı var (WCAG 1.4.1). Ton yalnızca vurgu.
  2) Bağlamdan kopuk hap ekran okuyucuda anlamsız: tabloda "1" ya da
     "Yok" okunur, neyin bir olduğu söylenmez. `ne` verilirse görünmez
     bir önek eklenir ("Metinde atfı olmayan kaynak: 1").

  Eskiden doksan iki yerde `<span className="status-pill" data-tone=…>`
  elle yazılıyordu; yeni ekranlar bunu kullanır, eskiler dokunuldukça
  geçer.
*/
export type DurumTonu = "success" | "info" | "warning" | "danger" | "neutral";

export default function DurumGostergesi({ ton, ne, children }: { ton: DurumTonu; ne?: string; children: ReactNode }) {
  return (
    <span className="status-pill" data-tone={ton}>
      {ne ? <span className="sr-only">{ne}: </span> : null}
      {children}
    </span>
  );
}
