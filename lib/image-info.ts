// Görsel dosyasının türünü ve piksel boyutunu başlık baytlarından okur
// (Word çıktısında doğru tür ve en-boy oranı için). Bağımlılık yok.
export interface ImageInfo {
  type: "png" | "jpg" | "gif";
  width: number;
  height: number;
}

const JPEG_SOF_MARKERS = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

export function readImageInfo(buffer: Buffer): ImageInfo | null {
  // PNG: 89 50 4E 47, IHDR genişlik/yükseklik 16. ve 20. baytta
  if (buffer.length >= 24 && buffer.readUInt32BE(0) === 0x89504e47) {
    return { type: "png", width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }

  // GIF: "GIF", genişlik/yükseklik 6. ve 8. baytta (little-endian)
  if (buffer.length >= 10 && buffer.toString("ascii", 0, 3) === "GIF") {
    return { type: "gif", width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
  }

  // JPEG: FF D8, boyut SOF bölümünde
  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = buffer[offset + 1];
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0xff) {
        offset += marker === 0xff ? 1 : 2;
        continue;
      }
      const length = buffer.readUInt16BE(offset + 2);
      if (JPEG_SOF_MARKERS.has(marker)) {
        return { type: "jpg", height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
      }
      if (length < 2) return null;
      offset += 2 + length;
    }
  }

  return null;
}
