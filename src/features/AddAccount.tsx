import { IconX } from "@tabler/icons-react";
import { useState } from "react";
import { backend, errorText } from "../backend";
import { Button, Chip, IconButton, fieldBox, fieldCaption } from "../components/ui";
import { useT } from "../lib/useT";
import { useStore } from "../store";
import type { Security, ServerSettings } from "../types";

type Kind = "imap" | "google";

const ports: Record<"imap" | "smtp", Record<Security, number>> = {
  imap: { tls: 993, starttls: 143, none: 143 },
  smtp: { tls: 465, starttls: 587, none: 25 },
};

/** The usual server name for an address, such as imap.<domain>. */
export function guessHost(address: string, prefix = "imap"): string {
  const domain = address.trim().split("@")[1] ?? "";
  return domain ? `${prefix}.${domain.toLowerCase()}` : "";
}

interface Server {
  host: string;
  port: string;
  security: Security;
  /** True once the user has typed a host, so we stop guessing it. */
  edited: boolean;
}

function ServerRow({ id, title, optional, protocol, value, onChange }: { id: string; title: string; optional?: boolean; protocol: "imap" | "smtp"; value: Server; onChange: (s: Server) => void }) {
  const t = useT();
  return (
    <>
      <label className={`${fieldCaption} mt-3`} htmlFor={id}>
        {title}
        {optional && <span className="text-ink3"> {t("account.optionalSend")}</span>}
      </label>
      <div className="grid grid-cols-[1fr_80px_150px] gap-2">
        <input id={id} value={value.host} placeholder={`${protocol}.company.com`} className={fieldBox} autoComplete="off" onChange={(e) => onChange({ ...value, host: e.target.value, edited: true })} />
        <input aria-label={t("account.portLabel", { title })} inputMode="numeric" value={value.port} onChange={(e) => onChange({ ...value, port: e.target.value })} className={fieldBox} />
        <select
          aria-label={t("account.encryptionLabel", { title })}
          value={value.security}
          className={fieldBox}
          onChange={(e) => {
            const next = e.target.value as Security;
            // Follow the standard port unless the user typed their own.
            const port = Number(value.port) === ports[protocol][value.security] ? String(ports[protocol][next]) : value.port;
            onChange({ ...value, security: next, port });
          }}
        >
          <option value="tls">TLS</option>
          <option value="starttls">STARTTLS</option>
          <option value="none">{t("account.noEncryption")}</option>
        </select>
      </div>
    </>
  );
}

function toSettings(server: Server, username: string): ServerSettings {
  return { host: server.host.trim(), port: Number(server.port), security: server.security, username };
}

const validPort = (s: Server) => Number.isInteger(Number(s.port)) && Number(s.port) >= 1 && Number(s.port) <= 65535;

/**
 * What was typed, kept while VN Mail runs so that closing the dialog after a
 * failed attempt does not lose it. Kept in memory only, and forgotten once the account is added.
 */
let remembered: { kind: Kind; address: string; name: string; password: string; incoming: Server; outgoing: Server } | null = null;

let preferred: Kind | null = null;

/** Choose which tab the dialog opens on next time (used by the welcome screen). */
export function preferAccountKind(kind: Kind) {
  preferred = kind;
}

/** Add a Google or IMAP account. */
export function AddAccount() {
  const t = useT();
  const setDialog = useStore((s) => s.setDialog);
  const refresh = useStore((s) => s.refresh);
  const hasGoogleClient = useStore((s) => (s.settings.google_client_id ?? "").trim() !== "");
  const [kind, setKind] = useState<Kind>(() => {
    const start = preferred ?? remembered?.kind ?? "imap";
    preferred = null;
    return start;
  });
  const [address, setAddress] = useState(remembered?.address ?? "");
  const [name, setName] = useState(remembered?.name ?? "");
  const [password, setPassword] = useState(remembered?.password ?? "");
  const [incoming, setIncoming] = useState<Server>(remembered?.incoming ?? { host: "", port: "993", security: "tls", edited: false });
  const [outgoing, setOutgoing] = useState<Server>(remembered?.outgoing ?? { host: "", port: "465", security: "tls", edited: false });
  remembered = { kind, address, name, password, incoming, outgoing };
  // Gmail has two ways in. An app password works for everyone; Google sign-in needs the user's own client ID.
  const [googleWay, setGoogleWay] = useState<"password" | "oauth">("password");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const oauth = kind === "google" && googleWay === "oauth";

  const close = () => setDialog(null);

  function changeKind(next: Kind) {
    setKind(next);
    setError("");
  }

  function changeAddress(value: string) {
    setAddress(value);
    if (!incoming.edited) setIncoming((s) => ({ ...s, host: guessHost(value, "imap") }));
    if (!outgoing.edited) setOutgoing((s) => ({ ...s, host: guessHost(value, "smtp") }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const user = address.trim();
    if (!user.includes("@")) return setError(t("account.errAddress"));
    if (kind === "google" && !oauth && !password.trim()) return setError(t("account.errAppPassword"));
    if (kind !== "google") {
      if (!password) return setError(t("account.errPassword"));
      if (!incoming.host.trim()) return setError(t("account.errIncoming"));
      if (!validPort(incoming) || (outgoing.host.trim() && !validPort(outgoing))) return setError(t("account.errPort"));
    }
    setError("");
    setBusy(true);
    try {
      if (oauth) {
        await backend.googleSignIn(user, name.trim());
      } else if (kind === "google") {
        // Google shows app passwords in groups of four with spaces; the servers want them without.
        const gmail = (host: string, port: number): ServerSettings => ({ host, port, security: "tls", username: user });
        await backend.addAccount({
          address: user,
          displayName: name.trim(),
          password: password.replace(/\s+/g, ""),
          imap: gmail("imap.gmail.com", 993),
          smtp: gmail("smtp.gmail.com", 465),
        });
      } else {
        await backend.addAccount({
          address: user,
          displayName: name.trim(),
          password,
          imap: toSettings(incoming, user),
          smtp: outgoing.host.trim() ? toSettings(outgoing, user) : null,
        });
      }
      remembered = null;
      await refresh();
      close();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  const insecure = kind !== "google" && (incoming.security === "none" || (outgoing.host.trim() !== "" && outgoing.security === "none"));
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 p-4" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <form
        onSubmit={(e) => void submit(e)}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-account-title"
        className="max-h-full w-[460px] max-w-full overflow-y-auto rounded-[14px] border border-edge bg-card p-5 shadow-xl"
        onKeyDown={(e) => e.key === "Escape" && close()}
      >
        <div className="mb-3 flex items-center">
          <h2 id="add-account-title" className="text-lg font-semibold">
            {t("accounts.add")}
          </h2>
          <IconButton label={t("common.close")} className="ml-auto" onClick={close}>
            <IconX size={20} />
          </IconButton>
        </div>

        <div className="mb-3 flex gap-2" role="radiogroup" aria-label={t("account.typeLabel")}>
          <Chip on={kind === "google"} onClick={() => changeKind("google")}>
            Google
          </Chip>
          <Chip on={kind === "imap"} onClick={() => changeKind("imap")}>
            IMAP
          </Chip>
        </div>

        <label className={fieldCaption} htmlFor="aa-address">
          {t("account.emailAddress")}
        </label>
        <input id="aa-address" type="email" autoFocus autoComplete="off" value={address} placeholder="name@company.com" className={fieldBox} onChange={(e) => changeAddress(e.target.value)} />

        <div className={`mt-3 grid gap-3 ${kind === "google" ? "" : "grid-cols-2"}`}>
          {/* Gmail's password field sits below its instructions instead. */}
          <div>
            <label className={fieldCaption} htmlFor="aa-name">
              {t("account.yourName")} <span className="text-ink3">{t("common.optional")}</span>
            </label>
            <input id="aa-name" value={name} onChange={(e) => setName(e.target.value)} className={fieldBox} autoComplete="off" />
          </div>
          {kind !== "google" && (
            <div>
              <label className={fieldCaption} htmlFor="aa-password">
                {t("account.password")}
              </label>
              <input id="aa-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={fieldBox} autoComplete="off" />
            </div>
          )}
        </div>

        {kind === "google" && !oauth && (
          <>
            <div className="mt-3 rounded-[10px] bg-canvas px-3.5 py-3 text-[13px] text-ink2">
              <div className="mb-1.5 text-ink">{t("account.gmailAppPasswordTitle")}</div>
              <ol className="list-decimal space-y-1 pl-5">
                <li>{t("account.gmailStep1")}</li>
                <li>
                  {t("account.gmailStep2")}{" "}
                  <button type="button" className="text-brand underline" onClick={() => void backend.openLink("https://myaccount.google.com/apppasswords")}>
                    {t("account.openAppPasswords")}
                  </button>
                </li>
                <li>{t("account.gmailStep3")}</li>
              </ol>
            </div>
            <label className={`${fieldCaption} mt-3`} htmlFor="aa-app-password">
              {t("account.appPassword")}
            </label>
            <input id="aa-app-password" type="password" value={password} placeholder="abcd efgh ijkl mnop" onChange={(e) => setPassword(e.target.value)} className={fieldBox} autoComplete="off" />
            <p className="mt-2 text-xs text-ink3">
              {t("account.storedNote")}{" "}
              <button type="button" className="underline hover:text-ink" onClick={() => (setGoogleWay("oauth"), setError(""))}>
                {t("account.advancedOauth")}
              </button>
            </p>
          </>
        )}
        {oauth && (
          <p className="mt-3 text-[13px] text-ink2">
            {t("account.oauthIntro")}
            {hasGoogleClient ? "." : t("account.oauthEnteredFirst")}
            {!hasGoogleClient && (
              <button type="button" className="text-brand underline" onClick={() => setDialog("settings", "accounts")}>
                {t("common.settings")}
              </button>
            )}
            {!hasGoogleClient && "."}{" "}
            <button type="button" className="text-brand underline" onClick={() => (setGoogleWay("password"), setError(""))}>
              {t("account.useAppPassword")}
            </button>
          </p>
        )}
        {kind !== "google" && (
          <>
            <ServerRow id="aa-in" title={t("account.incomingServer")} protocol="imap" value={incoming} onChange={setIncoming} />
            <ServerRow id="aa-out" title={t("account.outgoingServer")} optional protocol="smtp" value={outgoing} onChange={setOutgoing} />
            {insecure && <p className="mt-2 text-xs text-danger">{t("account.insecureWarning")}</p>}
            <p className="mt-3 text-xs text-ink3">
              {t("account.passwordStored")}
            </p>
          </>
        )}

        {error && (
          <p className="selectable mt-3 rounded-[10px] bg-canvas px-3 py-2 text-[13px] text-danger" role="alert">
            {error}
          </p>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <Button onClick={close}>{t("common.cancel")}</Button>
          <Button variant="primary" type="submit">
            {busy ? (oauth ? t("account.waitingBrowser") : t("account.checking")) : oauth ? t("account.signInGoogle") : t("accounts.add")}
          </Button>
        </div>
      </form>
    </div>
  );
}
