import { MoreHorizontal } from "lucide-react";
import { ceviri } from "@/lib/dil-sunucu";
import { createClient } from "@/lib/supabase/server";
import { editedAgo } from "@/lib/writing-stats";
import { simdi } from "@/lib/genel-bakis";
import { aktifDil, aktifSaatDilimi } from "@/lib/dil-sunucu";
import TeslimPaketi from "../_components/teslim-paketi";
import DanismanaGonder from "../_components/danismana-gonder";
import DeleteProjectButton from "./delete-project-button";
import PanelDrawer from "../_components/panel-drawer";

/*
  ÖNE ÇIKAN KARTIN "⋯" MENÜSÜ (22.11.2026).

  Sadeleştirmeden önce paylaşım (Danışmanıma gönder) sağ sütunda ayrı bir
  kart, dışa aktarma (Word/PDF/ZIP) ise durum kartının başlığındaydı. Yeni
  düzende kartın yüzünde yalnızca iki eylem var; seyrek kullanılan bu ikisi
  menüye indi. İŞLEV AYNI: aynı bileşenler, aynı sunucu işlemleri, aynı
  yetki kontrolleri.

  Menü `<details>`: açık/kapalı durumu için JavaScript gerekmiyor ve kart
  sunucuda çiziliyor. İçindeki iki bileşen kendi istemci parçalarını
  getiriyor (paylaşım bağlantısı, indirme).

  Son paylaşım bilgisi yalnızca burada okunuyor ve okunamazsa kart "henüz
  gönderilmedi" gibi davranır, sayfa düşmez.
*/
export default async function CalismaKartMenusu({
  projectId,
  baslik,
  kelime,
  silebilir,
}: {
  projectId: string;
  baslik: string;
  kelime: number | null;
  /*
    Silme yetkisi SUNUCUDA hesaplanır (çağıran: calisma-listesi.tsx,
    ana-sayfa-icerik.tsx) ve RLS'in kuralıyla aynıdır: sahibi ya da
    Yönetici/Sistem Yöneticisi/Kurucu. Burada ikinci bir kural
    yazılmıyor; girişin görünmemesi de tek başına koruma değil —
    deleteProject yetkisiz silmede sıfır satır döndürüp hata veriyor.
  */
  silebilir: boolean;
}) {
  const t = await ceviri();
  const dil = await aktifDil();
  const saatDilimi = await aktifSaatDilimi();

  const supabase = await createClient();
  const yanit = await supabase
    .from("manuscript_share_links")
    .select("created_at, last_viewed_at, view_count, expires_at")
    .eq("project_id", projectId)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (yanit.error) console.error("[çalışmalarım] danışman bağlantısı okunamadı:", yanit.error.message);
  const sonBaglanti = yanit.data ?? null;
  const sonGonderim = sonBaglanti
    ? {
        olusturuldu: sonBaglanti.created_at as string,
        sonAcilis: (sonBaglanti.last_viewed_at as string | null) ?? null,
        acilmaSayisi: Number(sonBaglanti.view_count ?? 0),
        bitis: sonBaglanti.expires_at as string,
      }
    : null;
  const once = (damga: string) => editedAgo(damga, simdi(), dil, saatDilimi);
  const sonGonderimMetni = sonGonderim
    ? sonGonderim.acilmaSayisi
      ? t({
          tr: `Danışmanınız ${sonGonderim.acilmaSayisi} kez açtı · son ${once(sonGonderim.sonAcilis ?? sonGonderim.olusturuldu)}`,
          en: `Your advisor opened it ${sonGonderim.acilmaSayisi} time${sonGonderim.acilmaSayisi === 1 ? "" : "s"} · last ${once(sonGonderim.sonAcilis ?? sonGonderim.olusturuldu)}`,
        })
      : t({
          tr: `Bağlantı ${once(sonGonderim.olusturuldu)} gönderildi · henüz açılmadı`,
          en: `Link sent ${once(sonGonderim.olusturuldu)} · not opened yet`,
        })
    : null;

  return (
    <details className="kart-menu calismalarim-menu">
      {/*
        Erişilebilir ad artık "diğer işlemler" (22.11.2026): menüde
        paylaşımın yanında teslim paketi ve ÇALIŞMAYI SİL de var;
        "paylaş ve indir" menünün tamamını anlatmıyordu.
      */}
      <summary aria-label={t({ tr: `${baslik}: diğer işlemler`, en: `${baslik}: more actions` })}>
        <MoreHorizontal size={18} aria-hidden="true" />
      </summary>
      <div className="kart-menu-liste">
        {/*
          Paylaşım kartı olduğu gibi korunuyor; menüye sığmadığı için
          (tam kart) bir panelde açılıyor. Bağlantı oluşturma, kopyalama
          ve Word indirme aynı bileşenin işi.
        */}
        {/*
          Menü girişi ve panel başlığı "Paylaş ve indir" (22.11.2026):
          "Danışmanıma gönder" yalnızca paylaşımı anlatıyordu, oysa aynı
          panelde Word, PDF ve ZIP indirme de var — kullanıcı dosyayı
          nereden indireceğini menüye bakarak bulamıyordu. Panelin İÇİ
          değişmedi: paylaşım bölümü kendi başlığıyla ("Danışmanıma
          gönder") ve altındaki "Dosya olarak: Word · PDF · ZIP" satırıyla
          duruyor. Eskiden aynı cümle hem panelin üstünde hem kartın
          başlığında iki kez yazıyordu.
        */}
        <PanelDrawer
          triggerLabel={t({ tr: "Paylaş ve indir", en: "Share and download" })}
          triggerClassName="calismalarim-menu-oge"
          title={baslik}
          kicker={t({ tr: "Paylaş ve indir", en: "Share and download" })}
          boy="orta"
        >
          <DanismanaGonder projectId={projectId} baslik={baslik} sonGonderim={sonGonderim} sonGonderimMetni={sonGonderimMetni} />
        </PanelDrawer>
        {/* Word + kaynak PDF'leri + rapor; metin yokken indirilecek bir şey de yok. */}
        {kelime ? <TeslimPaketi projectId={projectId} className="calismalarim-menu-oge" /> : null}
        {/*
          ÇALIŞMAYI SİL (22.11.2026). Eskiden yalnızca "Çalışma
          ayrıntıları" panelinin en altındaki ikinci bir "⋯" menüsünün
          içindeydi: üç tıklama derinde, kullanıcı çalışmasını silmek
          için önce ayrıntıları açmak gerektiğini bilmiyordu. Artık
          kartın ana menüsünde, ayırıcıdan sonra ve en altta — geri
          alınamaz olduğu için paylaşma/indirme ile aynı grupta değil.
          Bileşen, onay penceresi ve sunucu eylemi AYNI
          (delete-project-button.tsx); panel kipinde oradan kaldırıldı,
          çalışma özeti sayfasındaki kullanımı olduğu gibi duruyor.
        */}
        {silebilir ? (
          <>
            <hr className="kart-menu-ayirici" />
            <DeleteProjectButton projectId={projectId} projectTitle={baslik} className="button-danger calismalarim-menu-oge" />
          </>
        ) : null}
      </div>
    </details>
  );
}
