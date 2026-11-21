"use server";

import { createClient } from "@/lib/supabase/server";
import { aiHataMesaji, sor } from "@/lib/ai/saglayici";
import { aktifDil, ceviri } from "@/lib/dil-sunucu";
import { asistanHakkiAcilisiSn, asistanHakkiVar, asistanKapisi, tamamlamaAraligiUygun } from "@/lib/ai/erisim";
import { asistanKaydet } from "@/lib/ai/kayit";
import { TAMAMLAMA_EN_AZ_ARALIK_SN, saatlikHakaSayilir } from "@/lib/ai/sinirlar";
import { bulguIddiasi, ilkCumle } from "@/lib/ai/yazim-metni";
import { calismaBaglami } from "@/lib/ai/calisma-baglami";
import { ANLAM_SINIFI_ADI, anlamKaybi, korunduIddiasi } from "@/lib/ai/anlam-koruma";
import { belgeDili } from "@/lib/belge-dili";
import { atifCikarmaStili, stilTanimi } from "@/lib/atif/stiller";
import {
  SINIR,
  kutuphaneSatiri,
  yazimCozumle,
  yazimDenetle,
  yazimIstemi,
  type KutuphaneKaydi,
  type SohbetMesaji,
  type YazimGorevi,
} from "@/lib/ai/yazim-asistani";

/*
  YAZIM ASİSTANI EYLEMİ (03.11.2026). Kurallar ve gerekçeleri
  lib/ai/yazim-asistani.ts'te. Burada: kapı (oturum, abonelik, kurulum,
  saatlik hak — lib/ai/erisim.ts), bağlamın SUNUCUDA kurulması (kütüphane
  istemciden gelmez; RLS kendi kayıtlarıyla sınırlar), doğrulama ve kayıt.

  Belgeye hiçbir şey yazmaz: eklemek kullanıcının işi (editördeki panel).
  Yeni içerik ürettiği ve dış maliyet doğurduğu için abonelik kapısından
  geçer (asistanKapisi).
*/

const GOREVLER: YazimGorevi[] = ["serbest", "devam", "paragraf", "akademik", "kisalt", "genislet", "anahat", "tamamla"];
/* Tamamlama kısa bir öneri (iki cümle): uzun cevap hem pahalı hem gecikir. */
const JETON: Partial<Record<YazimGorevi, number>> = { tamamla: 400, anahat: 2_500 };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type YazimIstegi = {
  projectId: string;
  istek: string;
  gorev?: YazimGorevi;
  bolum?: string | null;
  oncesi?: string | null;
  secim?: string | null;
  gecmis?: SohbetMesaji[];
  /** Ana hat görevinde kılavuzun zorunlu bölümleri (editör biliyor). */
  zorunluBolumler?: string[];
};

export type YazimYaniti = {
  hata?: string;
  odemeGerekli?: boolean;
  yanit?: string;
  /** Belgeye eklenebilir metin; boşsa asistan yalnızca cevap verdi */
  metin?: string;
  kayitId?: string | null;
  krediUyarisi?: string;
  /**
   * Sınır yüzünden üretilmediyse NEDEN (20.11.2026): satır içi öneri bunu
   * görünür bir duruma çevirir ("duraklatıldı · 12 dk"), sessizce bozuk
   * görünmez. aralik: en az aralık doldu, kısa süre sonra yeniden denenir;
   * saatlik: kullanıcı başına saatlik hak; kapi: abonelik, kredi ya da kurulum;
   * deneme: deneme hakkı bitti.
   */
  sinir?: { tur: "aralik" | "saatlik" | "kapi" | "deneme"; tekrarSaniye?: number | null };
  /**
   * Kısaltmada kaynakta olup çıktıda olmayan NİTELEMELER
   * (lib/ai/anlam-koruma.ts), kartta uyarı olarak çizilir. Panelin kendi
   * kisaltmaUyarilari'sinden (lib/ai/yazim-metni.ts) ayrıdır ve onu
   * değiştirmez: o, sayı/atıf/olumsuzluk sayımı ve "kısalmadı" ölçer;
   * bu, istatistiksel niteleme, belirsizlik, zaman, örneklem ve sınırlılık
   * gibi anlam taşıyan ifadelerin düşmesini.
   */
  uyarilar?: string[];
};

const temizle = (deger: unknown, n: number) => (typeof deger === "string" ? deger.slice(0, n) : "");

export async function yazimAsistani(girdi: YazimIstegi): Promise<YazimYaniti> {
  const t = await ceviri();
  const dil = await aktifDil();
  if (!UUID.test(String(girdi.projectId ?? ""))) return { hata: t({ tr: "Çalışma bulunamadı.", en: "Work not found." }) };
  const gorev: YazimGorevi = GOREVLER.includes(girdi.gorev as YazimGorevi) ? (girdi.gorev as YazimGorevi) : "serbest";
  const istek = temizle(girdi.istek, SINIR.istek).trim();
  const secim = temizle(girdi.secim, SINIR.secim).trim() || null;
  if (!istek && gorev === "serbest") return { hata: t({ tr: "Ne yazmamı istediğinizi yazın.", en: "Tell me what to write." }) };
  if (!secim && (gorev === "akademik" || gorev === "kisalt" || gorev === "genislet"))
    return { hata: t({ tr: "Önce editörde bir metin seçin.", en: "Select some text in the editor first." }) };

  if (gorev === "tamamla" && !temizle(girdi.oncesi, 50).trim())
    return { hata: t({ tr: "Öneri için imleçten önce metin olmalı.", en: "There must be text before the cursor for a suggestion." }) };

  const kapi = await asistanKapisi(dil);
  if (!kapi.ok) return { hata: kapi.hata, odemeGerekli: kapi.odemeGerekli, sinir: { tur: kapi.odemeGerekli ? "deneme" : "kapi" } };

  /* Tamamlamanın en az aralığı saatlik haktan ÖNCE: frene takılan istek hak tüketmesin. */
  if (gorev === "tamamla" && !(await tamamlamaAraligiUygun(kapi.kullaniciId)))
    return { hata: t({ tr: "Öneriler çok sık istendi; birkaç saniye sonra yeniden denenecek.", en: "Suggestions were requested too often; retrying in a few seconds." }), sinir: { tur: "aralik", tekrarSaniye: TAMAMLAMA_EN_AZ_ARALIK_SN } };

  // RLS: başkasının çalışması okunmaz; bağlam da kayıt da ona iliştirilmez.
  const calisma = await calismaBaglami(girdi.projectId);
  if (!calisma) return { hata: t({ tr: "Çalışma okunamadı; sayfayı yenileyin.", en: "The work could not be read; refresh the page." }) };

  const supabase = await createClient();
  /* Editördeki atıf penceresiyle aynı küme: kullanıcının kendi kaynakları;
     bu çalışmaya bağlı olanlar önce, sonra en yeniler. */
  const { data: kaynaklar, error: kaynakHatasi } = await supabase
    .from("literature_sources")
    .select("title, authors, year, container_title, notes, project_id")
    .eq("owner_id", kapi.kullaniciId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (kaynakHatasi) {
    /* Okunamayan kütüphane "boş kütüphane" sayılmaz: boş sayılsaydı model
       atıfsız yazar, öğrenci kaynaklarının görmezden gelindiğini sanırdı. */
    console.error("[ai-yazim] kütüphane okunamadı:", kaynakHatasi.message);
    return { hata: t({ tr: "Kaynak kütüphaneniz okunamadı; tekrar deneyin.", en: "Your source library could not be read; try again." }) };
  }
  const kutuphane: KutuphaneKaydi[] = [...(kaynaklar ?? [])]
    .sort((a, b) => Number(b.project_id === girdi.projectId) - Number(a.project_id === girdi.projectId))
    .slice(0, SINIR.kutuphane)
    .map((k) => ({
      yazarlar: k.authors ? String(k.authors).slice(0, 300) : null,
      yil: k.year ? String(k.year).slice(0, 10) : null,
      baslik: String(k.title ?? "").slice(0, 300),
      yayin: k.container_title ? String(k.container_title) : null,
      not: k.notes ? String(k.notes) : null,
    }));

  const gecmis: SohbetMesaji[] = (Array.isArray(girdi.gecmis) ? girdi.gecmis : [])
    .filter((m) => m && (m.rol === "kullanici" || m.rol === "asistan") && typeof m.metin === "string")
    .slice(-SINIR.gecmisMesaj)
    .map((m) => ({ rol: m.rol, metin: m.metin.slice(0, SINIR.gecmisKarakter) }));

  const stil = stilTanimi(calisma.atifStili);
  const dili = await belgeDili(supabase, calisma.id, dil);
  const bolum = temizle(girdi.bolum, 200) || null;
  const oncesi = temizle(girdi.oncesi, SINIR.oncesi * 2) || null;
  const { mesajlar, kaynak } = yazimIstemi({
    calisma: calisma.metin,
    belgeDili: dili,
    atifStili: stil.ad,
    bolum,
    oncesi,
    secim,
    kutuphane,
    gecmis: gorev === "tamamla" ? [] : gecmis,
    istek,
    gorev,
    zorunluBolumler: (Array.isArray(girdi.zorunluBolumler) ? girdi.zorunluBolumler : [])
      .filter((b): b is string => typeof b === "string")
      .map((b) => b.slice(0, 120)),
  });

  /*
    Tamamlama saatlik haktan düşmez (lib/ai/sinirlar.ts →
    saatlikHakaSayilir, gerekçe orada). Kapı (abonelik, deneme, kredi)
    ve en az aralık yukarıda her görev için çalıştı; kredi kayıttan düşer.
  */
  if (saatlikHakaSayilir(gorev)) {
    const hakHatasi = await asistanHakkiVar(kapi.kullaniciId, dil);
    if (hakHatasi) return { hata: hakHatasi, sinir: { tur: "saatlik", tekrarSaniye: await asistanHakkiAcilisiSn(kapi.kullaniciId) } };
  }

  const basladi = Date.now();
  const ortak = { kullaniciId: kapi.kullaniciId, calismaId: calisma.id, yetenek: "yazim" as const, baglam: kaynak, basladi };
  try {
    const yanit = await sor(mesajlar, { yetenek: "yazim", jsonBekle: true, sicaklik: 0.4, enFazlaJeton: JETON[gorev] ?? 4_000 });
    const sonuc = yazimCozumle(yanit.metin);
    if (!sonuc) {
      await asistanKaydet({ ...ortak, durum: "rejected", redNedeni: "bos", model: yanit.model, cikti: yanit.metin });
      return { hata: t({ tr: "Asistan bir cevap üretemedi; isteğinizi biraz daha açık yazıp tekrar deneyin.", en: "The assistant couldn't produce an answer; rephrase your request and try again." }) };
    }

    /*
      Doğrulama YALNIZCA eklenebilir metne: "yanit" kullanıcıya açıklamadır,
      ama atıf ve sayı yasağı orada da geçerli olmalı — öğrenci açıklamadaki
      bir kaynağı da kullanabilir. İkisi birlikte denetlenir.
    */
    const baglamMetinleri = [kaynak, istek, secim ?? "", oncesi ?? "", ...gecmis.map((m) => m.metin), ...kutuphane.map((k, i) => kutuphaneSatiri(k, i + 1))];
    const denetim = yazimDenetle(`${sonuc.metin}\n${sonuc.yanit}`, kutuphane, baglamMetinleri, atifCikarmaStili(stil));
    if (!denetim.gecti) {
      await asistanKaydet({ ...ortak, durum: "rejected", redNedeni: denetim.neden, model: yanit.model, cikti: yanit.metin, bulgular: { ayrinti: denetim.ayrinti } });
      const ayrinti = denetim.ayrinti.slice(0, 3).join(", ");
      return {
        hata:
          denetim.neden === "kunye"
            ? t({
                tr: `Asistan kütüphanenizde olmayan bir kaynağa atıf yaptığı için metin gösterilmedi (${ayrinti}). Kaynağı Literatür'e ekleyip tekrar deneyin.`,
                en: `The text wasn't shown because the assistant cited a source that isn't in your library (${ayrinti}). Add the source to Literature and try again.`,
              })
            : t({
                tr: `Asistan bağlamda olmayan bir sayı yazdığı için metin gösterilmedi (${ayrinti}). Gerekli veriyi isteğinize ya da metne ekleyip tekrar deneyin.`,
                en: `The text wasn't shown because the assistant wrote a number that isn't in the context (${ayrinti}). Add the data to your request or text and try again.`,
              }),
      };
    }

    /*
      Satır içi önerinin bulgu denetimi (20.11.2026). Gösterilecek olan
      yalnızca ilk cümle (istemci ilkCumle ile keser), denetlenen de o.
      Red nedeni sütununun izinli değerleri arasında "bulgu" yok; yeni
      değer için migration açmak yerine neden boş, ayrıntı bulgulara
      yazılıyor (kayıt yine "rejected" ve sayılabilir).
    */
    if (gorev === "tamamla") {
      const iddia = bulguIddiasi(ilkCumle(sonuc.metin.replace(/\s+/g, " ").trim()), oncesi ?? "");
      if (iddia) {
        await asistanKaydet({ ...ortak, durum: "rejected", model: yanit.model, cikti: yanit.metin, bulgular: { gorev, neden: "bulgu", ayrinti: [iddia] } });
        return {
          hata: t({
            tr: `Öneri, metinde dayanağı olmayan bir bulgu iddiası taşıdığı için gösterilmedi ("${iddia.slice(0, 60)}").`,
            en: `The suggestion wasn't shown because it claimed a finding with no basis in your text ("${iddia.slice(0, 60)}").`,
          }),
        };
      }
    }

    /*
      ANLAM KORUMA (21.11.2026, gerçek AI kabulü bulgusu). Yalnızca
      kısaltmada: görev "anlamını koruyarak kısalt" diyor ve kabulde model
      "istatistiksel olarak"ı düşürüp açıklamasına "anlam korundu" yazdı.
      Cevap DÜŞÜRÜLMEZ (kısaltma zaten metin atmak demek, her atılan
      sözcük hata değil); kullanıcı neyin düştüğünü görür ve modelin
      yanıltıcı iddiası ekrana çıkmaz. Öteki görevlerde ölçülmez: "devam"
      ya da "paragraf" kaynağı kısaltmıyor, orada aynı denetim yalnızca
      gürültü üretirdi.
    */
    const kayiplar = gorev === "kisalt" && secim ? anlamKaybi(secim, sonuc.metin) : [];
    const uyarilar = kayiplar.map((k) =>
      t({
        tr: `Kaynakta olup kısaltmada düşen: ${t(ANLAM_SINIFI_ADI[k.sinif])} (${k.dusenler.join(", ")}). Metni eklemeden önce kontrol edin.`,
        en: `Dropped from the shortened text: ${t(ANLAM_SINIFI_ADI[k.sinif])} (${k.dusenler.join(", ")}). Check before inserting.`,
      }),
    );
    const gorunenYanit =
      kayiplar.length && korunduIddiasi(sonuc.yanit)
        ? t({
            tr: "Kısaltma güvenli değil: aşağıdaki nitelemeler metinden düştü, bu yüzden anlamın korunduğunu söyleyemem.",
            en: "This shortening isn't safe: the qualifications below were dropped, so I can't say the meaning is preserved.",
          })
        : sonuc.yanit;

    /*
      İstek de bulgulara yazılır (19.11.2026): Kayıtlı sekme cevabın neye
      verildiğini gösterebilsin. Eskiden yalnızca istem metninin (context)
      içindeydi ve oradan güvenle ayıklanamıyordu. Yeni sütun yok; jsonb.
      Anlam kaybı da kayda girer: modelin ham açıklaması ("cikti") ile
      kullanıcının gördüğü açıklama ayrışabiliyor.
    */
    const kayitId = await asistanKaydet({
      ...ortak,
      durum: "completed",
      model: yanit.model,
      cikti: yanit.metin,
      bulgular: { gorev, istek: istek.slice(0, 300), ...(kayiplar.length ? { anlamKaybi: kayiplar } : {}) },
    });
    return { yanit: gorunenYanit, metin: sonuc.metin, kayitId, krediUyarisi: kapi.uyari ?? undefined, uyarilar: uyarilar.length ? uyarilar : undefined };
  } catch (hata) {
    const mesaj = aiHataMesaji(hata, dil) ?? t({ tr: "Asistan yanıt veremedi.", en: "The assistant couldn't respond." });
    console.error("[ai-yazim] başarısız", mesaj);
    await asistanKaydet({ ...ortak, durum: "failed" });
    return { hata: mesaj };
  }
}
