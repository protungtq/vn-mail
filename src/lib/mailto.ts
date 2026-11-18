/**
 * `mailto:` links found in mail open VN Mail's own composer, never another program.
 *
 * The link is written by the sender, so only the parts a person can see and change
 * before sending are taken: who it goes to, who is copied, the subject and the text.
 * Everything else (`bcc`, `attach`, `X-Mozilla-Attach`, extra headers) is dropped:
 * some mail programs have attached local files when a link asked them to.
 */

export interface MailtoFields {
  to: string;
  cc: string;
  subject: string;
  /** Plain text, as written in the link. */
  body: string;
}

const LIMIT = { address: 1000, subject: 300, body: 5000 };

function decode(part: string): string {
  try {
    return decodeURIComponent(part.replace(/\+/g, "%2B"));
  } catch {
    return part;
  }
}

/** Addresses, one line, no characters that could start a new header. */
function addresses(parts: string[]): string {
  return parts
    .flatMap((p) => p.split(","))
    .map((a) => a.replace(/[\r\n\t<>"]/g, "").trim())
    .filter((a) => /^[^\s@]+@[^\s@]+$/.test(a))
    .join(", ")
    .slice(0, LIMIT.address);
}

/** The fields of a `mailto:` link, or null when it is not one. */
export function parseMailto(url: string): MailtoFields | null {
  const text = url.trim();
  if (!/^mailto:/i.test(text)) return null;
  const rest = text.slice("mailto:".length);
  const [path, query = ""] = rest.split(/\?(.*)/s, 2);
  const to = [decode(path)];
  const cc: string[] = [];
  let subject = "";
  let body = "";
  for (const pair of query.split("&")) {
    if (!pair) continue;
    const [rawKey, rawValue = ""] = pair.split(/=(.*)/s, 2);
    const value = decode(rawValue);
    switch (decode(rawKey).toLowerCase()) {
      case "to":
        to.push(value);
        break;
      case "cc":
        cc.push(value);
        break;
      case "subject":
        subject ||= value.replace(/[\r\n]+/g, " ").trim().slice(0, LIMIT.subject);
        break;
      case "body":
        body ||= value.replace(/\r\n?/g, "\n").slice(0, LIMIT.body);
        break;
      // Anything else is ignored on purpose; see the comment at the top.
    }
  }
  return { to: addresses(to), cc: addresses(cc), subject, body };
}
