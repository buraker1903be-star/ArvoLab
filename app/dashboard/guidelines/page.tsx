import { redirect } from "next/navigation";

/*
  KILAVUZ KATALOĞU KALDIRILDI (26.10.2026, kurum sahibinin kararı:
  "kılavuz kataloğunu kaldıralım, iş başına yükleniyor zaten").

  Kılavuz artık her çalışmaya öğrencinin kendisi tarafından yükleniyor
  ve kuralları ona onaylatılıp uygulanıyor (Yeni çalışma penceresi,
  Kılavuz penceresi; app/actions/calisma-kilavuzu.ts). Katalogu tarayıp
  onaylayan ekip sayfasına gerek kalmadı; gece taraması da
  (/api/cron/guideline-refresh) zamanlamadan çıkarıldı.

  Adres yönlendirme olarak kalıyor: eski "kılavuz onay bekliyor"
  bildirimleri ve yer imleri buraya geliyor; 404 yerine ana sayfa.
  Katalogda daha önce onaylanmış kılavuzlar, onlara bağlı çalışmalarda
  uygulanmaya devam ediyor (lib/guideline-rules.ts).
*/
export default function KilavuzKatalogu() {
  redirect("/dashboard");
}
