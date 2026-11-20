import { redirect } from "next/navigation";

/*
  Ekip Yönetimi (davet, rol değiştirme, erişim durdurma) 20.11.2026'da
  kaldırıldı: üyelik, davet ve rolün sahibi ArvoOS. Eskiden bu sayfa
  ArvoLab'da ikinci bir yetki kaynağıydı ve ArvoOS'un bilmediği roller
  veriyordu. Yer imindeki eski adres kırık sayfa yerine Ana Sayfa'ya iner.
*/
export default function EskiEkipYonetimi() {
  redirect("/dashboard");
}
