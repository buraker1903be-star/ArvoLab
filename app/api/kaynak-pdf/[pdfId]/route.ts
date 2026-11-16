import { getAuthContext } from "@/lib/auth-guards";
import { PDF_EN_FAZLA_BAYT, pdfMi } from "@/lib/kaynak-pdf";

/*
  KAYNAK PDF'İNİN BAYTLARI (16.11.2026, Yazım Stüdyosu: editörün yanındaki
  PDF görüntüleyici).

  Neden imzalı bağlantı değil: görüntüleyici PDF'i sayfa açıldığı sürece
  tutuyor; imzalı bağlantıyı istemciye vermek, süresi dolana kadar herkesin
  açabileceği bir adresi tarayıcı geçmişine, ağ günlüğüne ve kopyala-yapıştıra
  bırakmak demekti. Bu uç nokta depo adresini hiç dışarı vermiyor: her istekte
  oturum doğrulanıyor, satır kullanıcının KENDİ istemcisiyle (RLS: çalışmanın
  klasörünü görebilen) okunuyor, dosya da yine onun istemcisiyle (depolama
  politikası) indiriliyor. Başkasının PDF kimliği gönderilirse satır dönmez
  ve 404 yazılır — "var ama yetkin yok" ile "yok" ayırt edilmez.

  Önbellek yok (private, no-store): PDF bir öğrencinin çalışma klasöründe;
  paylaşılan bir önbellekte ya da diskte kalmamalı. /api proxy'nin
  eşleşme listesinde değil; kimlik ve ilk şifre kapısı getAuthContext'te.

  Boyut: kaynak PDF'leri en fazla 20 MB (kovanın sınırı, lib/kaynak-pdf.ts);
  büyüğü hiç gönderilmez. Bayt imzası da denetlenir: klasöre PDF diye konmuş
  başka bir dosya görüntüleyiciye gitmez.
*/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const bulunamadi = () =>
  new Response("Not found", { status: 404, headers: { "Cache-Control": "private, no-store", "Content-Type": "text/plain; charset=utf-8" } });

export async function GET(_istek: Request, { params }: { params: Promise<{ pdfId: string }> }) {
  const { pdfId } = await params;
  if (!UUID.test(pdfId)) return bulunamadi();

  const ctx = await getAuthContext();
  if (!ctx) return new Response("Unauthorized", { status: 401, headers: { "Cache-Control": "private, no-store" } });

  const { data: satir, error } = await ctx.supabase.from("kaynak_pdfleri").select("depo_yolu").eq("id", pdfId).maybeSingle();
  if (error) {
    console.error("[kaynak-pdf-akis] satır okunamadı:", error.code);
    return new Response("Error", { status: 500, headers: { "Cache-Control": "private, no-store" } });
  }
  if (!satir?.depo_yolu) return bulunamadi();

  const { data: dosya, error: indirmeHatasi } = await ctx.supabase.storage.from("project-files").download(satir.depo_yolu);
  if (indirmeHatasi || !dosya) return bulunamadi();
  if (dosya.size > PDF_EN_FAZLA_BAYT) return new Response("Too large", { status: 413, headers: { "Cache-Control": "private, no-store" } });

  const bayt = new Uint8Array(await dosya.arrayBuffer());
  if (!pdfMi(bayt)) return bulunamadi();

  return new Response(bayt, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(bayt.byteLength),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      // Doğrudan açılırsa indirme olarak (tarayıcı kendi görüntüleyicisinde, betik çalıştırmadan) gelsin.
      "Content-Disposition": 'attachment; filename="kaynak.pdf"',
    },
  });
}
