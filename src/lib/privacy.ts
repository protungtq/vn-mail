import { getDomain, getDomainWithoutSuffix, getPublicSuffix } from "tldts";
import { domainOf } from "./brands";
import { t } from "./i18n";
import { impersonated, skeleton } from "./impersonated";

/**
 * Checks that protect the reader. Everything here runs on this computer on the
 * message itself; nothing is looked up online.
 */

/**
 * The part of a host name that someone registered: "mail.shop.co.uk" gives "shop.co.uk".
 * It follows the Public Suffix List (bundled with the app, nothing is looked up), with
 * its private part too, so sites on shared hosting stay apart: "paypal.github.io" and
 * "evil.github.io" are two different sites.
 */
export function registrable(host: string): string {
  const name = host.toLowerCase().replace(/\.$/, "");
  return getDomain(name, { allowPrivateDomains: true }) ?? name;
}

/** The registered name without its ending: "mail.paypal.co.uk" gives "paypal". */
function ownName(host: string): string {
  const name = host.toLowerCase().replace(/\.$/, "");
  return getDomainWithoutSuffix(name, { allowPrivateDomains: true }) ?? name;
}

/**
 * The sender checks of a message (`MessageSummary.auth`, such as
 * "id=mx.example.com;spf=pass;dkim=pass;dmarc=fail"), but only when they were
 * made by `server`, the mail server this account trusts. Results naming any
 * other server may have been written by the sender, so they count for nothing.
 */
function checks(auth: string | null | undefined, server: string | null | undefined): Record<string, string> | null {
  if (!auth || !server) return null;
  const result = Object.fromEntries(auth.split(";").map((part) => part.split("=") as [string, string]));
  return result.id === server ? result : null;
}

/** True when the account's mail server confirmed the sender: DMARC passed, or without a DMARC verdict the DKIM signature did. */
export function senderConfirmed(auth: string | null | undefined, server: string | null | undefined): boolean {
  const result = checks(auth, server);
  if (!result) return false;
  return result.dmarc !== undefined ? result.dmarc === "pass" : result.dkim === "pass";
}

/** A sentence when the account's mail server checked the sender and the checks failed, else null. */
export function authProblem(auth: string | null | undefined, server: string | null | undefined): string | null {
  const result = checks(auth, server);
  if (!result) return null;
  const failed = (["dmarc", "dkim", "spf"] as const).filter((method) => result[method] === "fail").map((m) => m.toUpperCase());
  // DMARC is the verdict. Without one, a failed signature or a refused sending server counts.
  if (result.dmarc === "fail" || (result.dmarc === undefined && failed.length > 0)) {
    const and = t("privacy.listAnd");
    const joined = failed.length > 2 ? `${failed.slice(0, -1).join(", ")}${and}${failed[failed.length - 1]}` : failed.join(and);
    return t("privacy.authFailed", { failed: joined });
  }
  return null;
}

/**
 * A sentence when the account's mail server said nothing usable about the
 * sender, else null. While the trusted server is still being learned there
 * is nothing to judge by, so that case stays silent too.
 */
export function authMissing(auth: string | null | undefined, server: string | null | undefined): string | null {
  if (!server) return null;
  if (checks(auth, server)) return null;
  return t("privacy.authMissing");
}

/** Letters of other alphabets that look like Latin ones: Cyrillic "а", Greek "ο" and so on. */
const FOREIGN_LETTER = /[\u0370-\u03ff\u0400-\u052f]/;

/** Decode one "xn--" label of an internet name (RFC 3492). Returns the label unchanged if it is not valid. */
function fromPunycode(label: string): string {
  if (!label.toLowerCase().startsWith("xn--")) return label;
  const input = label.slice(4);
  const split = input.lastIndexOf("-");
  const output = split > 0 ? [...input.slice(0, split)] : [];
  let [n, i, bias] = [128, 0, 72];
  for (let at = split > 0 ? split + 1 : 0; at < input.length; ) {
    const start = i;
    for (let weight = 1, k = 36; ; k += 36) {
      const code = input.charCodeAt(at++);
      const digit = code - 48 < 10 ? code - 22 : code - 65 < 26 ? code - 65 : code - 97 < 26 ? code - 97 : 36;
      if (digit >= 36 || Number.isNaN(code)) return label;
      i += digit * weight;
      const t = k <= bias ? 1 : k >= bias + 26 ? 26 : k - bias;
      if (digit < t) break;
      weight *= 36 - t;
    }
    const length = output.length + 1;
    let delta = start === 0 ? Math.floor((i - start) / 700) : (i - start) >> 1;
    delta += Math.floor(delta / length);
    let k = 0;
    for (; delta > 455; k += 36) delta = Math.floor(delta / 35);
    bias = k + Math.floor((36 * delta) / (delta + 38));
    n += Math.floor(i / length);
    i %= length;
    output.splice(i++, 0, String.fromCodePoint(n));
  }
  return output.join("");
}

/** An internet name as people would read it: "xn--pypal-4ve.com" becomes "pаypal.com" (with a Cyrillic а). */
export function readableHost(host: string): string {
  return host.split(".").map(fromPunycode).join(".");
}

/**
 * True for a name that mixes in letters of another alphabet under an ordinary
 * ending such as .com: the classic way to imitate a well-known address.
 */
export function lookAlike(host: string): boolean {
  const labels = readableHost(host).split(".");
  const ending = labels[labels.length - 1] ?? "";
  return /^[a-z]+$/i.test(ending) && labels.slice(0, -1).some((label) => FOREIGN_LETTER.test(label));
}

/** Words that often stand next to a company's name in a sender name, without changing who it claims to be. */
const GENERIC = new Set(
  (
    "support team security service services billing account accounts customer customers care help helpdesk desk info notification notifications " +
    "news newsletter alerts alert no-reply noreply no reply payments payment rewards store shop online official mail email inc llc ltd corp " +
    "corporation company co the your my from via by at of and for department dept center centre admin administrator verification verify " +
    "update updates message messages security-team protection fraud prevention member members services-team id login sign-in signin secure " +
    "delivery deliveries shipping express parcel parcels order orders invoice invoices"
  ).split(" "),
);

/** The words of a name, split on spaces and punctuation, so "PayPal-Support" and "PayPal Inc." are two words. */
function wordsOf(text: string): string[] {
  return text.split(/[^\p{L}\p{N}$|@]+/u).filter(Boolean);
}

/**
 * The companies, worked out once: the words of each name as they look, and each domain
 * with its registered name. Without a known domain there is nothing to compare an
 * address with, so such names are left out, as are names of one or two letters.
 */
const COMPANIES = impersonated
  .filter((b) => b.title.length >= 3 && b.domains.length > 0)
  .map((b) => ({ ...b, words: wordsOf(b.title).map(skeleton), names: b.domains.map((d) => ({ domain: d, name: ownName(d), drawn: skeleton(ownName(d)) })) }));

/** The company a sender name claims to be, when its address does not belong to that company. */
function claimedBrand(name: string, domain: string): string | null {
  const words = wordsOf(name);
  const plain = words.map((w) => w.toLowerCase());
  const drawn = words.map(skeleton);
  for (const brand of COMPANIES) {
    const title = brand.words;
    if (title.length === 0 || title.length > words.length) continue;
    // The name of the company anywhere in the sender name ("Service PayPal"), read as it looks ("PayPaI").
    for (let at = 0; at + title.length <= words.length; at++) {
      if (!title.every((w, i) => drawn[at + i] === w)) continue;
      const rest = plain.filter((_, i) => i < at || i >= at + title.length);
      if (!rest.every((w) => GENERIC.has(w))) continue;
      // The company's own domains, including country ones that are not listed (paypal.be),
      // but not the same name under any other ending (paypal.xyz).
      const own = brand.names.some((d) => domain === d.domain || domain.endsWith(`.${d.domain}`) || (d.name === ownName(domain) && countryEnding(domain)));
      if (!own) return brand.title;
    }
  }
  return null;
}

/** True for a country ending such as ".be" or ".co.uk". */
function countryEnding(domain: string): boolean {
  return /^(?:(?:co|com|org|net|ac|gov)\.)?[a-z]{2}$/.test(getPublicSuffix(domain) ?? "");
}

/** A company domain that `domain` imitates with look-alike letters ("paypa1.com", "rnicrosoft.com"), or null. */
function imitatedDomain(domain: string): string | null {
  const name = ownName(domain);
  const drawn = skeleton(name);
  if (drawn.length < 4) return null;
  for (const brand of COMPANIES) {
    for (const d of brand.names) {
      if (d.name !== name && d.drawn === drawn) return d.domain;
    }
  }
  return null;
}

/**
 * A sender name that claims to be someone the address is not: it shows another
 * email address, or it is the name of a well-known company the address does not belong to.
 */
export function nameProblem(name: string, address: string): string | null {
  const domain = registrable(domainOf(address));
  if (!domain.includes(".")) return null;
  if (lookAlike(domainOf(address))) {
    return t("privacy.lookAlikeAddress", { address: readableHost(domainOf(address)) });
  }
  const imitated = imitatedDomain(domain);
  if (imitated) {
    return t("privacy.imitatedDomain", { domain, imitated });
  }
  const shown = name.match(/[\w.+-]+@([a-z0-9-]+\.)+[a-z]{2,}/i)?.[0];
  if (shown && registrable(domainOf(shown)) !== domain) {
    return t("privacy.shownAddress", { shown, address });
  }
  const brand = claimedBrand(name, domain);
  if (brand) return t("privacy.claimedBrand", { brand, address });
  return null;
}

const TRACKING_PARAMETER =
  /^(utm_\w+|fbclid|gclid|gclsrc|dclid|gbraid|wbraid|msclkid|mc_cid|mc_eid|_hsenc|_hsmi|__hs\w+|hsctatracking|igshid|mkt_tok|oly_enc_id|oly_anon_id|vero_id|vero_conv|yclid|twclid|ttclid|li_fat_id|s_cid|_openstat|mkwid|pk_\w+|piwik_\w+|ml_subscriber(_hash)?|wickedid|ck_subscriber_id|_ga|_gl|trk\w*)$/i;

/** Addresses that exist only to report that a message was opened. */
const TRACKER_ADDRESS =
  /\/(open|track(ing)?|pixel|beacon|wf\/open|o\.gif|t\.gif|trk|e\/o)([/.?]|$)|list-manage\.com\/track|google-analytics\.com|doubleclick\.net|facebook\.com\/tr|sendgrid\.net\/wf|mailgun\.\w+\/o\/|awstrack\.me|hubspot\w*\.\w+\/e\d|klclick|mandrillapp\.com\/track|\.mcsv\.net\/|sparkpostmail|exct\.net\/open|cmail\d+\.com\/t\//i;

const INVISIBLE = /(^|;)\s*(display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0(\.0+)?\s*(;|$)|(max-)?(width|height)\s*:\s*[01](px)?\s*(!important)?\s*(;|$))/i;

export interface Cleaned {
  html: string;
  /** Hidden images removed because they report when the message is opened. */
  pixels: number;
  /** Links from which tracking parameters were removed. */
  links: number;
  /** Links whose text names one site while they lead to another. */
  mismatches: { shown: string; goes: string }[];
  /** Sites linked to whose names imitate ordinary letters with foreign ones. */
  lookAlikes: string[];
}

function tiny(img: Element): boolean {
  const size = (name: string) => {
    const value = img.getAttribute(name);
    return value !== null && /^\s*[0-2]\s*(px)?\s*$/.test(value);
  };
  return size("width") || size("height") || INVISIBLE.test(img.getAttribute("style") ?? "");
}

/**
 * Remove tracking from mail HTML and find misleading links.
 * `blockTrackers` false leaves the HTML as it is and only inspects the links.
 */
export function cleanMail(html: string, blockTrackers = true): Cleaned {
  // Inspect mail in an inert fragment before the reader applies its frame policy.
  const template = document.createElement("template");
  template.innerHTML = html;
  const doc = template.content;
  let pixels = 0;
  let links = 0;
  const mismatches: Cleaned["mismatches"] = [];
  const lookAlikes: string[] = [];
  const mark = (link: Element) => link.setAttribute("style", `${link.getAttribute("style") ?? ""};text-decoration:none;border-bottom:2px solid #e0a23a`);

  if (blockTrackers) {
    for (const img of Array.from(doc.querySelectorAll("img"))) {
      const src = img.getAttribute("src") ?? "";
      if (/^https?:/i.test(src) && (tiny(img) || TRACKER_ADDRESS.test(src))) {
        img.remove();
        pixels += 1;
      }
    }
  }

  for (const link of Array.from(doc.querySelectorAll("a[href]"))) {
    let target: URL;
    try {
      target = new URL(link.getAttribute("href") ?? "");
    } catch {
      continue;
    }
    if (!/^https?:$/.test(target.protocol)) continue;
    if (blockTrackers) {
      const tracking = [...target.searchParams.keys()].filter((key) => TRACKING_PARAMETER.test(key));
      if (tracking.length > 0) {
        tracking.forEach((key) => target.searchParams.delete(key));
        link.setAttribute("href", target.toString());
        links += 1;
      }
    }
    // Hovering shows where the link really goes.
    link.setAttribute("title", target.toString());
    const text = (link.textContent ?? "").trim();
    const shown = /^(https?:\/\/)?((?:[a-z0-9-]+\.)+[a-z]{2,})(?:[/?#]\S*)?$/i.exec(text)?.[2];
    if (shown && registrable(shown) !== registrable(target.hostname) && !mismatches.some((m) => m.shown === shown)) {
      mismatches.push({ shown: shown.toLowerCase(), goes: target.hostname });
      mark(link);
    }
    if (lookAlike(target.hostname)) {
      const name = readableHost(target.hostname);
      if (!lookAlikes.includes(name)) lookAlikes.push(name);
      mark(link);
    }
  }
  return { html: template.innerHTML, pixels, links, mismatches, lookAlikes };
}
