// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { hasPicture, signatureHtml } from "./signature";
import type { SavedSignature } from "../types";

const sig = (over: Partial<SavedSignature> = {}): SavedSignature => ({
  id: 1,
  name: "Work",
  html: "<p>Test</p>",
  layout: "above",
  image: "data:image/png;base64,AAAA",
  ...over,
});

describe("signatureHtml", () => {
  it("returns plain html when there is no picture", () => {
    expect(signatureHtml(sig({ image: "" }))).toBe("<p>Test</p>");
    expect(signatureHtml(sig({ layout: "text" }))).toBe("<p>Test</p>");
    expect(hasPicture(sig({ image: "" }))).toBe(false);
  });

  it("lets a wide banner render at its natural width (above layout)", () => {
    const html = signatureHtml(sig({ layout: "above" }));
    // Natural size, capped so a square logo stays small but a wide banner
    // is not squeezed to 160px: this is the fix for banners arriving tiny.
    expect(html).toContain('width="160"');
    expect(html).toContain("max-width:320px");
    expect(html).toContain("max-height:160px");
    expect(html).toContain("width:auto");
    expect(html).toContain('src="data:image/png;base64,AAAA"');
  });

  it("caps the side layout tighter so the text column keeps room", () => {
    const html = signatureHtml(sig({ layout: "left" }));
    expect(html).toContain('width="96"');
    expect(html).toContain("max-width:200px");
    expect(html).toContain("max-height:96px");
  });

  it("uses the given src (cid: inside a sent message)", () => {
    const html = signatureHtml(sig({ layout: "above" }), "cid:signature-image");
    expect(html).toContain('src="cid:signature-image"');
  });
});
