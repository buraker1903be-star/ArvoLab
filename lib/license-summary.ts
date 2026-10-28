// Kullanıcıya gösterilecek lisans/abonelik özeti: durumu, geçerlilik tarihi ve
// ödeme gerekip gerekmediği. Saf: tarih ve metin üretiminden ibaret, böylece
// birim testiyle sınanır. Durumların kaynağı ArvoOS'tur (lib/access.ts).

import type { Dil, Metin } from "./dil";
import { tarihBicimleri } from "./tr-time";

export type LicenseTone = "success" | "warning" | "danger" | "info";

/** lib/access.ts'teki AccessState bu yapıyı karşılar */
export interface LicenseSummaryInput {
  kind: "organization" | "individual" | "staff";
  status: string;
  trialEndsAt: string | null;
  periodEnd: string | null;
  organizationName: string | null;
  blocked: boolean;
}

export interface LicenseSummary {
  title: string;
  statusLabel: string;
  tone: LicenseTone;
  /** Geçerlilik tarihi cümlesi; tarih bilinmiyorsa açıklama */
  detail: string;
  /** Ödemenin alınmadığını anlatan ek satır (yoksa boş) */
  paymentNote: string;
  /** Bireysel abonede yenileme/iptal kuralı; kurumda boş */
  yenilemeNotu: string;
  /** Bireysel abone için ödeme düğmesi gösterilsin mi */
  showPayment: boolean;
}

/*
  Metinler KARTTAN SÖZ ETMİYOR. Eskiden "Kartınızı kontrol edip yeniden
  deneyin" yazıyordu; oysa bu üründe saklı kart ve otomatik çekim YOK.
  Dönem, ödeme bağlantısı tamamlandıkça bir ay uzuyor (ArvoOS:
  arvo_activate_subscriber_period). Olmayan bir otomatik ödemeyi ima etmek
  iki yönden yanlış: kullanıcı kartını kontrol etmeye gidiyor ve bir
  yandan da "demek ki kendiliğinden çekilecek" sanıyor.
*/
const STATUS: Record<string, { label: Metin; tone: LicenseTone; note?: Metin }> = {
  active: { label: { tr: "Aktif", en: "Active" }, tone: "success" },
  trialing: { label: { tr: "Deneme süresi", en: "Trial" }, tone: "info" },
  past_due: {
    label: { tr: "Ödeme bekleniyor", en: "Payment pending" },
    tone: "warning",
    note: { tr: "Bu dönemin ödemesi tamamlanmadı.", en: "Payment for this period has not been completed." },
  },
  inactive: {
    label: { tr: "Başlatılmadı", en: "Not started" },
    tone: "warning",
    note: { tr: "Abonelik için henüz ödeme alınmadı.", en: "No payment has been received for the subscription yet." },
  },
  suspended: {
    label: { tr: "Askıya alındı", en: "Suspended" },
    tone: "danger",
    note: { tr: "Ödeme alınmadığı için abonelik askıya alındı.", en: "The subscription was suspended because no payment was received." },
  },
  canceled: {
    label: { tr: "İptal edildi", en: "Canceled" },
    tone: "danger",
    note: { tr: "Abonelik iptal edildi; yeniden başlatabilirsiniz.", en: "The subscription was canceled; you can restart it." },
  },
  unsynced: { label: { tr: "Bilgi bekleniyor", en: "Awaiting details" }, tone: "info", note: { tr: "", en: "" } },
};

// Takvim günü Türkiye saatine göre (lib/due-date.ts ile aynı yöntem): gösterilen
// tarihle "kaç gün kaldı" sayısı aynı günden konuşsun. UTC'ye göre saymak, gece
// yarısına yakın zaman damgalarında ikisini bir gün ayırıyordu.
const TIME_ZONE = "Europe/Istanbul";
const DATE_FORMAT: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric", timeZone: TIME_ZONE };
const DAY_MS = 86_400_000;

/*
  İngilizcede de TÜRKİYE gününe göre yazılır: "kaç gün kaldı" Türkiye
  takviminden sayılıyor (aşağıda), tarih başka dilimde yazılırsa ikisi bir
  gün ayrışabilirdi.
*/
export const formatLicenseDate = (value: string, dil: Dil = "tr") =>
  dil === "en" ? tarihBicimleri("en", TIME_ZONE).uzunTarih(value) : new Date(value).toLocaleDateString("tr-TR", DATE_FORMAT);

/** Türkiye takvimindeki günün UTC karşılığı */
function turkeyDay(value: Date): number | null {
  if (!Number.isFinite(value.getTime())) return null;
  const [year, month, day] = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE })
    .format(value)
    .split("-")
    .map(Number);
  return Date.UTC(year, month - 1, day);
}

/** Gün farkı (bugün 0, yarın 1); geçersiz tarihte null */
function daysUntil(value: string, now: Date): number | null {
  const end = turkeyDay(new Date(value));
  const start = turkeyDay(now);
  if (end === null || start === null) return null;
  return Math.round((end - start) / DAY_MS);
}

function validity(date: string | null, now: Date, ending: string, dil: Dil): string {
  if (!date) return "";
  const days = daysUntil(date, now);
  if (days === null) return "";
  const formatted = formatLicenseDate(date, dil);
  if (dil === "en") {
    if (days < 0) return `${ending === "trial" ? "Expired" : "Ended"} on ${formatted}.`;
    const remaining = days === 0 ? "today is the last day" : days === 1 ? "tomorrow is the last day" : `${days} days left`;
    const head = ending === "trial" ? `Your trial ends on ${formatted}` : `Valid until ${formatted}`;
    return days <= 30 ? `${head} · ${remaining}.` : `${head}.`;
  }
  if (days < 0) return `${formatted} tarihinde ${ending === "trial" ? "doldu" : "sona erdi"}.`;
  // lib/due-date.ts ile aynı dil: bugün / yarın / N gün kaldı
  const remaining = days === 0 ? "bugün son gün" : days === 1 ? "yarın son gün" : `${days} gün kaldı`;
  const head = ending === "trial" ? `Deneme süreniz ${formatted} tarihinde bitiyor` : `${formatted} tarihine kadar geçerli`;
  return days <= 30 ? `${head} · ${remaining}.` : `${head}.`;
}

/** Lisans kartının içeriği; iç ekip ve durumu bilinmeyen hesaplar için null. */
export function licenseSummary(access: LicenseSummaryInput, now: Date = new Date(), dil: Dil = "tr"): LicenseSummary | null {
  const t = (metin: Metin) => metin[dil];
  if (access.kind === "staff") return null;
  // ArvoOS'a ulaşılamadığında ya da oturum okunamadığında durum bilinmiyor:
  // yanlış bilgi vermek yerine kart hiç gösterilmez.
  if (access.status === "unknown" || access.status === "unreachable") return null;

  const known = STATUS[access.status];
  const statusLabel = known ? t(known.label) : access.blocked ? t({ tr: "Geçerli değil", en: "Not valid" }) : t({ tr: "Aktif", en: "Active" });
  const tone: LicenseTone = known?.tone ?? (access.blocked ? "danger" : "success");
  const individual = access.kind === "individual";

  const trial = access.status === "trialing" ? (access.trialEndsAt ?? access.periodEnd) : null;
  const detail =
    access.status === "unsynced"
      ? t({ tr: "Lisans bilgisi henüz ArvoOS'tan gelmedi; erişiminiz açık.", en: "License details have not arrived from ArvoOS yet; your access is open." })
      : trial
        ? validity(trial, now, "trial", dil)
        : validity(access.periodEnd, now, "period", dil) ||
          (access.status === "active"
            ? t({ tr: "Bitiş tarihi belirtilmedi.", en: "No end date specified." })
            : t({ tr: "Geçerlilik tarihi bulunmuyor.", en: "No validity date available." }));

  return {
    title: individual
      ? t({ tr: "ArvoLab aboneliğiniz", en: "Your ArvoLab subscription" })
      : t({
          tr: `${access.organizationName ?? "Kurumunuzun"} ArvoLab lisansı`,
          en: access.organizationName ? `${access.organizationName}'s ArvoLab license` : "Your institution's ArvoLab license",
        }),
    statusLabel,
    tone,
    detail,
    paymentNote: known?.note ? t(known.note) : "",
    /*
      Yenileme kuralı bireysel abonede AÇIKÇA yazılıyor. Kimse "bir şey
      otomatik çekilecek mi, nasıl iptal ederim" sorusuyla baş başa
      kalmasın: çekilecek bir şey yok, iptal için yapılacak bir şey yok.
      Kurum aboneliğinde muhatap kurum olduğu için gösterilmiyor.
    */
    yenilemeNotu: individual
      ? t({
          tr: "Otomatik ödeme yok: kartınız saklanmıyor ve kendiliğinden çekim yapılmıyor. Dönem bittiğinde çalışma ekranları kapanır (Abonelik, Destek ve Ayarlar açık kalır, verilerinizi indirebilirsiniz), çalışmalarınız silinmez. Dönem bitmeden yenilerseniz yeni dönem mevcut dönemin sonuna eklenir, gün kaybetmezsiniz.",
          en: "No automatic payments: your card is not stored and nothing is charged automatically. When the period ends, the work screens close (Subscription, Support and Settings stay open, and you can download your data); your works are not deleted. If you renew before the period ends, the new period is added to the end of the current one, so you lose no days.",
        })
      : "",
    // Kurum aboneliğini kurumu öder; kişisel ödeme yalnızca bireysel kullanıcıda.
    /*
      Etkin abonede de dönemin son ERKEN_YENILEME_GUN gününde. Eskiden etkin
      abonede düğme hiç yoktu: otomatik ödeme olmadığı için öğrencinin tek
      yolu dönemin bitmesini, panelin kapanmasını beklemekti — editör kaydı
      oturumun ortasında reddediliyordu. ArvoOS yeni dönemi
      greatest(now(), mevcut bitiş)'ten başlatıyor (arvo_activate_license_period),
      erken ödeme gün yakmıyor.
    */
    showPayment:
      individual &&
      access.status !== "unsynced" &&
      (access.status !== "active" || erkenYenilemeDonemi(access.periodEnd)),
  };
}

export const ERKEN_YENILEME_GUN = 14;

/** Dönemin bitişine ERKEN_YENILEME_GUN ya da daha az kaldı mı (bitiş bilinmiyorsa hayır). */
export function erkenYenilemeDonemi(periodEnd: string | null | undefined, simdi = Date.now()): boolean {
  if (!periodEnd) return false;
  const bitis = Date.parse(periodEnd);
  return Number.isFinite(bitis) && bitis - simdi <= ERKEN_YENILEME_GUN * 86_400_000;
}
