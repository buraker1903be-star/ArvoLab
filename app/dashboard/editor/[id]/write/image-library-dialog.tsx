"use client";

import { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";
import Dialog from "@/app/dashboard/_components/dialog";
import { createClient } from "@/lib/supabase/client";

const THUMB_TTL_SECONDS = 30 * 24 * 60 * 60;

interface LibraryImage {
  name: string;
  url: string;
  createdAt: string | null;
}

interface ImageLibraryDialogProps {
  open: boolean;
  projectId: string;
  onClose: () => void;
  onPick: (src: string, name: string) => void;
}

// Bu çalışmaya yüklenmiş resimler. Resimler depoda durduğu için metinden düşmüş bir
// resim buradan tek tıkla yeniden eklenebilir.
//
// İki klasör birden okunur: çalışmanın klasörü (yeni yol, kim yüklerse yüklesin
// çalışmaya bakan herkes görür) ve kullanıcının kendi klasörü (eski yol; oradaki
// resimler yerinde kaldı).
export default function ImageLibraryDialog({ open, projectId, onClose, onPick }: ImageLibraryDialogProps) {
  const [images, setImages] = useState<LibraryImage[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("session");
        const bucket = supabase.storage.from("project-files");
        const klasorler = [`${projectId}/editor-images`, `${user.id}/editor-images`];
        const listeler = await Promise.all(
          klasorler.map(async (folder) => {
            // Bir klasör okunamazsa (ör. hiç kullanılmamış eski yol) diğeri yine gösterilir.
            const { data: files } = await bucket.list(folder, { limit: 200, sortBy: { column: "created_at", order: "desc" } });
            return (files ?? [])
              .filter((file) => file.name && !file.name.startsWith("."))
              .map((file) => ({ path: `${folder}/${file.name}`, name: file.name, createdAt: file.created_at ?? null }));
          })
        );
        const entries = listeler
          .flat()
          .filter((entry, index, hepsi) => hepsi.findIndex((other) => other.path === entry.path) === index)
          .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
        if (entries.length === 0) {
          if (!cancelled) setImages([]);
          return;
        }
        const { data: signed, error: signError } = await bucket.createSignedUrls(
          entries.map((entry) => entry.path),
          THUMB_TTL_SECONDS
        );
        if (signError) throw signError;
        const byPath = new Map((signed ?? []).filter((item) => item.signedUrl).map((item) => [item.path, item.signedUrl]));
        if (!cancelled) {
          setImages(
            entries
              .map((entry) => ({ name: entry.name, url: byPath.get(entry.path) ?? "", createdAt: entry.createdAt }))
              .filter((image) => image.url)
          );
          setError(null);
        }
      } catch (loadError) {
        console.error(loadError);
        if (!cancelled) {
          setImages([]);
          setError("Resimleriniz yüklenemedi. Oturumunuzu ve bağlantınızı kontrol edin.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, projectId]);

  const close = () => {
    setImages(null);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      kicker="Resimler"
      title="Bu çalışmaya yüklenen resimler"
      description="Bu çalışmanın editörüne yüklenmiş resimler burada. Birine tıklayınca imlecin olduğu yere eklenir."
    >
      {error ? <p className="alert" data-tone="danger" role="alert">{error}</p> : null}
      {images === null ? (
        <p className="muted text-sm" aria-busy="true">Resimler yükleniyor…</p>
      ) : images.length === 0 ? (
        <div className="empty-state">
          <ImageOff size={22} aria-hidden="true" />
          <p>Bu çalışmanın editörüne henüz resim yüklenmedi.</p>
        </div>
      ) : (
        <ul className="image-library">
          {images.map((image) => (
            <li key={image.url}>
              <button
                type="button"
                onClick={() => {
                  onPick(image.url, image.name);
                  close();
                }}
                title={image.createdAt ? new Date(image.createdAt).toLocaleString("tr-TR") : image.name}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- imzalı depo bağlantısı, Next görsel iyileştirmesi uygulanamaz */}
                <img src={image.url} alt={image.name} loading="lazy" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}
