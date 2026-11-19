import {
  IconArrowUpCircle,
  IconAlertCircle,
  IconArchive,
  IconCircleCheck,
  IconDots,
  IconFolder,
  IconInbox,
  IconMailOff,
  IconMailOpened,
  IconPencil,
  IconPlus,
  IconRefresh,
  IconSend,
  IconSettings,
  IconStar,
  IconTrash,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
import logo from "../../src-tauri/icons/128x128.png";
import { Button, ContextMenu } from "../components/ui";
import { getLanguage, t } from "../lib/i18n";
import { useT } from "../lib/useT";
import { ALL_INBOXES, allInboxes, useStore } from "../store";
import { DRAG_TYPE } from "./MessageList";
import type { Folder, FolderRole, Progress } from "../types";

const icons: Record<FolderRole, typeof IconInbox> = {
  inbox: IconInbox,
  drafts: IconPencil,
  sent: IconSend,
  trash: IconTrash,
  junk: IconMailOff,
  archive: IconArchive,
  custom: IconFolder,
};

/** One folder. `label` replaces its name where that alone would be unclear (the pinned ones at the top). */
function FolderRow({ folder, label, pinned }: { folder: Folder; label?: string; pinned?: boolean }) {
  const t = useT();
  const selected = useStore((s) => s.folderId === folder.id && !s.query.trim());
  const selectFolder = useStore((s) => s.selectFolder);
  const moveMessages = useStore((s) => s.moveMessages);
  const toggleFavorite = useStore((s) => s.toggleFavorite);
  const markFolderRead = useStore((s) => s.markFolderRead);
  const emptyTrash = useStore((s) => s.emptyTrash);
  const showToast = useStore((s) => s.showToast);
  const [over, setOver] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  // "All inboxes" is not a real folder: nothing can be moved into it or starred.
  const real = folder.id !== ALL_INBOXES;
  // A favourite shown at the top wears a star, so it is not mistaken for the folder in its account.
  const Icon = pinned && real ? IconStar : icons[folder.role];
  const starLabel = folder.favorite ? t("folders.removeFavorite") : t("folders.addFavorite");
  return (
    <>
      <button
        type="button"
        onClick={() => selectFolder(folder.id)}
        aria-current={selected}
        title={label ?? folder.name}
        onContextMenu={(e) => {
          e.preventDefault();
          setConfirmEmpty(false);
          setMenu({ x: e.clientX, y: e.clientY });
        }}
        // Messages dragged from the list can be dropped here to move them.
        onDragOver={(e) => {
          if (!real || !e.dataTransfer.types.includes(DRAG_TYPE)) return;
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const { ids, accountId } = JSON.parse(e.dataTransfer.getData(DRAG_TYPE)) as { ids: number[]; accountId: number };
          if (accountId !== folder.accountId) showToast(t("toast.moveSameAccount"));
          else void moveMessages(ids, { folderId: folder.id });
        }}
        className={`flex w-full flex-none items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left ${over ? "bg-soft text-ink" : selected ? "bg-sel text-ink" : "text-ink2 hover:bg-hover"}`}
      >
        <Icon size={18} stroke={1.6} className="flex-none" />
        <span className="truncate">{label ?? folder.name}</span>
        {folder.unread > 0 && <span className="ml-auto pl-1 text-xs text-ink3">{folder.unread}</span>}
      </button>
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={
            confirmEmpty
              ? [
                  {
                    custom: (close) => (
                      <div className="w-64 px-3 py-2">
                        <p className="text-[13px] text-ink">{t("folders.emptyTrashConfirm", { folder: folder.name })}</p>
                        <div className="mt-2 flex gap-2">
                          <Button
                            className="h-8 text-danger"
                            onClick={() => {
                              close();
                              setConfirmEmpty(false);
                              void emptyTrash(folder);
                            }}
                          >
                            {t("folders.emptyTrash")}
                          </Button>
                          <Button
                            className="h-8"
                            onClick={() => {
                              setConfirmEmpty(false);
                              close();
                            }}
                          >
                            {t("common.cancel")}
                          </Button>
                        </div>
                      </div>
                    ),
                  },
                ]
              : [
                  { label: t("folders.markAllRead"), icon: <IconMailOpened size={16} />, onSelect: () => void markFolderRead(folder) },
                  ...(real ? [{ label: starLabel, icon: <IconStar size={16} />, onSelect: () => void toggleFavorite(folder) }] : []),
                  ...(real && folder.role === "trash"
                    ? [
                        {
                          label: t("folders.emptyTrash"),
                          icon: <IconTrash size={16} />,
                          danger: true,
                          onSelect: () => {
                            setConfirmEmpty(true);
                            setMenu({ x: menu.x, y: menu.y });
                          },
                        },
                      ]
                    : []),
                ]
          }
          onClose={() => setMenu(null)}
        />
      )}
    </>
  );
}

/** An account: its address as a quiet label, its standard folders, and the rest behind "More". */
function AccountFolders({ address, folders }: { address: string; folders: Folder[] }) {
  const t = useT();
  const selectedId = useStore((s) => s.folderId);
  const main = folders.filter((f) => f.role !== "custom");
  const extra = folders.filter((f) => f.role === "custom");
  // Open when the folder being shown is one of the extra ones, so the selection is never hidden.
  const [open, setOpen] = useState(false);
  const shown = open || extra.some((f) => f.id === selectedId);
  return (
    <section className="flex flex-none flex-col gap-px">
      <p className="truncate px-2.5 pt-5 pb-1.5 text-xs text-ink3" title={address}>
        {address}
      </p>
      {main.map((f) => (
        <FolderRow key={f.id} folder={f} />
      ))}
      {extra.length > 0 && (
        <button type="button" onClick={() => setOpen(!shown)} aria-expanded={shown} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-left text-ink2 hover:bg-hover">
          <IconDots size={18} stroke={1.6} className="flex-none" />
          {shown ? t("folders.less") : t("folders.more")}
        </button>
      )}
      {shown && extra.map((f) => <FolderRow key={f.id} folder={f} />)}
    </section>
  );
}

/** One line describing what sync is doing for an account. */
export function statusText(p: Progress | undefined): string {
  if (!p) return "";
  const locale = getLanguage() === "vi" ? "vi-VN" : "en-US";
  switch (p.phase) {
    case "folders":
      return t("sync.checkingFolders");
    case "headers":
      return t("sync.syncing", { message: p.message, done: p.done.toLocaleString(locale), total: p.total.toLocaleString(locale) });
    case "bodies":
      return t("sync.downloading", { done: p.done.toLocaleString(locale), total: p.total.toLocaleString(locale) });
    case "idle":
      return t("sync.upToDate");
    case "error":
      return p.message;
  }
}

/** Shown above the sync line when a newer version exists. Opens Settings, About. */
function UpdateNotice() {
  const t = useT();
  const update = useStore((s) => s.update);
  const setDialog = useStore((s) => s.setDialog);
  if (!update) return null;
  return (
    <button
      type="button"
      onClick={() => setDialog("settings", "about")}
      title={t("update.availableTitle", { version: update.version })}
      className="mt-1 flex w-full flex-none items-center gap-2 rounded-lg bg-brand/10 px-2.5 py-2 text-left text-xs font-medium text-brand hover:bg-brand/15"
    >
      <IconArrowUpCircle size={16} stroke={1.8} className="flex-none" />
      <span className="truncate">{t("update.available", { version: update.version })}</span>
    </button>
  );
}

/** The line at the bottom of the sidebar: what sync is doing. Clicking it shows every account's state. */
function SyncStatus() {
  const t = useT();
  const syncNow = useStore((s) => s.syncNow);
  const setDialog = useStore((s) => s.setDialog);
  const accounts = useStore((s) => s.accounts);
  const progress = useStore((s) => s.progress);
  // Where the line is on screen while the list of accounts is open above it.
  const [open, setOpen] = useState<{ left: number; bottom: number } | null>(null);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [open]);
  const all = accounts.flatMap((a) => (progress[a.id] ? [progress[a.id]] : []));
  const failed = all.find((p) => p.phase === "error");
  const busy = all.find((p) => p.phase !== "idle" && p.phase !== "error");
  const text = failed ? statusText(failed) : busy ? statusText(busy) : t("sync.upToDate");
  const Icon = failed ? IconAlertCircle : busy ? IconRefresh : IconCircleCheck;
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open !== null}
        onClick={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
          setOpen({ left: box.left, bottom: window.innerHeight - box.top + 4 });
        }}
        title={t("sync.clickForAccounts", { text })}
        className={`flex w-full flex-none items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs hover:bg-hover mt-1 ${failed ? "text-danger" : "text-ink3"}`}
      >
        <Icon size={16} stroke={1.6} className={`flex-none ${busy && !failed ? "animate-spin" : ""}`} />
        <span className="truncate" role="status">
          {text}
        </span>
      </button>
      {open && (
        <div className="fixed inset-0 z-30" onMouseDown={() => setOpen(null)}>
          <div
            role="dialog"
            aria-label={t("sync.status")}
            className="fixed z-30 w-[340px] max-w-[calc(100vw-16px)] rounded-[10px] border border-edge bg-card p-3 shadow-lg"
            style={open}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="mb-2 font-semibold text-ink">{t("sync.status")}</div>
            {accounts.length === 0 && <p className="text-[13px] text-ink2">{t("accounts.none")}</p>}
            {accounts.map((a) => {
              const p = progress[a.id];
              const bad = p?.phase === "error";
              const Mark = bad ? IconAlertCircle : !p || p.phase === "idle" ? IconCircleCheck : IconRefresh;
              return (
                <div key={a.id} className="mb-2 flex gap-2">
                  <Mark size={16} stroke={1.6} className={`mt-0.5 flex-none ${bad ? "text-danger" : "text-ink3"}`} />
                  <div className="min-w-0 flex-1">
                    <div className="selectable truncate text-[13px] text-ink">{a.address}</div>
                    <div className={`selectable text-xs break-words ${bad ? "text-danger" : "text-ink2"}`}>{statusText(p) || t("sync.waiting")}</div>
                  </div>
                </div>
              );
            })}
            <div className="mt-3 flex gap-2">
              <Button className="h-8" onClick={syncNow}>
                {t("sync.now")}
              </Button>
              {failed && (
                <Button
                  className="h-8"
                  onClick={() => {
                    setOpen(null);
                    setDialog("settings", "accounts");
                  }}
                >
                  {t("sync.accountSettings")}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** In the header beside Settings: checks every account for new mail now. Turns while a check runs. */
function RefreshButton() {
  const t = useT();
  const syncNow = useStore((s) => s.syncNow);
  const busy = useStore((s) => Object.values(s.progress).some((p) => p.phase !== "idle" && p.phase !== "error"));
  return (
    <button type="button" aria-label={t("sync.checkNew")} title={t("sync.checkNew")} onClick={syncNow} className="ml-auto rounded-lg p-1.5 text-ink3 hover:bg-hover hover:text-ink">
      <IconRefresh size={18} stroke={1.6} className={busy ? "animate-spin" : ""} />
    </button>
  );
}

export function FolderPane({ width }: { width: number }) {
  const t = useT();
  const compose = useStore((s) => s.compose);
  const accounts = useStore((s) => s.accounts);
  const folders = useStore((s) => s.folders);
  const setDialog = useStore((s) => s.setDialog);
  const favorites = folders.filter((f) => f.favorite && f.role !== "inbox");
  // With several accounts, a folder name alone does not say whose it is.
  const owner = (f: Folder) => (accounts.length > 1 ? `${f.name} · ${accounts.find((a) => a.id === f.accountId)?.address ?? ""}` : undefined);
  return (
    <nav className="flex flex-none flex-col bg-canvas px-2.5 pt-3.5 pb-2" style={{ width }} aria-label={t("folders.label")}>
      <div className="mb-3 flex flex-none items-center gap-2 pr-0.5 pl-2">
        <img src={logo} alt="" className="size-[22px]" />
        <span className="truncate text-[17px] text-ink">VN Mail</span>
        <RefreshButton />
        <button type="button" aria-label={t("common.settings")} title={t("common.settings")} onClick={() => setDialog("settings")} className="rounded-lg p-1.5 text-ink3 hover:bg-hover hover:text-ink">
          <IconSettings size={18} stroke={1.6} />
        </button>
      </div>
      <button type="button" onClick={() => compose()} className="mb-3 flex h-10 w-full flex-none items-center justify-center gap-2 rounded-[10px] bg-brand font-semibold text-on-brand hover:brightness-110">
        <IconPencil size={18} stroke={1.6} />
        {t("common.newMail")}
      </button>
      {/* Only the folders scroll: the header above and the sync line below stay in place. */}
      <div className="-mx-2.5 flex min-h-0 flex-1 flex-col gap-px overflow-y-auto px-2.5">
      {accounts.length > 0 && <FolderRow folder={allInboxes(folders)} />}
      {favorites.map((f) => (
        <FolderRow key={`fav-${f.id}`} folder={f} label={owner(f)} pinned />
      ))}
      {accounts.map((a) => (
        <AccountFolders key={a.id} address={a.address} folders={folders.filter((f) => f.accountId === a.id)} />
      ))}
      {accounts.length === 0 && (
        <button type="button" onClick={() => setDialog("add-account")} className="mt-2 flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-left text-brand hover:bg-hover">
          <IconPlus size={18} stroke={1.6} />
          {t("accounts.add")}
        </button>
      )}
      </div>
      <UpdateNotice />
      <SyncStatus />
    </nav>
  );
}
