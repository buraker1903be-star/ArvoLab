"use client";

import { useEffect, useRef, useState } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import { ChevronDown, ChevronUp, Search, X } from "lucide-react";
import { MAX_MATCHES, getSearchState, replaceAll, replaceCurrent, setSearch } from "@/lib/tiptap-search";
import { showToast } from "@/app/dashboard/_components/toast-events";
import { useCeviri } from "@/app/_components/dil-saglayici";

// Araç çubuğunun altında açılan bul/değiştir satırı (Ctrl/Cmd+F).
// Enter: sonraki, Shift+Enter: önceki, Esc: kapat.
export default function FindReplaceBar({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const t = useCeviri();
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
    <div className="find-bar" role="search" aria-label={t({ tr: "Bul ve değiştir", en: "Find and replace" })}>
      <Search size={15} aria-hidden="true" className="muted" />
      <input
        ref={inputRef}
        className="find-input"
        value={query}
        placeholder={t({ tr: "Metinde bul", en: "Find in text" })}
        aria-label={t({ tr: "Aranacak metin", en: "Text to find" })}
        onChange={(event) => {
          setQuery(event.target.value);
          setSearch(editor, event.target.value, 0);
        }}
        onKeyDown={onKeyDown}
      />
      <span className="find-count" aria-live="polite">
        {query ? (count ? `${current + 1}/${count}${count >= MAX_MATCHES ? "+" : ""}` : t({ tr: "Yok", en: "None" })) : ""}
      </span>
      <button type="button" className="find-icon-button" onClick={() => go(-1)} disabled={count === 0} aria-label={t({ tr: "Önceki eşleşme", en: "Previous match" })}>
        <ChevronUp size={15} />
      </button>
      <button type="button" className="find-icon-button" onClick={() => go(1)} disabled={count === 0} aria-label={t({ tr: "Sonraki eşleşme", en: "Next match" })}>
        <ChevronDown size={15} />
      </button>
      <input
        className="find-input"
        value={replacement}
        placeholder={t({ tr: "Şununla değiştir", en: "Replace with" })}
        aria-label={t({ tr: "Yeni metin", en: "Replacement text" })}
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
        {t({ tr: "Değiştir", en: "Replace" })}
      </button>
      <button
        type="button"
        className="projects-filter-button button-compact"
        disabled={count === 0}
        onClick={() => {
          const replaced = replaceAll(editor, replacement);
          if (replaced) {
            showToast(
              "success",
              t({ tr: `${replaced} yer değiştirildi. Geri almak için Ctrl+Z.`, en: `${replaced} replaced. Press Ctrl+Z to undo.` })
            );
          }
        }}
      >
        {t({ tr: "Tümünü değiştir", en: "Replace all" })}
      </button>
      <button type="button" className="find-icon-button" onClick={close} aria-label={t({ tr: "Bul ve değiştiri kapat", en: "Close find and replace" })}>
        <X size={15} />
      </button>
    </div>
  );
}
