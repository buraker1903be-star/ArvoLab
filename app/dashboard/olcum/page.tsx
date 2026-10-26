import { redirect } from "next/navigation";

/*
  ÜRÜN ÖLÇÜMÜ SAYFASI KALDIRILDI (26.10.2026, kurum sahibinin kararı:
  "ürün ölçümü sayfasına gerek yok"). Sayfa deneme → ödeme dönüşümünü
  ve aktivasyonu gösteriyordu; iç ekip bu sayılara burada bakmıyordu.

  Veritabanındaki sayım işlevi (olcum_ozeti, 20260924100030) yerinde
  bırakıldı: yetkisi yalnızca iç ekibe açık ve kaldırmak bir migration
  gerektirirdi, kazancı yok. Adres yer imleri için ana sayfaya yönleniyor.
*/
export default function UrunOlcumu() {
  redirect("/dashboard");
}
