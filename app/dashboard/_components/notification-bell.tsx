"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, BookOpenCheck, CheckCheck, MessageSquare, ShieldCheck, UserPlus, Workflow } from "lucide-react";
import Dialog from "./dialog";
import { listNotifications, markNotificationsRead, type NotificationKind, type PanelNotification } from "@/app/actions/notifications";

const POLL_MS = 60_000;

const KIND_ICON: Record<NotificationKind, typeof Bell> = {
  comment: MessageSquare,
  assignment: UserPlus,
  status: Workflow,
  approval: ShieldCheck,
  guideline_update: BookOpenCheck,
};

const relativeTime = new Intl.RelativeTimeFormat("tr", { numeric: "auto" });
function formatAgo(value: string) {
  const minutes = Math.round((new Date(value).getTime() - Date.now()) / 60_000);
  if (minutes > -1) return "az önce";
  if (minutes > -60) return relativeTime.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (hours > -24) return relativeTime.format(hours, "hour");
  const days = Math.round(hours / 24);
  if (days > -7) return relativeTime.format(days, "day");
  return new Date(value).toLocaleDateString("tr-TR", { dateStyle: "medium" });
}

// Üst çubuktaki zil: yorum, atama, durum, onay ve kılavuz güncellemeleri.
// Sekme görünürken dakikada bir yoklanır; sekmeye dönüldüğünde hemen yenilenir.
export default function NotificationBell() {
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

  const label = unread > 0 ? `Bildirimler (${unread} okunmamış)` : "Bildirimler";

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

      <Dialog open={open} onClose={close} kicker="Bildirimler" title="Son gelişmeler">
        <div className="stack">
          {unread > 0 ? (
            <button type="button" className="projects-filter-button notification-mark-all" onClick={() => markRead()}>
              <CheckCheck size={14} aria-hidden="true" />
              Tümünü okundu say
            </button>
          ) : null}
          {items === null ? (
            <p className="muted text-sm" aria-busy="true">Bildirimler yükleniyor…</p>
          ) : items.length === 0 ? (
            <div className="empty-state">
              <Bell size={22} aria-hidden="true" />
              <p>Henüz bildirim yok. Yorumlar, uzman atamaları, durum değişiklikleri ve kılavuz güncellemeleri burada görünür.</p>
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
                      <small>{formatAgo(item.createdAt)}</small>
                    </span>
                    {item.readAt ? null : <span className="notification-dot" aria-label="Okunmadı" />}
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
