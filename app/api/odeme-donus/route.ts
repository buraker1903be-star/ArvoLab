import { NextResponse, type NextRequest } from "next/server";
import { odemeDonusuDurumu } from "@/lib/kart-odeme";

/*
  PAYTR ÖDEME DÖNÜŞÜ (28.10.2026). ArvoOS kartla ödemede PayTR'ye
  merchant_ok_url / merchant_fail_url olarak bu adresi veriyor
  (?sonuc=tamam|hata). PayTR kullanıcıyı buraya GET ya da form POST'u ile
  döndürebiliyor; ikisi de 303 ile abonelik sayfasına GET olarak iner.

  Bu adres ödemenin SONUCUNU belirlemez: onay ArvoOS'a PayTR'nin imzalı
  bildirimiyle (sunucudan sunucuya) gelir, dönem orada uzar. Burada yalnızca
  kullanıcıya "işleniyor" ya da "tamamlanamadı" denir. Bu yüzden oturum
  aranmıyor (proxy /api/ altını zaten taramıyor): PayTR'den dönen istek
  siteler arası bir POST ve SameSite=lax oturum çerezi onunla gelmiyor;
  303'ten sonraki GET'te geliyor ve abonelik sayfası oturumu kendisi
  denetliyor.

  PayTR'nin gönderdiği fail_message adrese TAŞINMAZ: dışarıdan gelen bir
  metni panelde uyarı olarak göstermek, sahte mesaj yazdırmanın yolu olurdu.
*/
function donus(request: NextRequest) {
  const durum = odemeDonusuDurumu(request.nextUrl.searchParams.get("sonuc"));
  return NextResponse.redirect(new URL(`/dashboard/abonelik?kart=${durum}`, request.url), 303);
}

export const GET = donus;
export const POST = donus;
