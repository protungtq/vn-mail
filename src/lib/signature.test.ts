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

  it("renders a wide banner at full email width when its size is known (above layout)", () => {
    // The SAM LAND banner is 757x169: it must arrive ~600px wide in Gmail,
    // not squeezed to 160px. Exact width/height also keep Outlook honest.
    const html = signatureHtml(sig({ layout: "above", imageWidth: 757, imageHeight: 169 }));
    expect(html).toContain('width="600"');
    expect(html).toContain('height="134"');
    expect(html).toContain("width:600px;max-width:100%");
    expect(html).toContain('src="data:image/png;base64,AAAA"');
  });

  it("falls back to capped natural size when the size was not stored (above layout)", () => {
    // Signatures saved before sizes were stored have no dimensions.
    const html = signatureHtml(sig({ layout: "above" }));
    expect(html).toContain('width="160"');
    expect(html).toContain("max-width:600px");
    expect(html).toContain("max-height:200px");
    expect(html).toContain("width:auto");
  });

  it("caps the side layout tighter so the text column keeps room", () => {
    const html = signatureHtml(sig({ layout: "left", imageWidth: 757, imageHeight: 169 }));
    expect(html).toContain('width="320"');
    expect(html).toContain('height="71"');
  });

  it("falls back to capped natural size when the size was not stored (left layout)", () => {
    const html = signatureHtml(sig({ layout: "left" }));
    expect(html).toContain('width="96"');
    expect(html).toContain("max-width:320px");
    expect(html).toContain("max-height:160px");
  });

  it("never scales a small picture up", () => {
    const html = signatureHtml(sig({ layout: "above", imageWidth: 100, imageHeight: 100 }));
    expect(html).toContain('width="100"');
    expect(html).toContain('height="100"');
  });

  it("uses the given src (cid: inside a sent message)", () => {
    const html = signatureHtml(sig({ layout: "above" }), "cid:signature-image");
    expect(html).toContain('src="cid:signature-image"');
  });
});
