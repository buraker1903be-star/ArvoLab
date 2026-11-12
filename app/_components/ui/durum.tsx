import type { ReactNode } from "react";
import { AlertCircle, Inbox } from "lucide-react";
import { durumRolu, type DurumTuru } from "@/lib/os5/bilesen";

/*
  DURUM: boş / yükleniyor / hata (Signature OS 5). Boş durum süs göstermez,
  bir SONRAKİ EYLEM gösterir (tasarım anayasası, madde 8): `eylem` verilmezse
  yalnızca başlık ve açıklama çizilir.
*/
export function Durum({ tur, baslik, aciklama, eylem }: { tur: DurumTuru; baslik: string; aciklama?: ReactNode; eylem?: ReactNode }) {
  return (
    <div className="os5-durum" data-tur={tur} {...durumRolu(tur)}>
      <span className="os5-durum-simge" aria-hidden="true">
        {tur === "yukleniyor" ? <span className="os5-dugme-donen" /> : tur === "hata" ? <AlertCircle size={20} /> : <Inbox size={20} />}
      </span>
      <p className="os5-durum-baslik">{baslik}</p>
      {aciklama ? <p className="os5-durum-aciklama">{aciklama}</p> : null}
      {eylem ? <div className="os5-durum-eylem">{eylem}</div> : null}
    </div>
  );
}
