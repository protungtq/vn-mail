import { IconBell, IconCloudDownload, IconCoffee, IconFilter, IconHeart, IconInfoCircle, IconPalette, IconShieldLock, IconSignature, IconTrash, IconUserCircle, IconX } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import logo from "../../src-tauri/icons/128x128.png";
import { backend, errorText } from "../backend";
import type { AppInfo } from "../backend";
import { RichText } from "../components/RichText";
import { Button, Chip, IconButton, categories, fieldBox, fieldCaption } from "../components/ui";
import { fontChoice, textSizeOptions } from "../lib/font";
import { DONATE, REPOSITORY, WEBSITE } from "../lib/links";
import { pictureFromFile, signatureHtml } from "../lib/signature";
import { useLang, useT } from "../lib/useT";
import { useStore } from "../store";
import type { SettingsPage } from "../store";
import type { Rule, SavedSignature } from "../types";
import { statusText } from "./FolderPane";
import { imageSenders } from "./HtmlBody";

const pages: [SettingsPage, typeof IconBell][] = [
  ["accounts", IconUserCircle],
  ["signatures", IconSignature],
  ["sync", IconCloudDownload],
  ["appearance", IconPalette],
  ["privacy", IconShieldLock],
  ["rules", IconFilter],
  ["notifications", IconBell],
  ["about", IconInfoCircle],
  ["sponsor", IconHeart],
];

function Problem({ text }: { text: string }) {
  if (!text) return null;
  return (
    <p className="selectable mt-3 rounded-[10px] bg-canvas px-3 py-2 text-[13px] text-danger" role="alert">
      {text}
    </p>
  );
}

function Options<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="mb-4">
      <div className={fieldCaption}>{label}</div>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
        {options.map(([v, text]) => (
          <Chip key={v} on={value === v} onClick={() => onChange(v)}>
            {text}
          </Chip>
        ))}
      </div>
    </div>
  );
}

function Accounts() {
  const t = useT();
  const accounts = useStore((s) => s.accounts);
  const progress = useStore((s) => s.progress);
  const settings = useStore((s) => s.settings);
  const { setSetting, setDialog, refresh } = useStore.getState();
  const [confirm, setConfirm] = useState<number | null>(null);
  const [error, setError] = useState("");

  // A large mailbox takes a while to delete: say so instead of looking stuck.
  const [removing, setRemoving] = useState<number | null>(null);

  async function remove(id: number) {
    setError("");
    setRemoving(id);
    try {
      await backend.removeAccount(id);
      setConfirm(null);
      await refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setRemoving(null);
    }
  }

  // Reordering: drag a row by its handle, or focus the handle and press the up or down arrow.
  const [dragged, setDragged] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);

  async function move(id: number, to: number) {
    const from = accounts.findIndex((a) => a.id === id);
    if (from < 0 || to < 0 || to >= accounts.length || to === from) return;
    const next = [...accounts];
    next.splice(to, 0, ...next.splice(from, 1));
    useStore.setState({ accounts: next }); // show it at once; the engine follows
    setError("");
    try {
      await backend.reorderAccounts(next.map((a) => a.id));
    } catch (e) {
      setError(errorText(e));
    }
    await refresh();
  }

  return (
    <>
      {accounts.map((a, index) => (
        <div
          key={a.id}
          className={`mb-2 flex items-center gap-2 rounded-[10px] border py-2 pr-3 pl-1.5 ${over === a.id && dragged !== a.id ? "border-brand bg-soft" : "border-edge"} ${dragged === a.id ? "opacity-50" : ""}`}
          onDragOver={(e) => {
            if (dragged === null) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            setOver(a.id);
          }}
          onDrop={(e) => {
            e.preventDefault();
            if (dragged !== null) void move(dragged, index);
            setDragged(null);
            setOver(null);
          }}
        >
          {accounts.length > 1 && (
            <button
              type="button"
              draggable
              aria-label={t("settings.moveAccount", { address: a.address })}
              title={t("settings.dragReorder")}
              className="flex-none cursor-grab rounded-md p-1.5 text-ink3 hover:bg-hover hover:text-ink active:cursor-grabbing"
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", a.address);
                setDragged(a.id);
              }}
              onDragEnd={() => {
                setDragged(null);
                setOver(null);
              }}
              onKeyDown={(e) => {
                if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
                e.preventDefault();
                void move(a.id, index + (e.key === "ArrowUp" ? -1 : 1));
              }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
                <circle cx="4" cy="4" r="1.6" />
                <circle cx="10" cy="4" r="1.6" />
                <circle cx="4" cy="10" r="1.6" />
                <circle cx="10" cy="10" r="1.6" />
              </svg>
            </button>
          )}
          <div className={`min-w-0 flex-1 ${accounts.length > 1 ? "" : "pl-1.5"}`}>
            <div className="selectable truncate">{a.address}</div>
            <div className="truncate text-xs text-ink2">
              {a.kind === "gmail" ? "Google" : "IMAP"}
              {progress[a.id] && ` · ${statusText(progress[a.id])}`}
            </div>
            <div className="truncate text-xs text-ink2" title={t("settings.authServerTitle")}>
              {a.authServer ? t("settings.senderChecksBy", { server: a.authServer }) : t("settings.senderChecksLearning")}
            </div>
          </div>
          {removing === a.id ? (
            <span className="text-[13px] text-ink2" role="status">
              {t("settings.removing")}
            </span>
          ) : confirm === a.id ? (
            <>
              <span className="text-[13px] text-ink2">{t("settings.removeConfirm")}</span>
              <Button className="h-8 text-danger" onClick={() => void remove(a.id)}>
                {t("common.remove")}
              </Button>
              <Button className="h-8" onClick={() => setConfirm(null)}>
                {t("settings.keep")}
              </Button>
            </>
          ) : (
            <IconButton label={t("settings.removeAccount", { address: a.address })} onClick={() => setConfirm(a.id)}>
              <IconTrash size={18} />
            </IconButton>
          )}
        </div>
      ))}
      {accounts.length === 0 && <p className="mb-2 text-ink2">{t("accounts.none")}</p>}
      <Button variant="primary" onClick={() => setDialog("add-account")}>
        {t("accounts.add")}
      </Button>
      <p className="mt-2 text-xs text-ink3">
        {accounts.length > 1 && `${t("settings.dragNote")} `}
        {t("settings.removeNote")}
      </p>
      <Problem text={error} />

      <h3 className="mt-6 mb-1 font-semibold">{t("settings.googleSignIn")}</h3>
      <p className="mb-2 text-[13px] text-ink2">
        {t("settings.googleClientNote")}
      </p>
      <label className={fieldCaption} htmlFor="g-id">
        {t("settings.clientId")}
      </label>
      <input id="g-id" className={fieldBox} value={settings.google_client_id ?? ""} placeholder="1234567890-abc.apps.googleusercontent.com" autoComplete="off" onChange={(e) => void setSetting("google_client_id", e.target.value)} />
      <label className={`${fieldCaption} mt-3`} htmlFor="g-secret">
        {t("settings.clientSecret")}
      </label>
      <input id="g-secret" type="password" className={fieldBox} value={settings.google_client_secret ?? ""} autoComplete="off" onChange={(e) => void setSetting("google_client_secret", e.target.value)} />
    </>
  );
}

function Signatures() {
  const t = useT();
  const signatures = useStore((s) => s.signatures);
  const defaults = useStore((s) => s.signatureDefaults);
  const accounts = useStore((s) => s.accounts);
  const loadPreferences = useStore((s) => s.loadPreferences);
  const [editing, setEditing] = useState<SavedSignature | null>(signatures[0] ?? null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const defaultsOf = (accountId: number) => defaults.find((d) => d.accountId === accountId) ?? { accountId, newId: null, replyId: null };
  const nameOf = (id: number | null) => signatures.find((s) => s.id === id)?.name ?? null;

  // ----- saving, automatically -----
  /** The signature as last edited, and whether that is saved yet. */
  const latest = useRef(editing);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  /** Writes run one after another. */
  const writing = useRef(Promise.resolve());
  const run = (work: () => Promise<void>) => {
    writing.current = writing.current.then(work).then(
      () => (setError(""), setSaved(true)),
      (e) => setError(errorText(e)),
    );
    return writing.current;
  };
  /** Save now, if anything changed. Uses only refs, so it also works while Settings closes. */
  const flush = useRef(() => {
    clearTimeout(timer.current);
    const signature = latest.current;
    if (!dirty.current || !signature) return;
    dirty.current = false;
    void run(async () => {
      await backend.saveSignature(signature);
      await loadPreferences();
    });
  }).current;
  useEffect(() => flush, [flush]);

  /** Change the signature being edited; it is saved shortly after the last change. */
  const change = (part: Partial<SavedSignature>) => {
    if (!latest.current) return;
    latest.current = { ...latest.current, ...part };
    setEditing(latest.current);
    dirty.current = true;
    setSaved(false);
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 600);
  };
  const edit = (signature: SavedSignature | null) => {
    flush();
    latest.current = signature;
    setEditing(signature);
    setSaved(false);
  };

  /** Use the signature for an account's new mail or replies, or stop using it there. */
  const setUse = (accountId: number, which: "newId" | "replyId", on: boolean) => {
    const id = editing?.id;
    if (!id) return;
    void run(async () => {
      const now = useStore.getState().signatureDefaults.find((d) => d.accountId === accountId) ?? { accountId, newId: null, replyId: null };
      await backend.setSignatureDefaults({ ...now, [which]: on ? id : null });
      await loadPreferences();
    });
  };

  /** A new signature exists from the start, so every later change is simply saved. */
  const add = () => {
    flush();
    void run(async () => {
      const fresh: SavedSignature = { id: 0, name: t("signatures.new"), html: "", layout: "text", image: "" };
      const id = await backend.saveSignature(fresh);
      await loadPreferences();
      latest.current = { ...fresh, id };
      setEditing(latest.current);
    });
  };

  async function remove() {
    if (!editing) return;
    clearTimeout(timer.current);
    dirty.current = false;
    await run(async () => {
      await backend.deleteSignature(editing.id);
      await loadPreferences();
    });
    edit(useStore.getState().signatures[0] ?? null);
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {signatures.map((s) => (
          <Chip key={s.id} on={editing?.id === s.id} onClick={() => edit(s)}>
            {s.name}
          </Chip>
        ))}
        <Button variant="ghost" className="h-7 text-brand" onClick={add}>
          {t("signatures.new")}
        </Button>
      </div>
      {editing && (
        <>
          <label className={fieldCaption} htmlFor="sig-name">
            {t("common.name")}
          </label>
          <input id="sig-name" className={fieldBox} value={editing.name} placeholder={t("signatures.namePlaceholder")} onChange={(e) => change({ name: e.target.value })} />
          <div className={`${fieldCaption} mt-3`}>{t("signatures.signatureLabel")}</div>
          <div className="rounded-[10px] border border-edge p-2">
            <RichText key={editing.id} label={t("signatures.signatureLabel")} className="h-36" initial={editing.html} onChange={(html) => html !== latest.current?.html && change({ html })} />
          </div>
          <div className={`${fieldCaption} mt-3`}>{t("signatures.picture")}</div>
          <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label={t("signatures.layoutLabel")}>
            {(
              [
                ["text", t("signatures.layoutText")],
                ["left", t("signatures.layoutLeft")],
                ["above", t("signatures.layoutAbove")],
              ] as const
            ).map(([layout, name]) => (
              <Chip key={layout} on={editing.layout === layout} onClick={() => change({ layout })}>
                {name}
              </Chip>
            ))}
            {editing.layout !== "text" && (
              <>
                <label className="ml-2 inline-flex h-7 cursor-pointer items-center rounded-full border border-edge px-3 text-[13px] hover:bg-hover">
                  {editing.image ? t("signatures.changeImage") : t("signatures.chooseImage")}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/webp"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (!file) return;
                      pictureFromFile(file)
                        .then((image) => change({ image }))
                        .catch(() => setError(t("signatures.imageError")));
                    }}
                  />
                </label>
                {editing.image && (
                  <Button variant="ghost" className="h-7 text-ink2" onClick={() => change({ image: "" })}>
                    {t("signatures.removeImage")}
                  </Button>
                )}
              </>
            )}
          </div>
          {editing.layout !== "text" && (
            <>
              <div className={`${fieldCaption} mt-3`}>{t("signatures.preview")}</div>
              {editing.image ? (
                <div className="rich selectable rounded-[10px] border border-dashed border-edge p-3" dangerouslySetInnerHTML={{ __html: signatureHtml(editing) }} />
              ) : (
                <p className="text-[13px] text-ink2">{t("signatures.pictureNote")}</p>
              )}
            </>
          )}
          <div className={`${fieldCaption} mt-4`}>{t("signatures.autoAdd")}</div>
          {accounts.length === 0 ? (
            <p className="text-[13px] text-ink3">{t("signatures.addAccountFirst")}</p>
          ) : (
            <div className="divide-y divide-edge rounded-[10px] border border-edge">
              {accounts.map((a) => {
                const now = defaultsOf(a.id);
                const use = { fresh: now.newId === editing.id, reply: now.replyId === editing.id };
                // Another signature that this account keeps using where a box is not ticked.
                const other = [!use.fresh && now.newId !== editing.id && nameOf(now.newId), !use.reply && now.replyId !== editing.id && nameOf(now.replyId)].filter(Boolean);
                return (
                  <div key={a.id} className="flex flex-wrap items-center gap-x-5 gap-y-1 px-3 py-2" role="group" aria-label={a.address}>
                    <div className="min-w-40 flex-1">
                      <div className="truncate">{a.address}</div>
                      {other.length > 0 && <div className="text-xs text-ink3">{t("signatures.usesOtherwise", { names: [...new Set(other)].join(t("privacy.listAnd")) })}</div>}
                    </div>
                    <label className="flex items-center gap-1.5 text-[13px]">
                      <input type="checkbox" className="size-4 accent-brand" checked={use.fresh} onChange={(e) => setUse(a.id, "newId", e.target.checked)} />
                      {t("signatures.newMail")}
                    </label>
                    <label className="flex items-center gap-1.5 text-[13px]">
                      <input type="checkbox" className="size-4 accent-brand" checked={use.reply} onChange={(e) => setUse(a.id, "replyId", e.target.checked)} />
                      {t("signatures.repliesForwards")}
                    </label>
                  </div>
                );
              })}
            </div>
          )}
          <p className="mt-1.5 text-xs text-ink3">{t("signatures.pickNote")}</p>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-[13px] text-ink3" role="status">
              {saved ? t("signatures.saved") : t("signatures.savingNote")}
            </span>
            <Button variant="ghost" className="ml-auto text-danger" onClick={() => void remove()}>
              <IconTrash size={16} /> {t("signatures.delete")}
            </Button>
          </div>
          <Problem text={error} />
        </>
      )}

    </>
  );
}

function Sync() {
  const t = useT();
  const settings = useStore((s) => s.settings);
  const accounts = useStore((s) => s.accounts);
  const progress = useStore((s) => s.progress);
  const setSetting = useStore((s) => s.setSetting);
  return (
    <>
      <Options
        label={t("sync.intervalText")}
        value={settings.sync_interval_minutes ?? "2"}
        onChange={(v) => void setSetting("sync_interval_minutes", v)}
        options={[
          ["1", t("sync.intervalMinute")],
          ["2", t("sync.intervalMinutes", { minutes: "2" })],
          ["5", t("sync.intervalMinutes", { minutes: "5" })],
          ["10", t("sync.intervalMinutes", { minutes: "10" })],
          ["15", t("sync.intervalMinutes", { minutes: "15" })],
          ["30", t("sync.intervalMinutes", { minutes: "30" })],
        ]}
      />
      <p className="mb-4 text-[13px] text-ink2">
        {t("sync.intervalNote")}
      </p>
      <Options
        label={t("sync.keepText")}
        value={settings.body_days ?? "0"}
        onChange={(v) => void setSetting("body_days", v)}
        options={[
          ["0", t("sync.keepAll")],
          ["730", t("sync.keep2y")],
          ["365", t("sync.keep1y")],
          ["90", t("sync.keep3m")],
        ]}
      />
      <p className="mb-4 text-[13px] text-ink2">
        {t("sync.keepNote")}
      </p>
      <div className={fieldCaption}>{t("sync.status")}</div>
      {accounts.map((a) => (
        <div key={a.id} className="mb-2 rounded-[10px] border border-edge px-3 py-2">
          <div className="truncate">{a.address}</div>
          <div className={`truncate text-xs ${progress[a.id]?.phase === "error" ? "text-danger" : "text-ink2"}`}>{statusText(progress[a.id]) || t("sync.waiting")}</div>
        </div>
      ))}
      <Button onClick={() => void backend.syncNow()}>{t("sync.now")}</Button>
    </>
  );
}

function Appearance() {
  const t = useT();
  const lang = useLang();
  const settings = useStore((s) => s.settings);
  const setSetting = useStore((s) => s.setSetting);
  const systemFont = useStore((s) => s.systemFont.family);
  return (
    <>
      <Options
        label={t("settings.language")}
        value={lang}
        onChange={(v) => void setSetting("language", v)}
        options={[
          ["en", "English"],
          ["vi", "Tiếng Việt"],
        ]}
      />
      <Options
        label={t("settings.font")}
        value={fontChoice(settings.font)}
        onChange={(v) => void setSetting("font", v)}
        options={[
          ["inter", "Inter"],
          ["nunito", t("settings.nunito")],
          ["system", systemFont ? t("settings.systemFont", { name: systemFont }) : t("settings.systemFontPlain")],
        ]}
      />
      <Options label={t("settings.textSize")} value={settings.text_size ?? "15"} onChange={(v) => void setSetting("text_size", v)} options={textSizeOptions(t)} />
      <Options
        label={t("settings.timeFormat")}
        value={settings.time_format === "12" ? "12" : "24"}
        onChange={(v) => void setSetting("time_format", v)}
        options={[
          ["24", t("settings.time24")],
          ["12", t("settings.time12")],
        ]}
      />
      <Options
        label={t("settings.theme")}
        value={settings.theme ?? "system"}
        onChange={(v) => void setSetting("theme", v)}
        options={[
          ["system", t("settings.themeSystem")],
          ["light", t("settings.themeLight")],
          ["dark", t("settings.themeDark")],
        ]}
      />
      <Options
        label={t("settings.colorTheme")}
        value={settings.color_theme ?? "default"}
        onChange={(v) => void setSetting("color_theme", v)}
        options={[
          ["default", t("settings.colorDefault")],
          ["jade", t("settings.colorJade")],
          ["lavender", t("settings.colorLavender")],
          ["amber", t("settings.colorAmber")],
          ["terracotta", t("settings.colorTerracotta")],
          ["charcoal", t("settings.colorCharcoal")],
        ]}
      />
      <Options
        label={t("settings.focusedInbox")}
        value={settings.focused_inbox === "off" ? "off" : "on"}
        onChange={(v) => void setSetting("focused_inbox", v)}
        options={[
          ["on", t("settings.focusedSplit")],
          ["off", t("settings.focusedOne")],
        ]}
      />
      <Options
        label={t("settings.density")}
        value={settings.density ?? "cozy"}
        onChange={(v) => void setSetting("density", v)}
        options={[
          ["roomy", t("settings.densityRoomy")],
          ["cozy", t("settings.densityCozy")],
          ["compact", t("settings.densityCompact")],
        ]}
      />
      <Options
        label={t("settings.undoSend")}
        value={settings.undo_seconds ?? "10"}
        onChange={(v) => void setSetting("undo_seconds", v)}
        options={[
          ["0", t("common.off")],
          ["5", t("time.seconds", { count: 5 })],
          ["10", t("time.seconds", { count: 10 })],
          ["30", t("time.seconds", { count: 30 })],
        ]}
      />
    </>
  );
}

function Privacy() {
  const t = useT();
  const settings = useStore((s) => s.settings);
  const setSetting = useStore((s) => s.setSetting);
  const onOff: ["on" | "off", string][] = [
    ["on", t("common.on")],
    ["off", t("common.off")],
  ];
  const note = "mb-4 -mt-2 text-[13px] text-ink2";
  // Same format as the image list: a JSON list of text entries.
  const blockedList = imageSenders(settings.blocked_senders);
  const imageList = imageSenders(settings.image_senders);
  return (
    <>
      <Options label={t("privacy.removeTrackers")} value={settings.block_trackers === "off" ? "off" : "on"} onChange={(v) => void setSetting("block_trackers", v)} options={onOff} />
      <p className={note}>{t("privacy.removeTrackersNote")}</p>
      <Options label={t("privacy.warnSuspicious")} value={settings.phishing_warnings === "off" ? "off" : "on"} onChange={(v) => void setSetting("phishing_warnings", v)} options={onOff} />
      <p className={note}>{t("privacy.warnNote")}</p>
      <Options label={t("privacy.brandLogos")} value={settings.brand_logos === "off" ? "off" : "on"} onChange={(v) => void setSetting("brand_logos", v)} options={onOff} />
      <p className={note}>{t("privacy.brandLogosNote")}</p>
      <p className={note}>{t("privacy.noStatsNote")}</p>
      <div className="mb-1 font-semibold">{t("privacy.blockedSenders")}</div>
      <p className="mb-2 text-[13px] text-ink2">
        {t("privacy.blockedNote")}
      </p>
      {blockedList.length === 0 ? (
        <p className="mb-4 text-[13px] text-ink3">{t("privacy.nobodyBlocked")}</p>
      ) : (
        <div className="mb-4 rounded-[10px] border border-edge">
          {blockedList.map((entry) => (
            <div key={entry} className="flex items-center gap-2 border-b border-edge px-3 py-1.5 last:border-b-0">
              <span className="selectable min-w-0 flex-1 truncate">{entry.startsWith("@") ? t("privacy.everyoneAt", { domain: entry.slice(1) }) : entry}</span>
              <Button className="h-7" onClick={() => void setSetting("blocked_senders", JSON.stringify(blockedList.filter((e) => e !== entry)))}>
                {t("privacy.unblock")}
              </Button>
            </div>
          ))}
        </div>
      )}
      <div className="mb-1 font-semibold">{t("privacy.imageSenders")}</div>
      <p className="mb-2 text-[13px] text-ink2">{t("privacy.imageSendersNote")}</p>
      {imageList.length === 0 ? (
        <p className="mb-4 text-[13px] text-ink3">{t("privacy.noSenders")}</p>
      ) : (
        <div className="mb-4 rounded-[10px] border border-edge">
          {imageList.map((address) => (
            <div key={address} className="flex items-center gap-2 border-b border-edge px-3 py-1.5 last:border-b-0">
              <span className="selectable min-w-0 flex-1 truncate">{address}</span>
              <Button className="h-7" onClick={() => void setSetting("image_senders", JSON.stringify(imageList.filter((a) => a !== address)))}>
                {t("common.remove")}
              </Button>
            </div>
          ))}
        </div>
      )}
      <p className="text-[13px] text-ink2">{t("privacy.alwaysOn")}</p>
    </>
  );
}

const blank: Rule = { id: 0, name: "", enabled: true, fromContains: "", subjectContains: "", action: "move", target: "Archive" };
const actionKinds: Rule["action"][] = ["move", "category", "flag", "read", "delete"];

function Rules() {
  const t = useT();
  const [rules, setRules] = useState<Rule[]>([]);
  const [editing, setEditing] = useState<Rule | null>(null);
  const [error, setError] = useState("");
  const reload = () => backend.listRules().then(setRules);
  useEffect(() => void reload(), []);

  async function save() {
    if (!editing) return;
    try {
      await backend.saveRule(editing);
      setEditing(null);
      setError("");
      await reload();
    } catch (e) {
      setError(errorText(e));
    }
  }

  const describe = (r: Rule) =>
    [r.fromContains && t("rules.descFrom", { text: r.fromContains }), r.subjectContains && t("rules.descSubject", { text: r.subjectContains })].filter(Boolean).join(t("rules.descAnd")) +
    " → " +
    t(`rules.action.${r.action}`) +
    (r.action === "move" || r.action === "category" ? `: ${r.action === "category" ? t(`category.${r.target}`) : r.target}` : "");

  return (
    <>
      <p className="mb-3 text-[13px] text-ink2">{t("rules.intro")}</p>
      {rules.map((r) => (
        <div key={r.id} className="mb-2 flex items-center gap-3 rounded-[10px] border border-edge px-3 py-2">
          <input type="checkbox" aria-label={t("rules.enable", { name: r.name })} checked={r.enabled} onChange={(e) => void backend.saveRule({ ...r, enabled: e.target.checked }).then(reload)} />
          <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setEditing(r)}>
            <div className="truncate">{r.name}</div>
            <div className="truncate text-xs text-ink2">{describe(r)}</div>
          </button>
          <IconButton label={t("rules.delete", { name: r.name })} onClick={() => void backend.deleteRule(r.id).then(reload)}>
            <IconTrash size={18} />
          </IconButton>
        </div>
      ))}
      {!editing && (
        <Button variant="primary" onClick={() => setEditing(blank)}>
          {t("rules.new")}
        </Button>
      )}
      {editing && (
        <div className="mt-3 rounded-[10px] border border-edge p-3">
          <label className={fieldCaption} htmlFor="rule-name">
            {t("common.name")}
          </label>
          <input id="rule-name" className={fieldBox} value={editing.name} placeholder={t("rules.namePlaceholder")} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label className={fieldCaption} htmlFor="rule-from">
                {t("rules.fromContains")}
              </label>
              <input id="rule-from" className={fieldBox} value={editing.fromContains} placeholder="newsletter@" onChange={(e) => setEditing({ ...editing, fromContains: e.target.value })} />
            </div>
            <div>
              <label className={fieldCaption} htmlFor="rule-subject">
                {t("rules.subjectContains")}
              </label>
              <input id="rule-subject" className={fieldBox} value={editing.subjectContains} onChange={(e) => setEditing({ ...editing, subjectContains: e.target.value })} />
            </div>
            <div>
              <label className={fieldCaption} htmlFor="rule-action">
                {t("rules.then")}
              </label>
              <select
                id="rule-action"
                className={fieldBox}
                value={editing.action}
                onChange={(e) => {
                  const action = e.target.value as Rule["action"];
                  setEditing({ ...editing, action, target: action === "category" ? "Blue" : action === "move" ? "Archive" : "" });
                }}
              >
                {actionKinds.map((v) => (
                  <option key={v} value={v}>
                    {t(`rules.action.${v}`)}
                  </option>
                ))}
              </select>
            </div>
            {editing.action === "move" && (
              <div>
                <label className={fieldCaption} htmlFor="rule-target">
                  {t("rules.folderName")}
                </label>
                <input id="rule-target" className={fieldBox} value={editing.target} onChange={(e) => setEditing({ ...editing, target: e.target.value })} />
              </div>
            )}
            {editing.action === "category" && (
              <div>
                <label className={fieldCaption} htmlFor="rule-category">
                  {t("rules.category")}
                </label>
                <select id="rule-category" className={fieldBox} value={editing.target} onChange={(e) => setEditing({ ...editing, target: e.target.value })}>
                  {Object.keys(categories).map((c) => (
                    <option key={c} value={c}>
                      {t(`category.${c}`)}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="mt-3 flex gap-2">
            <Button variant="primary" onClick={() => void save()}>
              {t("rules.save")}
            </Button>
            <Button onClick={() => (setEditing(null), setError(""))}>{t("common.cancel")}</Button>
          </div>
          <Problem text={error} />
        </div>
      )}
    </>
  );
}

function Notifications() {
  const t = useT();
  const settings = useStore((s) => s.settings);
  const setSetting = useStore((s) => s.setSetting);
  return (
    <>
      <Options
        label={t("notifications.desktop")}
        value={settings.notifications ?? "on"}
        onChange={(v) => void setSetting("notifications", v)}
        options={[
          ["on", t("common.on")],
          ["off", t("common.off")],
        ]}
      />
      <Options
        label={t("notifications.onClose")}
        value={settings.close_to_tray === "off" ? "off" : "on"}
        onChange={(v) => void setSetting("close_to_tray", v)}
        options={[
          ["on", t("notifications.tray")],
          ["off", t("notifications.quit")],
        ]}
      />
      <Options
        label={t("notifications.onLogin")}
        value={settings.start_at_login === "off" ? "off" : "on"}
        onChange={(v) => void setSetting("start_at_login", v)}
        options={[
          ["on", t("notifications.startTray")],
          ["off", t("notifications.noStart")],
        ]}
      />
      <p className="text-[13px] text-ink2">{t("notifications.note")}</p>
    </>
  );
}

const builtWith: [string, string][] = [
  ["Tauri", "https://tauri.app"],
  ["Rust", "https://www.rust-lang.org"],
  ["React", "https://react.dev"],
  ["SQLCipher", "https://www.zetetic.net/sqlcipher/"],
  ["TipTap", "https://tiptap.dev"],
  ["Tabler Icons", "https://tabler.io/icons"],
  ["Inter", "https://rsms.me/inter/"],
];

/** The command that installs a new version on systems where apt or dnf does it. */
const SYSTEM_UPDATE: Record<string, string> = {
  deb: "sudo apt update && sudo apt install --only-upgrade vnmail",
  rpm: "sudo dnf upgrade vnmail",
};

/** Whether a newer version exists, and the way to get it for this kind of installation. */
function Updates({ version }: { version: string }) {
  const t = useT();
  const update = useStore((s) => s.update);
  const [state, setState] = useState<"idle" | "checking" | "current" | "installing">("idle");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  async function check() {
    setState("checking");
    setError("");
    try {
      const found = await backend.checkUpdate();
      useStore.setState({ update: found });
      setState(found ? "idle" : "current");
    } catch (e) {
      setError(errorText(e));
      setState("idle");
    }
  }
  async function install() {
    setState("installing");
    setError("");
    try {
      await backend.installUpdate(); // VN Mail quits so the installer can replace it
    } catch (e) {
      setError(errorText(e));
      setState("idle");
    }
  }

  if (!update) {
    return (
      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-[10px] border border-edge px-3 py-2.5">
        <span className="text-ink2">{state === "current" ? t("update.newest", { version }) : state === "checking" ? t("update.checking") : t("update.noCheck")}</span>
        <Button className="ml-auto h-7" onClick={() => void check()}>
          {t("update.checkNow")}
        </Button>
        <Problem text={error} />
      </div>
    );
  }
  const command = SYSTEM_UPDATE[update.package];
  return (
    <div className="mt-4 rounded-[10px] border border-brand/40 bg-brand/5 px-3 py-2.5" role="status">
      <div className="font-semibold">{t("update.availableVersion", { version: update.version })}</div>
      {update.notes && <p className="mt-0.5 text-[13px] text-ink2">{update.notes}</p>}
      {update.how === "install" && (
        <div className="mt-2 flex items-center gap-3">
          <Button variant="primary" onClick={() => void install()}>
            {state === "installing" ? t("update.installing") : t("update.install")}
          </Button>
          <span className="text-[13px] text-ink2">{t("update.signedNote")}</span>
        </div>
      )}
      {update.how === "system" && command && (
        <>
          <p className="mt-1 text-[13px] text-ink2">{t("update.systemNote")}</p>
          <div className="mt-1.5 flex items-center gap-2">
            <code className="selectable min-w-0 flex-1 overflow-x-auto rounded-md bg-canvas px-2 py-1.5 font-mono text-xs whitespace-nowrap">{command}</code>
            <Button
              className="h-7 flex-none"
              onClick={() => {
                void navigator.clipboard.writeText(command).then(() => setCopied(true));
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? t("update.copied") : t("common.copy")}
            </Button>
          </div>
          <p className="mt-1.5 text-xs text-ink3">{t("update.restartNote")}</p>
        </>
      )}
      {(update.how === "download" || (update.how === "system" && !command)) && (
        <Button className="mt-2" onClick={() => void backend.openLink(`${WEBSITE}/download/`)}>
          {t("update.downloadPage")}
        </Button>
      )}
      <Problem text={error} />
      {error && update.how === "install" && (
        <Button className="mt-2" onClick={() => void backend.openLink(`${WEBSITE}/download/`)}>
          {t("update.downloadPage")}
        </Button>
      )}
    </div>
  );
}

function About() {
  const t = useT();
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [moveFolder, setMoveFolder] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const [moveError, setMoveError] = useState("");
  useEffect(() => {
    backend
      .appInfo()
      .then(setInfo)
      .catch((e) => console.error("app_info failed", e));
  }, []);
  async function pickFolder() {
    setMoveError("");
    try {
      const picked = await backend.pickDataDir();
      if (picked) setMoveFolder(picked);
    } catch (e) {
      setMoveError(errorText(e));
    }
  }
  async function doMove() {
    if (!moveFolder || moving) return;
    setMoving(true);
    try {
      await backend.moveDataDir(moveFolder);
      // Success restarts the app before this returns.
    } catch (e) {
      setMoveError(errorText(e));
      setMoving(false);
    }
  }
  const row = "flex gap-3 border-b border-edge py-2";
  const name = "w-36 flex-none text-ink2";
  return (
    <>
      <div className="flex items-center gap-4">
        <img src={logo} alt="" className="size-16" />
        <div>
          <div className="text-lg font-semibold">VN Mail</div>
          <div className="text-ink2">{info ? t("about.version", { version: info.version }) : t("about.preview")}</div>
        </div>
      </div>
      <p className="mt-4">{t("about.intro")}</p>
      <Updates version={info?.version ?? ""} />
      <div className="mt-4 text-[13px]">
        <div className={row}>
          <span className={name}>{t("about.licence")}</span>
          <span>
            {t("about.licenceText")}{" "}
            <button type="button" className="text-brand underline" onClick={() => void backend.openLink("https://www.apache.org/licenses/LICENSE-2.0")}>
              {t("about.readLicence")}
            </button>
            {" · "}
            <button type="button" className="text-brand underline" onClick={() => void backend.openLink(REPOSITORY)}>
              {t("onboarding.viewCode")}
            </button>
          </span>
        </div>
        {info && (
          <>
            <div className={row}>
              <span className={name}>{t("about.dataDir")}</span>
              <span className="min-w-0">
                <span className="selectable break-all">{info.dataDir}/vnmail.db</span>
                {moveFolder ? (
                  <span className="mt-2 block text-[13px] text-ink2">
                    {t("about.dataDirMoveConfirm", { folder: moveFolder })}
                    <span className="mt-2 flex flex-wrap gap-2">
                      <Button className="h-8" onClick={() => void doMove()}>
                        {moving ? t("about.dataDirMoving") : t("about.dataDirMove")}
                      </Button>
                      <Button className="h-8" onClick={() => setMoveFolder(null)}>
                        {t("common.cancel")}
                      </Button>
                    </span>
                  </span>
                ) : (
                  <Button className="mt-2 h-8" onClick={() => void pickFolder()}>
                    {t("about.dataDirChange")}
                  </Button>
                )}
              </span>
            </div>
            <div className={row}>
              <span className={name}>{t("about.encryption")}</span>
              <span>{info.cipher ? t("about.encrypted", { version: info.cipher.split(" ")[0] }) : t("about.notEncrypted")}</span>
            </div>
            <div className={row}>
              <span className={name}>{t("about.schemaVersion")}</span>
              <span>{info.schemaVersion}</span>
            </div>
          </>
        )}
        <Problem text={moveError} />
        <div className={row}>
          <span className={name}>{t("about.builtWith")}</span>
          <span>
            {builtWith.map(([label, url], i) => (
              <span key={label}>
                {i > 0 && ", "}
                <button type="button" className="text-brand underline" onClick={() => void backend.openLink(url)}>
                  {label}
                </button>
              </span>
            ))}
          </span>
        </div>
      </div>
      <Button className="mt-4" onClick={() => useStore.getState().setWelcome(true)}>
        {t("about.showWelcome")}
      </Button>
    </>
  );
}

/** Why the project asks for sponsors, and the way to become one. */
function Sponsor() {
  const t = useT();
  return (
    <div className="flex items-start gap-3.5">
      <div className="flex size-10 flex-none items-center justify-center rounded-full bg-danger/10 text-danger">
        <IconHeart size={20} />
      </div>
      <div className="min-w-0">
        <div className="font-semibold">{t("about.freeTitle")}</div>
        <p className="mt-1 text-[13px] text-ink2">
          {t("about.freeText")}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button onClick={() => void backend.openLink(REPOSITORY)}>
            <IconHeart size={16} className="text-danger" /> {t("about.viewGithub")}
          </Button>
          <Button onClick={() => void backend.openLink(DONATE)}>
            <IconCoffee size={16} className="text-brand" /> {t("about.donate")}
          </Button>
        </div>
        <p className="mt-4 text-[13px] text-ink2">
          {t("about.starBefore")}
          <button type="button" className="text-brand underline" onClick={() => void backend.openLink(REPOSITORY)}>
            GitHub
          </button>
          {t("about.starAfter")}
        </p>
      </div>
    </div>
  );
}

const content: Record<SettingsPage, () => React.ReactNode> = {
  accounts: Accounts,
  signatures: Signatures,
  sync: Sync,
  appearance: Appearance,
  privacy: Privacy,
  rules: Rules,
  notifications: Notifications,
  about: About,
  sponsor: Sponsor,
};

export function Settings() {
  const t = useT();
  const page = useStore((s) => s.settingsPage);
  const setDialog = useStore((s) => s.setDialog);
  const close = () => setDialog(null);
  const Page = content[page];
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 p-4" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("common.settings")}
        className="flex h-[560px] max-h-full w-[820px] max-w-full overflow-hidden rounded-[14px] border border-edge bg-card shadow-xl"
        onKeyDown={(e) => e.key === "Escape" && close()}
      >
        <nav className="w-[210px] flex-none bg-canvas px-2 py-4" aria-label={t("settings.sections")}>
          <div className="px-2 pb-3 text-lg font-semibold">{t("common.settings")}</div>
          {pages.map(([id, Icon]) => (
            <button
              key={id}
              type="button"
              aria-current={page === id}
              onClick={() => setDialog("settings", id)}
              className={`flex w-full items-center gap-2 rounded-full px-3 py-1.5 text-left ${page === id ? "bg-sel" : "hover:bg-hover"}`}
            >
              <Icon size={18} className={id === "sponsor" ? "text-danger" : "text-ink2"} />
              <span className={id === "sponsor" ? "text-danger" : undefined}>{t(`settings.page.${id}`)}</span>
            </button>
          ))}
        </nav>
        <div className="min-w-0 flex-1 overflow-y-auto px-6 py-4">
          <div className="mb-3 flex items-center">
            <h2 className="text-base font-semibold">{t(`settings.page.${page}`)}</h2>
            <IconButton label={t("settings.close")} className="ml-auto" onClick={close}>
              <IconX size={20} />
            </IconButton>
          </div>
          <Page />
        </div>
      </div>
    </div>
  );
}
