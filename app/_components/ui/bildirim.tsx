import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";

/*
  BİLDİRİM (Signature OS 5, Phase 2): formun üstündeki tek satırlık
  hata / uyarı / başarı kutusu. Durum bileşeninden (durum.tsx) ayrı: Durum
  bir alanın YERİNE çizilir (boş liste, yüklenemedi); Bildirim bir formun
  üstünde, sonucu söyler.

  Rol çağırandan gelir, bileşen tahmin etmez. Giriş ekranında "başka
  cihazdan giriş yapıldı" bir uyarıdır ama kesinti değildir (status);
  "şifre hatalı" kesintidir (alert). Eskiden bu karar her sayfada elle
  yazılıydı (<p className="alert" role=…>); rolü korumak için aynı karar
  burada da çağırana bırakıldı, yalnızca görünüş tek yere toplandı.
*/
export type BildirimTonu = "hata" | "uyari" | "basari";

const SIMGE = { hata: AlertCircle, uyari: Info, basari: CheckCircle2 } as const;

export function Bildirim({ ton, rol, id, children }: { ton: BildirimTonu; rol: "alert" | "status"; id?: string; children: ReactNode }) {
  const Simge = SIMGE[ton];
  return (
    <div className="os5-bildirim" data-ton={ton} role={rol} id={id}>
      <Simge className="os5-bildirim-simge" size={18} aria-hidden="true" />
      <div className="os5-bildirim-metin">{children}</div>
    </div>
  );
}
