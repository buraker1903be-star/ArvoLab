import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { onizlemeBotuMu } from "@/lib/onizleme-botu";

describe("önizleme botu", () => {
  test("bağlantı önizleyicileri görüntüleme sayılmaz", () => {
    for (const ua of [
      "WhatsApp/2.23.20.0",
      "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
      "facebookexternalhit/1.1",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0 Safari/537.36 Edge/12 SkypeUriPreview",
      "TelegramBot (like TwitterBot)",
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "",
      null,
    ]) {
      assert.equal(onizlemeBotuMu(ua), true, String(ua));
    }
  });

  test("gerçek tarayıcılar sayılır", () => {
    for (const ua of [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
      "Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0",
    ]) {
      assert.equal(onizlemeBotuMu(ua), false, ua);
    }
  });
});
