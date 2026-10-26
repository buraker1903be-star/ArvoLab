/*
  Çalışmayı Word olarak indirir; hata varsa Türkçe mesajı döner.

  Editörün "Word'e aktar" düğmesi ve ana sayfadaki "Danışmanıma gönder"
  kartı aynı yolu kullanıyor: iki kopya ilk düzeltmede ayrışırdı (büyük
  dosyanın imzalı bağlantıyla gelmesi gibi).

  Eskiden <a download> tıklanıyordu: 402 (abonelik), 404 ve 500
  yanıtlarındaki Türkçe açıklama hiçbir yerde görünmüyor, indirme
  sessizce boş kalıyordu. Yanıt okunup hata çağırana dönüyor.

  Tarayıcıda çalışır (document); sunucuda çağrılmaz.
*/
export async function wordDosyasiniIndir(projectId: string): Promise<string | null> {
  const response = await fetch(`/api/manuscripts/${projectId}/export`, { cache: "no-store" });
  if (!response.ok) {
    const govde = (await response.json().catch(() => null)) as { error?: string } | null;
    return govde?.error ?? "Word dosyası oluşturulamadı. Metin çok büyükse resimleri küçültüp tekrar deneyin.";
  }
  /*
    Büyük dosyalar Vercel'in yanıt sınırına takıldığı için depoya yazılıp
    imzalı bağlantıyla dönüyor; küçük dosyalar doğrudan geliyor.
  */
  if (response.headers.get("Content-Type")?.includes("application/json")) {
    const { downloadUrl, fileName } = (await response.json()) as { downloadUrl: string; fileName?: string };
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = fileName ?? "calisma.docx";
    link.click();
    return null;
  }
  const blob = await response.blob();
  const adBasligi = response.headers.get("Content-Disposition") ?? "";
  const eslesme = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(adBasligi);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = eslesme ? decodeURIComponent(eslesme[1]) : "calisma.docx";
  link.click();
  URL.revokeObjectURL(url);
  return null;
}
