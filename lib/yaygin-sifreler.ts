/*
  YAYGIN ŞİFRE LİSTESİ (G1-D D1, 11.11.2026). Saf modül; testi
  tests/unit/kimlik-kurallari.test.ts.

  Neden yerel bir liste: Supabase'in sızdırılmış şifre denetimi (Have I Been
  Pwned) planına ve panel ayarına bağlı, Test projesinde KAPALI. Ürün kararı
  "yaygın şifreler sunucuda reddedilsin" ve bu karar hiçbir ayara bağlı
  olmadan, her ortamda aynı çalışmalı. Bu liste o yüzden İLK katman; Supabase
  denetimi açılırsa (karar 3) ikinci katman olur ve onun cevabı
  sifre-hatasi.ts'teki "pwned" nedeniyle zaten çevriliyor.

  Bilinçli olarak KÜÇÜK: yalnızca en az 8 karakterlik (daha kısası zaten
  uzunluktan düşer) ve gerçek sızıntı listelerinin başında, Türkiye'de de
  sık görülen şifreler. Büyük bir liste tarayıcı paketine de giriyor (form
  aynı kuralı istemcide de gösteriyor); kapsamlı denetim sızıntı servisinin
  işi. Bir şifre buraya eklenince yalnızca YENİ belirlemelerde reddedilir;
  mevcut şifreler etkilenmez.

  Karşılaştırma büyük/küçük harfe duyarsız ve Türkçe büyük İ/I'yı da
  kapsar ("ŞİFRE123" ile "şifre123" aynı sayılır).
*/
const LISTE = [
  "12345678",
  "123456789",
  "1234567890",
  "0123456789",
  "87654321",
  "987654321",
  "11111111",
  "00000000",
  "88888888",
  "12341234",
  "12121212",
  "11223344",
  "123123123",
  "password",
  "password1",
  "password12",
  "password123",
  "passw0rd",
  "p@ssw0rd",
  "qwertyui",
  "qwerty12",
  "qwerty123",
  "qwertyuiop",
  "1q2w3e4r",
  "1q2w3e4r5t",
  "q1w2e3r4",
  "1qaz2wsx",
  "1234qwer",
  "123qweasd",
  "qweasdzxc",
  "asdfghjk",
  "asdfghjkl",
  "zxcvbnm1",
  "abc12345",
  "abcd1234",
  "aa123456",
  "iloveyou",
  "sunshine",
  "princess",
  "football",
  "baseball",
  "superman",
  "trustno1",
  "welcome1",
  "letmein1",
  "admin123",
  "administrator",
  "changeme",
  "asdasd123",
  "sifre123",
  "şifre123",
  "sifre1234",
  "sifresifre",
  "parola123",
  "parola1234",
  "12345678a",
  "a12345678",
  "galatasaray",
  "galatasaray1905",
  "fenerbahce",
  "fenerbahçe",
  "fenerbahce1907",
  "besiktas",
  "beşiktaş",
  "besiktas1903",
  "trabzonspor",
  "turkiye1",
  "türkiye1",
  "istanbul",
  "istanbul34",
  "ankara06",
  "arvolab1",
  "arvolab123",
] as const;

/* Türkçe büyük İ ve I'yı küçültür; ardından genel küçültme. NFC: aynı harfin
   birleşik ve ayrık yazımı aynı sayılsın. */
function normallestir(sifre: string): string {
  return sifre.normalize("NFC").replace(/İ/g, "i").replace(/I/g, "ı").toLowerCase();
}

const KUME: ReadonlySet<string> = new Set(LISTE.map(normallestir));

/** Şifre yaygın listede mi, ya da tek bir karakterin tekrarı mı ("aaaaaaaa"). */
export function yayginSifreMi(sifre: string): boolean {
  if (/^(.)\1+$/u.test(sifre)) return true;
  const n = normallestir(sifre);
  // Türkçe I→ı dönüşümü Latin "password"ü bozmasın diye ikinci bir karşılaştırma: düz küçültme.
  return KUME.has(n) || KUME.has(sifre.normalize("NFC").toLowerCase());
}

/** Testler için: listenin kendisi (her eleman en az 8 karakter olmalı) ve tekil eleman sayısı. */
export const YAYGIN_SIFRE_SAYISI = KUME.size;
export const YAYGIN_SIFRE_LISTESI: readonly string[] = LISTE;
