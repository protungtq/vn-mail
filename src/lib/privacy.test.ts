// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { brandFor } from "./brands";
import { authMissing, authProblem, cleanMail, lookAlike, nameProblem, readableHost, registrable, senderConfirmed } from "./privacy";

describe("registrable", () => {
  it("finds the registered part of a host", () => {
    expect(registrable("mail.google.com")).toBe("google.com");
    expect(registrable("news.shop.co.uk")).toBe("shop.co.uk");
    expect(registrable("example.org")).toBe("example.org");
  });
});

describe("brandFor", () => {
  it("matches a company's own domain and its subdomains", () => {
    expect(brandFor("no-reply@accounts.google.com")?.title).toBe("Google");
    expect(brandFor("service@paypal.co.uk")?.title).toBe("PayPal");
  });
  it("never matches a look-alike or a personal address", () => {
    expect(brandFor("service@paypal.com.evil.example")).toBeUndefined();
    expect(brandFor("service@paypa1.com")).toBeUndefined();
    expect(brandFor("someone@gmail.com")).toBeUndefined();
  });
});

const MX = "mx.example.com";
const by = (results: string, server = MX) => `id=${server};${results}`;

describe("authProblem", () => {
  it("is silent when the checks pass or were not made", () => {
    expect(authProblem(by("spf=pass;dkim=pass;dmarc=pass"), MX)).toBeNull();
    expect(authProblem("", MX)).toBeNull();
    expect(authProblem(null, MX)).toBeNull();
  });
  it("trusts a passing DMARC over a failed part", () => {
    expect(authProblem(by("spf=fail;dkim=pass;dmarc=pass"), MX)).toBeNull();
  });
  it("warns when DMARC fails, or a part fails without DMARC", () => {
    expect(authProblem(by("spf=pass;dkim=fail;dmarc=fail"), MX)).toContain("DMARC and DKIM failed");
    expect(authProblem(by("spf=fail"), MX)).toContain("SPF failed");
    expect(authProblem(by("spf=softfail"), MX)).toBeNull();
  });
  it("ignores results that our own mail server did not write", () => {
    expect(authProblem(by("dmarc=fail", "other.example"), MX)).toBeNull();
    expect(authProblem(by("dmarc=fail"), null)).toBeNull();
  });
});

describe("authMissing", () => {
  it("is silent when the checks exist, or the server is still being learned", () => {
    expect(authMissing(by("spf=pass;dkim=pass;dmarc=pass"), MX)).toBeNull();
    expect(authMissing(by("dmarc=pass"), null)).toBeNull();
  });
  it("warns when the server said nothing usable about the sender", () => {
    expect(authMissing("", MX)).toContain("no information");
    expect(authMissing(null, MX)).toContain("no information");
    expect(authMissing(by("dmarc=pass", "other.example"), MX)).toContain("no information");
  });
});

describe("senderConfirmed", () => {
  it("needs a pass from our own mail server", () => {
    expect(senderConfirmed(by("spf=pass;dkim=pass;dmarc=pass"), MX)).toBe(true);
    expect(senderConfirmed(by("dkim=pass"), MX)).toBe(true);
    expect(senderConfirmed(by("spf=pass"), MX)).toBe(false);
    expect(senderConfirmed(by("dkim=pass;dmarc=fail"), MX)).toBe(false);
  });
  it("is false for forged, missing or unread results", () => {
    expect(senderConfirmed(by("dmarc=pass", "forged.example"), MX)).toBe(false);
    expect(senderConfirmed(by("dmarc=pass"), null)).toBe(false);
    expect(senderConfirmed("", MX)).toBe(false);
    expect(senderConfirmed(null, MX)).toBe(false);
  });
});

describe("lookAlike", () => {
  it("decodes encoded names", () => {
    expect(readableHost("xn--mnchen-3ya.de")).toBe("münchen.de");
    expect(readableHost("www.xn--80ak6aa92e.com")).toBe("www.аррӏе.com");
    expect(readableHost("example.com")).toBe("example.com");
  });
  it("flags foreign letters under an ordinary ending", () => {
    expect(lookAlike("xn--80ak6aa92e.com")).toBe(true);
    expect(lookAlike("pаypal.com")).toBe(true); // Cyrillic а
  });
  it("accepts ordinary and accented names", () => {
    expect(lookAlike("paypal.com")).toBe(false);
    expect(lookAlike("xn--mnchen-3ya.de")).toBe(false);
  });
  it("is reported for senders and links", () => {
    expect(nameProblem("PayPal", "service@pаypal.com")).toContain("another alphabet");
    expect(cleanMail('<a href="https://xn--80ak6aa92e.com/login">Sign in</a>').lookAlikes).toEqual(["аррӏе.com"]);
  });
});

describe("tricks from issue 6", () => {
  const flagged = (name: string, address = "alerts@evil.example") => nameProblem(name, address);
  it("finds the company name however it is written", () => {
    expect(flagged("PayPal Security Team")).toContain('"PayPal"');
    expect(flagged("PayPal-Support")).toContain('"PayPal"');
    expect(flagged("PayPal Inc.")).toContain('"PayPal"');
    expect(flagged("Service PayPal")).toContain('"PayPal"');
    expect(flagged("PayPaI")).toContain('"PayPal"'); // capital i
    expect(flagged("Micr0soft Account Team")).toContain('"Microsoft"');
    expect(flagged("Аpple ID")).toContain('"Apple"'); // Cyrillic А
  });

  it("knows companies that have no logo", () => {
    expect(flagged("Microsoft Account Team")).toContain('"Microsoft"');
    expect(flagged("Amazon Delivery")).toContain('"Amazon"');
    expect(flagged("DHL Express")).toContain('"DHL"');
    expect(nameProblem("Microsoft Account Team", "account-security-noreply@accountprotection.microsoft.com")).toBeNull();
    expect(nameProblem("Amazon.co.uk", "shipment-tracking@amazon.co.uk")).toBeNull();
  });

  it("does not take a company's name under any ending", () => {
    expect(nameProblem("PayPal", "service@paypal.xyz")).toContain('"PayPal"');
    expect(nameProblem("PayPal", "service@paypal.be")).toBeNull();
  });

  it("leaves names that only contain a company's name alone", () => {
    expect(nameProblem("Apple Insider", "news@appleinsider.com")).toBeNull();
    expect(nameProblem("Anna from the PayPal fan club", "anna@fans.example")).toBeNull();
    expect(nameProblem("YouTube", "no-reply@youtube.com")).toBeNull();
  });

  it("finds addresses that imitate a company's with look-alike letters", () => {
    expect(nameProblem("Account", "service@paypa1.com")).toContain("looks like paypal.com");
    expect(nameProblem("Account", "service@rnicrosoft.com")).toContain("looks like microsoft.com");
    expect(nameProblem("Account", "service@paypal.com")).toBeNull();
  });

  it("keeps sites on shared hosting apart", () => {
    expect(registrable("paypal.github.io")).toBe("paypal.github.io");
    expect(registrable("evil.github.io")).not.toBe(registrable("paypal.github.io"));
    expect(registrable("login.paypal.pages.dev")).toBe("paypal.pages.dev");
    expect(registrable("a.b.herokuapp.com")).toBe("b.herokuapp.com");
    const { mismatches } = cleanMail('<a href="https://evil.github.io/login">paypal.github.io</a>');
    expect(mismatches).toEqual([{ shown: "paypal.github.io", goes: "evil.github.io" }]);
  });
});

describe("nameProblem", () => {
  it("accepts a company writing from its own domains", () => {
    expect(nameProblem("PayPal", "service@paypal.com")).toBeNull();
    expect(nameProblem("PayPal Support", "service@mail.paypal.be")).toBeNull();
    expect(nameProblem("Mona Kane", "mona@contoso.example")).toBeNull();
  });
  it("flags a company name on someone else's address", () => {
    expect(nameProblem("PayPal Security", "alerts@paypal-security.example")).toContain('"PayPal"');
    expect(nameProblem("Netflix", "billing@netflix.com.evil.example")).toContain("does not belong to Netflix");
  });
  it("does not flag a name that merely starts with a company word", () => {
    expect(nameProblem("Orange Tree Nursery", "hello@orangetree.example")).toBeNull();
  });
  it("flags a name that shows a different address", () => {
    expect(nameProblem("support@paypal.com", "x@evil.example")).toContain("support@paypal.com");
    expect(nameProblem("mona@contoso.example", "mona@contoso.example")).toBeNull();
  });
});

describe("cleanMail", () => {
  it("removes tracking pixels but keeps real images", () => {
    const { html, pixels } = cleanMail(
      '<p>Hi</p><img src="https://t.example/open?id=9" width="1" height="1"><img src="https://x.example/a.png" style="display:none"><img src="https://cdn.example/banner.png" width="320">',
    );
    expect(pixels).toBe(2);
    expect(html).toContain("banner.png");
    expect(html).not.toContain("t.example");
  });
  it("removes images from known tracking addresses whatever their size", () => {
    expect(cleanMail('<img src="https://shop.us1.list-manage.com/track/open.php?u=1" width="40">').pixels).toBe(1);
  });
  it("strips tracking parameters and keeps the others", () => {
    const { html, links } = cleanMail('<a href="https://shop.example/item?id=7&utm_source=mail&utm_campaign=x&fbclid=abc">Item</a>');
    expect(links).toBe(1);
    expect(html).toContain('href="https://shop.example/item?id=7"');
  });
  it("finds links that show one site and lead to another", () => {
    const { mismatches } = cleanMail('<a href="https://evil.example/login">www.paypal.com</a> <a href="https://www.paypal.com/x">paypal.com/help</a> <a href="https://evil.example">Click here</a>');
    expect(mismatches).toEqual([{ shown: "www.paypal.com", goes: "evil.example" }]);
  });
  it("leaves the mail alone when blocking is off, but still checks links", () => {
    const { html, pixels, mismatches } = cleanMail('<img src="https://t.example/o.gif" width="1"><a href="https://b.example">a.example</a>', false);
    expect(pixels).toBe(0);
    expect(html).toContain("o.gif");
    expect(mismatches).toHaveLength(1);
  });
});
