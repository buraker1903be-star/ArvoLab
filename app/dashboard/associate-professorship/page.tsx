import { redirect } from "next/navigation";

/*
  DOÇENTLİK MODÜLÜ KALDIRILDI (20.11.2026, kurum sahibinin ürün kararı:
  ArvoLab tek tip, editör odaklı bir akademik araştırma ve yazma ürünü).

  Eskiden burada Doçentlik Puanı vardı: kriterler, faaliyet kayıtları,
  hedefler, ÜAK tablosu okuma ve personelin "Doçentlik dosyası oluştur"
  düğmesi. Adres yönlendirme olarak kalıyor (yer imleri, eski bağlantılar);
  404 yerine Ana Sayfa, kılavuz kataloğunda olduğu gibi
  (app/dashboard/guidelines/page.tsx).

  Veri SİLİNMEDİ: scoring_criteria, academic_score_entries,
  docentlik_hedefleri, docentlik_profili ve uak_tablolari ile depodaki
  <kullanıcı>/docentlik/ ve <kullanıcı>/uak/ dosyaları yerinde. Kullanıcı
  kendi puan kayıtlarını "Verilerimi indir" ile almaya devam ediyor
  (app/api/hesabim/verilerim). Var olan doçentlik dosyaları
  (academic_projects, tür associate-professorship) Çalışmalarım'da açılıyor.
*/
export default function DocentlikKaldirildi() {
  redirect("/dashboard");
}
