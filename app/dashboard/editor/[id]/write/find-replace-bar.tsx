"use client";

import { useEffect, useRef, useState } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import { ChevronDown, ChevronUp, Search, X } from "lucide-react";
import { MAX_MATCHES, getSearchState, replaceAll, replaceCurrent, setSearch } from "@/lib/tiptap-search";
import { showToast } from "@/app/dashboard/_components/toast-events";

// Araç çubuğunun altında açılan bul/değiştir satırı (Ctrl/Cmd+F).
// Enter: sonraki, Shift+Enter: önceki, Esc: kapat.
export default function FindReplaceBar({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [replacement, setReplacement] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { count, current } = useEditorState({
    editor,
    selector: ({ editor: instance }) => {
      const state = instance ? getSearchState(instance) : undefined;
      return { count: state?.matches.length ?? 0, current: state?.current ?? 0 };
    },
  }) ?? { count: 0, current: 0 };

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
    return () => {
      // Kapanınca vurgular kalkar
      if (!editor.isDestroyed) setSearch(editor, "");
    };
  }, [editor]);

  const go = (step: number) => {
    if (count === 0) return;
    setSearch(editor, query, (current + step + count) % count);
  };

  const close = () => {
    onClose();
    editor.commands.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else if (event.key === "Enter") {
      event.preventDefault();
      go(event.shiftKey ? -1 : 1);
    }
  };

  return (
    <div className="find-bar" role="search" aria-label="Bul ve değiştir">
      <Search size={15} aria-hidden="true" className="muted" />
      <input
        ref={inputRef}
        className="find-input"
        value={query}
        placeholder="Metinde bul"
        aria-label="Aranacak metin"
        onChange={(event) => {
          setQuery(event.target.value);
          setSearch(editor, event.target.value, 0);
        }}
        onKeyDown={onKeyDown}
      />
      <span className="find-count" aria-live="polite">
        {query ? (count ? `${current + 1}/${count}${count >= MAX_MATCHES ? "+" : ""}` : "Yok") : ""}
      </span>
      <button type="button" className="find-icon-button" onClick={() => go(-1)} disabled={count === 0} aria-label="Önceki eşleşme">
        <ChevronUp size={15} />
      </button>
      <button type="button" className="find-icon-button" onClick={() => go(1)} disabled={count === 0} aria-label="Sonraki eşleşme">
        <ChevronDown size={15} />
      </button>
      <input
        className="find-input"
        value={replacement}
        placeholder="Şununla değiştir"
        aria-label="Yeni metin"
        onChange={(event) => setReplacement(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            close();
          } else if (event.key === "Enter") {
            event.preventDefault();
            replaceCurrent(editor, replacement);
          }
        }}
      />
      <button type="button" className="projects-filter-button button-compact" disabled={count === 0} onClick={() => replaceCurrent(editor, replacement)}>
        Değiştir
      </button>
      <button
        type="button"
        className="projects-filter-button button-compact"
        disabled={count === 0}
        onClick={() => {
          const replaced = replaceAll(editor, replacement);
          if (replaced) showToast("success", `${replaced} yer değiştirildi. Geri almak için Ctrl+Z.`);
        }}
      >
        Tümünü değiştir
      </button>
      <button type="button" className="find-icon-button" onClick={close} aria-label="Bul ve değiştiri kapat">
        <X size={15} />
      </button>
    </div>
  );
}
