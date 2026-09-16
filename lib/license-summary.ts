// Kullanıcıya gösterilecek lisans/abonelik özeti: durumu, geçerlilik tarihi ve
// ödeme gerekip gerekmediği. Saf: tarih ve metin üretiminden ibaret, böylece
// birim testiyle sınanır. Durumların kaynağı ArvoOS'tur (lib/access.ts).

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
  /** Bireysel abone için ödeme düğmesi gösterilsin mi */
  showPayment: boolean;
}

const STATUS: Record<string, { label: string; tone: LicenseTone; note?: string }> = {
  active: { label: "Aktif", tone: "success" },
  trialing: { label: "Deneme süresi", tone: "info" },
  past_due: { label: "Ödeme alınamadı", tone: "warning", note: "Son ödeme alınamadı. Kartınızı kontrol edip yeniden deneyin." },
  inactive: { label: "Başlatılmadı", tone: "warning", note: "Abonelik için henüz ödeme alınmadı." },
  suspended: { label: "Askıya alındı", tone: "danger", note: "Ödeme alınamadığı için abonelik askıya alındı." },
  canceled: { label: "İptal edildi", tone: "danger", note: "Abonelik iptal edildi; yeniden başlatabilirsiniz." },
  unsynced: { label: "Bilgi bekleniyor", tone: "info", note: "" },
};

// Takvim günü Türkiye saatine göre (lib/due-date.ts ile aynı yöntem): gösterilen
// tarihle "kaç gün kaldı" sayısı aynı günden konuşsun. UTC'ye göre saymak, gece
// yarısına yakın zaman damgalarında ikisini bir gün ayırıyordu.
const TIME_ZONE = "Europe/Istanbul";
const DATE_FORMAT: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric", timeZone: TIME_ZONE };
const DAY_MS = 86_400_000;

export const formatLicenseDate = (value: string) => new Date(value).toLocaleDateString("tr-TR", DATE_FORMAT);

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

function validity(date: string | null, now: Date, ending: string): string {
  if (!date) return "";
  const days = daysUntil(date, now);
  if (days === null) return "";
  const formatted = formatLicenseDate(date);
  if (days < 0) return `${formatted} tarihinde ${ending === "trial" ? "doldu" : "sona erdi"}.`;
  // lib/due-date.ts ile aynı dil: bugün / yarın / N gün kaldı
  const remaining = days === 0 ? "bugün son gün" : days === 1 ? "yarın son gün" : `${days} gün kaldı`;
  const head = ending === "trial" ? `Deneme süreniz ${formatted} tarihinde bitiyor` : `${formatted} tarihine kadar geçerli`;
  return days <= 30 ? `${head} · ${remaining}.` : `${head}.`;
}

/** Lisans kartının içeriği; iç ekip ve durumu bilinmeyen hesaplar için null. */
export function licenseSummary(access: LicenseSummaryInput, now: Date = new Date()): LicenseSummary | null {
  if (access.kind === "staff") return null;
  // ArvoOS'a ulaşılamadığında ya da oturum okunamadığında durum bilinmiyor:
  // yanlış bilgi vermek yerine kart hiç gösterilmez.
  if (access.status === "unknown" || access.status === "unreachable") return null;

  const known = STATUS[access.status];
  const statusLabel = known?.label ?? (access.blocked ? "Geçerli değil" : "Aktif");
  const tone: LicenseTone = known?.tone ?? (access.blocked ? "danger" : "success");
  const individual = access.kind === "individual";

  const trial = access.status === "trialing" ? (access.trialEndsAt ?? access.periodEnd) : null;
  const detail =
    access.status === "unsynced"
      ? "Lisans bilgisi henüz ArvoOS'tan gelmedi; erişiminiz açık."
      : trial
        ? validity(trial, now, "trial")
        : validity(access.periodEnd, now, "period") ||
          (access.status === "active" ? "Bitiş tarihi belirtilmedi." : "Geçerlilik tarihi bulunmuyor.");

  return {
    title: individual ? "ArvoLab aboneliğiniz" : `${access.organizationName ?? "Kurumunuzun"} ArvoLab lisansı`,
    statusLabel,
    tone,
    detail,
    paymentNote: known?.note ?? "",
    // Kurum aboneliğini kurumu öder; kişisel ödeme yalnızca bireysel kullanıcıda.
    showPayment: individual && access.status !== "active" && access.status !== "unsynced",
  };
}
