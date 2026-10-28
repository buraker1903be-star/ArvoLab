"use client";

import { useCeviri, useDil } from "@/app/_components/dil-saglayici";
import { YEREL, type Dil } from "@/lib/dil";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, BookOpenCheck, CheckCheck, Eye, MessageSquare, ShieldCheck, UserPlus, Workflow } from "lucide-react";
import Dialog from "./dialog";
import { listNotifications, markNotificationsRead, type NotificationKind, type PanelNotification } from "@/app/actions/notifications";

const POLL_MS = 60_000;

const KIND_ICON: Record<NotificationKind, typeof Bell> = {
  comment: MessageSquare,
  assignment: UserPlus,
  status: Workflow,
  approval: ShieldCheck,
  guideline_update: BookOpenCheck,
  share_view: Eye,
};

function formatAgo(value: string, dil: Dil) {
  const relativeTime = new Intl.RelativeTimeFormat(dil, { numeric: "auto" });
  const minutes = Math.round((new Date(value).getTime() - Date.now()) / 60_000);
  if (minutes > -1) return dil === "tr" ? "az önce" : "just now";
  if (minutes > -60) return relativeTime.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (hours > -24) return relativeTime.format(hours, "hour");
  const days = Math.round(hours / 24);
  if (days > -7) return relativeTime.format(days, "day");
  return new Date(value).toLocaleDateString(YEREL[dil], { dateStyle: "medium" });
}

// Üst çubuktaki zil: yorum, atama, durum, onay ve kılavuz güncellemeleri.
// Sekme görünürken dakikada bir yoklanır; sekmeye dönüldüğünde hemen yenilenir.
export default function NotificationBell() {
  const dil = useDil();
  const t = useCeviri();
  const [items, setItems] = useState<PanelNotification[] | null>(null);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const requestRef = useRef(0);

  const refresh = useCallback(async () => {
    const request = ++requestRef.current;
    const result = await listNotifications();
    if (request !== requestRef.current) return;
    setItems(result.items);
    setUnread(result.unread);
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  const close = useCallback(() => setOpen(false), []);

  const markRead = (ids?: string[]) => {
    const now = new Date().toISOString();
    const targets = ids ? new Set(ids) : null;
    setItems((current) =>
      current?.map((item) => (!item.readAt && (!targets || targets.has(item.id)) ? { ...item, readAt: now } : item)) ?? current
    );
    setUnread((count) => (targets ? Math.max(0, count - (items?.filter((item) => !item.readAt && targets.has(item.id)).length ?? 0)) : 0));
    void markNotificationsRead(ids).then((result) => {
      if (result.error) void refresh();
    });
  };

  const label =
    unread > 0
      ? t({ tr: `Bildirimler (${unread} okunmamış)`, en: `Notifications (${unread} unread)` })
      : t({ tr: "Bildirimler", en: "Notifications" });

  return (
    <>
      <button
        type="button"
        className="dashboard-icon-button notification-bell"
        onClick={() => {
          setOpen(true);
          void refresh();
        }}
        aria-label={label}
        title={label}
      >
        <Bell size={17} strokeWidth={1.9} aria-hidden="true" />
        {unread > 0 ? <span className="notification-badge" aria-hidden="true">{unread > 99 ? "99+" : unread}</span> : null}
      </button>

      <Dialog open={open} onClose={close} kicker={t({ tr: "Bildirimler", en: "Notifications" })} title={t({ tr: "Son gelişmeler", en: "Latest updates" })}>
        <div className="stack">
          {unread > 0 ? (
            <button type="button" className="projects-filter-button notification-mark-all" onClick={() => markRead()}>
              <CheckCheck size={14} aria-hidden="true" />
              {t({ tr: "Tümünü okundu say", en: "Mark all as read" })}
            </button>
          ) : null}
          {items === null ? (
            <p className="muted text-sm" aria-busy="true">{t({ tr: "Bildirimler yükleniyor…", en: "Loading notifications…" })}</p>
          ) : items.length === 0 ? (
            <div className="empty-state">
              <Bell size={22} aria-hidden="true" />
              <p>
                {t({
                  tr: "Henüz bildirim yok. Yorumlar, uzman atamaları, durum değişiklikleri ve kılavuz güncellemeleri burada görünür.",
                  en: "No notifications yet. Comments, expert assignments, status changes and guideline updates appear here.",
                })}
              </p>
            </div>
          ) : (
            <ul className="picker-list notification-list">
              {items.map((item) => {
                const Icon = KIND_ICON[item.kind] ?? Bell;
                const content = (
                  <>
                    <span className="notification-icon" aria-hidden="true">
                      <Icon size={16} />
                    </span>
                    <span className="picker-main">
                      <strong>{item.title}</strong>
                      {item.body ? <span className="notification-body">{item.body}</span> : null}
                      <small>{formatAgo(item.createdAt, dil)}</small>
                    </span>
                    {item.readAt ? null : <span className="notification-dot" aria-label={t({ tr: "Okunmadı", en: "Unread" })} />}
                  </>
                );
                return (
                  <li key={item.id}>
                    {item.link ? (
                      <Link
                        href={item.link}
                        className="picker-item notification-item"
                        data-unread={item.readAt ? undefined : "true"}
                        onClick={() => {
                          if (!item.readAt) markRead([item.id]);
                          close();
                        }}
                      >
                        {content}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        className="picker-item notification-item"
                        data-unread={item.readAt ? undefined : "true"}
                        onClick={() => {
                          if (!item.readAt) markRead([item.id]);
                        }}
                      >
                        {content}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Dialog>
    </>
  );
}
