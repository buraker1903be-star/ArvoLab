import assert from "node:assert/strict";
import test from "node:test";
import { guvenliIndir } from "@/lib/guvenli-indir";

/*
  Kaynak PDF'i indiren süzgeç iç ağa çıkmamalı (SSRF). Adresler OpenAlex
  kayıtlarından geliyor; bir kaydın iç ağı göstermesi ağa hiç çıkmadan
  reddedilmeli. Ağ kullanılmıyor: hepsi ad çözümlemesinden ya da biçim
  denetiminden önce düşüyor.
*/
const KOTU = [
  "http://169.254.169.254/latest/meta-data",
  "http://localhost/",
  "http://metadata.google.internal/",
  "https://127.0.0.1/",
  "http://[::ffff:127.0.0.1]/",
  "https://10.0.0.5/x.pdf",
  "https://user:pw@example.org/x.pdf",
  "https://example.org:8443/x.pdf",
  "file:///etc/passwd",
];

for (const adres of KOTU) {
  test(`iç ağ / geçersiz adres reddedilir: ${adres}`, async () => {
    await assert.rejects(() => guvenliIndir(adres, 1000));
  });
}
