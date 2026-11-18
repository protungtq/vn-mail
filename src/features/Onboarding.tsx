import {
  IconArrowLeft,
  IconArrowRight,
  IconBrandGoogle,
  IconCheck,
  IconCode,
  IconEyeOff,
  IconHeart,
  IconLock,
  IconMail,
  IconPaperclip,
  IconShieldCheck,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
import logo from "../../src-tauri/icons/128x128@2x.png";
import { backend } from "../backend";
import { REPOSITORY } from "../lib/links";
import { textSizeOptions } from "../lib/font";
import { useT } from "../lib/useT";
import { useStore } from "../store";
import { preferAccountKind } from "./AddAccount";
import { MOD } from "../lib/keys";

const STEPS = ["welcome", "account", "look", "ready"] as const;

/** The filled accent button used only here: the one obvious next step on each screen. */
function Next({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand px-5 text-card hover:opacity-90 disabled:opacity-40">
      {children}
    </button>
  );
}

function Point({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="flex gap-3.5">
      <div className="flex size-10 flex-none items-center justify-center rounded-xl bg-soft text-brand">{icon}</div>
      <div>
        <div className="text-ink">{title}</div>
        <div className="text-ink2">{text}</div>
      </div>
    </div>
  );
}

function Choice<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div>
      <div className="mb-2 text-ink2">{label}</div>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
        {options.map(([v, name]) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={value === v}
            onClick={() => onChange(v)}
            className={`h-9 rounded-full px-4 ${value === v ? "bg-soft text-brand" : "border border-edge text-ink2 hover:bg-hover"}`}
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}

/** A small picture of the app for the right-hand side: three messages, one of them flagged as suspicious. */
function Preview() {
  const t = useT();
  const row = "flex items-center gap-3 rounded-2xl bg-card px-4 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.06)]";
  const avatar = "flex size-9 flex-none items-center justify-center rounded-full text-xs";
  return (
    <div className="flex w-full max-w-[380px] flex-col gap-3" aria-hidden="true">
      <div className={row}>
        <div className={`${avatar} bg-[#1f1f1e] text-white`}>
          <IconMail size={17} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-ink">
            Mona Kane <span className="size-[7px] rounded-full bg-dot" /> <span className="ml-auto text-xs text-brand">9:41</span>
          </div>
          <div className="truncate text-ink2">Event announcement content</div>
        </div>
      </div>
      <div className={`${row} translate-x-6`}>
        <div className={`${avatar} bg-chip text-ink2`}>PS</div>
        <div className="min-w-0 flex-1">
          <div className="text-ink">PayPal Security</div>
          <div className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-warn px-2.5 py-0.5 text-xs text-on-warn">
            <IconShieldCheck size={14} /> {t("warning.senderNotConfirmed")}
          </div>
        </div>
      </div>
      <div className={row}>
        <div className={`${avatar} bg-[#1DB954] text-white`}>
          <IconPaperclip size={17} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-ink">Weekly digest</div>
          <div className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-soft px-2.5 py-0.5 text-xs text-brand">
            <IconEyeOff size={14} /> {t("onboarding.previewTrackers", { count: 2 })}
          </div>
        </div>
      </div>
    </div>
  );
}

/** First-run welcome: what VN Mail is, add an account, pick the look, start. */
export function Onboarding() {
  const t = useT();
  const accounts = useStore((s) => s.accounts);
  const settings = useStore((s) => s.settings);
  const { setSetting, setDialog, setWelcome } = useStore.getState();
  const [step, setStep] = useState(0);
  const had = useState(accounts.length)[0];

  // Adding an account in the dialog moves the welcome on by itself.
  useEffect(() => {
    if (step === 1 && accounts.length > had) setStep(2);
  }, [accounts.length, had, step]);

  const add = (kind: "google" | "imap") => {
    preferAccountKind(kind);
    setDialog("add-account");
  };
  const finish = () => {
    void setSetting("onboarded", "yes");
    setWelcome(false);
  };
  const card = "flex w-full items-center gap-4 rounded-2xl border border-edge px-5 py-4 text-left hover:border-line hover:bg-hover";

  return (
    <div className="absolute inset-0 z-[5] flex bg-card" role="dialog" aria-modal="true" aria-label={t("onboarding.dialogLabel")}>
      <div className="flex min-w-0 flex-1 flex-col px-14 py-10">
        <div className="flex items-center gap-2.5">
          <img src={logo} alt="" className="size-8" />
          <span className="text-lg text-ink">VN Mail</span>
          <button type="button" onClick={finish} className="ml-auto rounded-lg px-3 py-1.5 text-ink3 hover:bg-hover hover:text-ink">
            {t("onboarding.skip")}
          </button>
        </div>

        {/* In a short window the page scrolls; the buttons below stay in view. */}
        <div className="-mr-4 flex min-h-0 flex-1 flex-col overflow-y-auto py-6 pr-4">
          <div className="my-auto max-w-[460px]">
            {step === 0 && (
              <>
                <h1 className="text-[34px] leading-tight text-ink">{t("onboarding.title1")}</h1>
                <p className="mt-3 text-[17px] text-ink2">{t("onboarding.intro1")}</p>
                <div className="mt-8 flex flex-col gap-5">
                  <Point icon={<IconLock size={20} />} title={t("onboarding.privateTitle")} text={t("onboarding.privateText")} />
                  <Point icon={<IconShieldCheck size={20} />} title={t("onboarding.watchTitle")} text={t("onboarding.watchText")} />
                  <Point icon={<IconMail size={20} />} title={t("onboarding.allMailTitle")} text={t("onboarding.allMailText")} />
                  <div className="flex gap-3.5">
                    <div className="flex size-10 flex-none items-center justify-center rounded-xl bg-soft text-brand">
                      <IconCode size={20} />
                    </div>
                    <div>
                      <div className="text-ink">{t("onboarding.freeTitle")}</div>
                      <div className="text-ink2">
                        {t("onboarding.freeText")}{" "}
                        <button type="button" className="text-brand underline" onClick={() => void backend.openLink(REPOSITORY)}>
                          {t("onboarding.viewCode")}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <h1 className="text-[30px] leading-tight text-ink">{t("onboarding.title2")}</h1>
                <p className="mt-3 text-ink2">{t("onboarding.accountNote")}</p>
                {accounts.length > 0 && (
                  <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-soft px-3 py-1 text-brand">
                    <IconCheck size={16} /> {accounts.length === 1 ? t("onboarding.addedOne", { address: accounts[0].address }) : t("onboarding.addedMany", { count: accounts.length })}
                  </p>
                )}
                <div className="mt-6 flex flex-col gap-3">
                  <button type="button" className={card} onClick={() => add("google")}>
                    <span className="flex size-11 flex-none items-center justify-center rounded-xl bg-soft text-brand">
                      <IconBrandGoogle size={22} />
                    </span>
                    <span>
                      <span className="block text-ink">Gmail</span>
                      <span className="block text-ink2">{t("onboarding.gmailWay")}</span>
                    </span>
                    <IconArrowRight size={18} className="ml-auto text-ink3" />
                  </button>
                  <button type="button" className={card} onClick={() => add("imap")}>
                    <span className="flex size-11 flex-none items-center justify-center rounded-xl bg-soft text-brand">
                      <IconMail size={22} />
                    </span>
                    <span>
                      <span className="block text-ink">{t("onboarding.otherAccount")}</span>
                      <span className="block text-ink2">{t("onboarding.otherWay")}</span>
                    </span>
                    <IconArrowRight size={18} className="ml-auto text-ink3" />
                  </button>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <h1 className="text-[30px] leading-tight text-ink">{t("onboarding.title3")}</h1>
                <p className="mt-3 text-ink2">{t("onboarding.changeLater")}</p>
                <div className="mt-7 flex flex-col gap-6">
                  <Choice
                    label={t("settings.theme")}
                    value={(settings.theme ?? "system") as "system" | "light" | "dark"}
                    onChange={(v) => void setSetting("theme", v)}
                    options={[
                      ["system", t("onboarding.matchComputer")],
                      ["light", t("settings.themeLight")],
                      ["dark", t("settings.themeDark")],
                    ]}
                  />
                  <Choice label={t("settings.textSize")} value={settings.text_size ?? "15"} onChange={(v) => void setSetting("text_size", v)} options={textSizeOptions(t)} />
                  <Choice
                    label={t("onboarding.timeLabel")}
                    value={settings.time_format === "12" ? "12" : "24"}
                    onChange={(v) => void setSetting("time_format", v)}
                    options={[
                      ["24", "15:05"],
                      ["12", "3:05 PM"],
                    ]}
                  />
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <div className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-soft text-brand">
                  <IconCheck size={30} />
                </div>
                <h1 className="text-[30px] leading-tight text-ink">{t("onboarding.title4")}</h1>
                <p className="mt-3 text-ink2">
                  {accounts.length > 0 ? t("onboarding.downloading") : t("onboarding.addLater")}
                </p>
                <div className="mt-7 flex flex-col gap-2.5 text-ink2">
                  {[
                    [`${MOD} K`, t("onboarding.shortcutSearch")],
                    [`${MOD} N`, t("onboarding.shortcutNew")],
                    [t("onboarding.rightClick"), t("onboarding.shortcutMenu")],
                  ].map(([keys, what]) => (
                    <div key={keys} className="flex items-center gap-3">
                      <kbd className="min-w-[92px] rounded-lg border border-edge bg-canvas px-2.5 py-1 text-center text-[13px] text-ink">{keys}</kbd>
                      {what}
                    </div>
                  ))}
                </div>
                <div className="mt-7 flex items-start gap-3.5 rounded-2xl border border-edge px-4 py-4">
                  <div className="flex size-10 flex-none items-center justify-center rounded-full bg-danger/10 text-danger">
                    <IconHeart size={20} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-ink">{t("about.freeTitle")}</div>
                    <div className="mt-1 text-[13px] text-ink2">
                      {t("about.freeText")}
                    </div>
                    <button
                      type="button"
                      onClick={() => void backend.openLink(REPOSITORY)}
                      className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg border border-edge px-3.5 text-[14px] text-ink hover:bg-hover"
                    >
                      <IconHeart size={16} className="text-danger" /> {t("about.viewGithub")}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-none items-center gap-4">
          {step > 0 && (
            <button type="button" onClick={() => setStep(step - 1)} className="inline-flex h-11 items-center gap-2 rounded-xl px-3 text-ink2 hover:bg-hover">
              <IconArrowLeft size={18} /> {t("onboarding.back")}
            </button>
          )}
          {step === 0 && (
            <Next onClick={() => setStep(1)}>
              {t("onboarding.getStarted")} <IconArrowRight size={18} />
            </Next>
          )}
          {step === 1 &&
            (accounts.length > 0 ? (
              <Next onClick={() => setStep(2)}>
                {t("onboarding.continue")} <IconArrowRight size={18} />
              </Next>
            ) : (
              <button type="button" onClick={() => setStep(2)} className="h-11 rounded-xl px-3 text-ink2 hover:bg-hover">
                {t("onboarding.later")}
              </button>
            ))}
          {step === 2 && (
            <Next onClick={() => setStep(3)}>
              {t("onboarding.continue")} <IconArrowRight size={18} />
            </Next>
          )}
          {step === 3 && <Next onClick={finish}>{t("onboarding.openInbox")}</Next>}
          <div className="ml-auto flex items-center gap-2" aria-label={t("onboarding.stepLabel", { step: step + 1, total: STEPS.length, name: t(`onboarding.step.${STEPS[step]}`) })}>
            {STEPS.map((name, i) => (
              <span key={name} className={`h-1.5 rounded-full ${i === step ? "w-6 bg-brand" : "w-1.5 bg-edge"}`} />
            ))}
          </div>
        </div>
      </div>

      <div className="hidden w-[44%] max-w-[560px] flex-none items-center justify-center bg-soft px-10 lg:flex">
        <Preview />
      </div>
    </div>
  );
}
