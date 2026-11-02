/*
  ETİK KURUL DURUMU VE TARİH KİLİDİ (02.11.2026). Saf modül; testi
  tests/unit/etik-durum.test.ts. Ekran (etik sekmesi), teslim kontrolü
  (lib/submission-checklist.ts) ve Analiz Merkezi aynı kararı buradan okur.

  En ağır hata veriyi onaydan ÖNCE toplamaktır: geriye dönük onay verilmez
  ve TR Dizin, etik kurul izni gerektiren çalışmalarda bu bilginin makalede
  yer almasını istiyor. Bu yüzden "veri toplama başlangıcı onaydan önce"
  bir uyarı değil, tehlike olarak gösterilir.
*/
import type { Metin } from "@/lib/dil";

export type EtikDurum = "belirsiz" | "gerekmiyor" | "hazirlaniyor" | "basvuruldu" | "duzeltme" | "onaylandi" | "reddedildi";
export const ETIK_DURUMLARI: EtikDurum[] = ["belirsiz", "gerekmiyor", "hazirlaniyor", "basvuruldu", "duzeltme", "onaylandi", "reddedildi"];

export const ETIK_DURUM_ADI: Record<EtikDurum, Metin> = {
  belirsiz: { tr: "Henüz belirlenmedi", en: "Not decided yet" },
  gerekmiyor: { tr: "Etik kurul gerekmiyor", en: "Ethics approval not required" },
  hazirlaniyor: { tr: "Başvuru hazırlanıyor", en: "Preparing the application" },
  basvuruldu: { tr: "Başvuruldu, karar bekleniyor", en: "Submitted, awaiting decision" },
  duzeltme: { tr: "Düzeltme istendi", en: "Revisions requested" },
  onaylandi: { tr: "Onaylandı", en: "Approved" },
  reddedildi: { tr: "Reddedildi", en: "Rejected" },
};

export type EtikKaydi = {
  durum: EtikDurum;
  onay_tarihi: string | null;
  karar_no: string | null;
  veri_toplama_baslangic: string | null;
  gerekmeme_gerekcesi?: string | null;
  belgeler?: { durum: string }[];
};

export type EtikUyari = { ton: "danger" | "warning" | "info"; metin: Metin };

/** Gün anahtarlarını (YYYY-MM-DD) karşılaştırır; biçim dışı değer karşılaştırılmaz. */
const gun = (deger: string | null | undefined) => (deger && /^\d{4}-\d{2}-\d{2}/.test(deger) ? deger.slice(0, 10) : null);

export function veriOnaydanOnce(k: Pick<EtikKaydi, "onay_tarihi" | "veri_toplama_baslangic">): boolean {
  const onay = gun(k.onay_tarihi);
  const veri = gun(k.veri_toplama_baslangic);
  return Boolean(onay && veri && veri < onay);
}

export function etikUyarilari(k: EtikKaydi | null, bugun: string): EtikUyari[] {
  if (!k || k.durum === "belirsiz") {
    return [{ ton: "info", metin: { tr: "Çalışmanızın etik kurul onayı gerektirip gerektirmediğini belirleyin. İnsan katılımcıdan veri toplanıyorsa (anket, görüşme, ölçek, deney) çoğunlukla gerekir.", en: "Decide whether your work needs ethics approval. If you collect data from human participants (survey, interview, scale, experiment), it usually does." } }];
  }
  if (k.durum === "gerekmiyor") {
    return k.gerekmeme_gerekcesi?.trim()
      ? []
      : [{ ton: "warning", metin: { tr: "Etik kurul gerekmediğini neden düşündüğünüzü yazın; danışmanınız ve jüri bunu soracaktır.", en: "Write why you think ethics approval isn't needed; your advisor and committee will ask." } }];
  }
  const uyarilar: EtikUyari[] = [];
  const veri = gun(k.veri_toplama_baslangic);
  if (veriOnaydanOnce(k)) {
    uyarilar.push({ ton: "danger", metin: { tr: "Veri toplama başlangıcı etik kurul onay tarihinden önce. Onaydan önce toplanan veri kullanılamaz ve geriye dönük onay verilmez; danışmanınızla hemen görüşün.", en: "Data collection started before the ethics approval date. Data collected before approval can't be used and retrospective approval isn't granted; talk to your advisor right away." } });
  }
  if (k.durum !== "onaylandi" && veri && veri <= bugun) {
    uyarilar.push({ ton: "danger", metin: { tr: "Veri toplama başladı görünüyor ama etik kurul onayı kayıtlı değil. Onay alınmadan veri toplamayın.", en: "Data collection appears to have started but no ethics approval is recorded. Don't collect data before approval." } });
  }
  if (k.durum === "duzeltme") uyarilar.push({ ton: "warning", metin: { tr: "Kurul düzeltme istedi: istenen değişiklikleri belgelere işleyip yeniden başvurun.", en: "The committee requested revisions: update your documents and resubmit." } });
  if (k.durum === "reddedildi") uyarilar.push({ ton: "danger", metin: { tr: "Başvuru reddedildi: bu hâliyle veri toplanamaz. Danışmanınızla yöntemi gözden geçirin.", en: "The application was rejected: data can't be collected as planned. Review the method with your advisor." } });
  const eksik = (k.belgeler ?? []).filter((b) => b.durum !== "hazir").length;
  if ((k.durum === "hazirlaniyor" || k.durum === "duzeltme") && eksik > 0) {
    uyarilar.push({ ton: "info", metin: { tr: `Hazır olmayan ${eksik} belge var.`, en: `${eksik} document(s) not ready yet.` } });
  }
  return uyarilar;
}

/*
  Teslim kontrolünün etik satırı. Metinde karar bilgisi aranır: tezlerin ve
  makalelerin yöntem bölümü kurul adını, karar tarihini ve sayısını yazar.
  Sayı metinde geçmiyorsa "bakılmalı" — kişi başka biçimde yazmış olabilir,
  "eksik" demek yanlış alarm olurdu.
*/
export type EtikTeslimSatiri = { durum: "ok" | "warning" | "todo"; detay: Metin } | null;

export function etikTeslimSatiri(k: EtikKaydi | null, metin: string): EtikTeslimSatiri {
  if (!k || k.durum === "belirsiz") return null;
  if (k.durum === "gerekmiyor") {
    return k.gerekmeme_gerekcesi?.trim()
      ? { durum: "ok", detay: { tr: "Etik kurul gerekmiyor (gerekçe yazılı).", en: "Ethics approval not required (reason recorded)." } }
      : { durum: "warning", detay: { tr: "Etik kurul gerekmiyor deniyor ama gerekçe yazılmamış.", en: "Marked as not required, but no reason is recorded." } };
  }
  if (veriOnaydanOnce(k)) return { durum: "todo", detay: { tr: "Veri toplama başlangıcı onay tarihinden önce.", en: "Data collection started before the approval date." } };
  if (k.durum !== "onaylandi") return { durum: "todo", detay: { tr: "Etik kurul onayı kayıtlı değil.", en: "No ethics approval recorded." } };
  const no = (k.karar_no ?? "").trim();
  const metindeVar = no.length > 0 && metin.replace(/\s+/g, " ").includes(no);
  return metindeVar
    ? { durum: "ok", detay: { tr: `Onay alındı; karar sayısı (${no}) metinde geçiyor.`, en: `Approved; the decision number (${no}) appears in the text.` } }
    : { durum: "warning", detay: { tr: `Onay alındı ama karar sayısı (${no}) metinde geçmiyor. Yöntem bölümüne kurul adını, karar tarihini ve sayısını yazın.`, en: `Approved, but the decision number (${no}) isn't in the text. Add the committee name, decision date and number to the method section.` } };
}

/*
  Analiz Merkezi'nin etik uyarısı: veri yüklenen yer, tarih kilidinin en çok
  işe yaradığı an. Kayıt yoksa, "gerekmiyor"sa ya da onaylıysa (ve tarih
  sırası doğruysa) uyarı YOK — her analizde uyarı gören kullanıcı onu okumayı
  bırakır.
*/
export function analizEtikUyarisi(k: EtikKaydi | null): EtikUyari | null {
  if (!k) return null;
  if (veriOnaydanOnce(k)) {
    return { ton: "danger", metin: { tr: "Bu çalışmada veri toplama etik kurul onayından önce başlamış görünüyor. Onaydan önce toplanan veri tezde ve makalede kullanılamaz; danışmanınızla görüşün.", en: "Data collection for this work appears to have started before ethics approval. Data collected before approval can't be used in the thesis or article; talk to your advisor." } };
  }
  if (["hazirlaniyor", "basvuruldu", "duzeltme", "reddedildi"].includes(k.durum)) {
    return { ton: "warning", metin: { tr: "Bu çalışmanın etik kurul onayı henüz kayıtlı değil. Onay gerektiren bir veriyle çalışıyorsanız veriyi onaydan önce toplamayın.", en: "No ethics approval is recorded for this work yet. If your data requires approval, don't collect it before approval." } };
  }
  return null;
}

/* Personelin listesi ve ana sayfası için: çalışmada etik kurul TEHLİKESİ var mı (tarih kilidi, ret). */
export const etikTehlikesi = (k: EtikKaydi | null | undefined, bugun: string): boolean =>
  Boolean(k) && etikUyarilari(k ?? null, bugun).some((u) => u.ton === "danger");
