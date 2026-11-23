import type { SavedSignature } from "../types";

/** The content id a signature's picture has inside a sent message. */
export const SIGNATURE_CID = "signature-image";

export const hasPicture = (s: SavedSignature) => s.image !== "" && s.layout !== "text";

/** Display caps for a signature picture, in px: a banner above the text may
 * run nearly full email width, a picture left of the text stays narrower so
 * the text column keeps room. */
const CAPS = {
  above: { w: 600, h: 200 },
  left: { w: 320, h: 160 },
} as const;

/** Fit w×h inside the caps, keeping the aspect ratio. Never scales up. */
function fit(w: number, h: number, cap: { w: number; h: number }) {
  const s = Math.min(1, cap.w / w, cap.h / h);
  return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) };
}

/**
 * A signature as HTML. With a picture it is laid out with a table, the one
 * layout every mail program shows the same way. `src` is where the picture
 * comes from: the stored image for previews, `cid:...` inside a sent message.
 *
 * When the stored picture size is known (saved when the picture was picked),
 * the image gets exact width/height attributes at the fitted size, so every
 * mail program — including ones that ignore max-width, like Outlook — shows
 * it at the intended size; max-width:100% keeps it inside narrow windows.
 * Signatures saved before sizes were stored keep the previous behaviour:
 * width:auto capped by max-width/max-height.
 */
export function signatureHtml(s: SavedSignature, src: string = s.image): string {
  if (!hasPicture(s)) return s.html;
  const cap = s.layout === "above" ? CAPS.above : CAPS.left;
  let attrs: string;
  if (s.imageWidth && s.imageHeight) {
    const d = fit(s.imageWidth, s.imageHeight, cap);
    attrs = `width="${d.w}" height="${d.h}" style="display:block;border:0;width:${d.w}px;max-width:100%;height:auto"`;
  } else {
    const fallbackWidth = s.layout === "above" ? 160 : 96;
    attrs = `width="${fallbackWidth}" style="display:block;border:0;width:auto;max-width:${cap.w}px;max-height:${cap.h}px;height:auto"`;
  }
  const img = `<img src="${src}" alt="" ${attrs}>`;
  if (s.layout === "above") return `<div style="margin-bottom:8px">${img}</div>${s.html}`;
  return `<table cellpadding="0" cellspacing="0" border="0"><tr><td style="padding-right:14px;vertical-align:top">${img}</td><td style="vertical-align:top">${s.html}</td></tr></table>`;
}

/** A picture picked for a signature, shrunk to fit and measured. */
export interface SignaturePicture {
  /** The picture as a data URL. */
  src: string;
  /** Stored size in px (after shrinking). */
  width: number;
  height: number;
}

/**
 * Shrink a chosen picture so it adds little to every message, and measure
 * it so sent mail can state its size. The longest side is kept at 800px:
 * a wide banner (for example 757px) stays at full resolution instead of
 * being stored at 320px and arriving small no matter how it is displayed.
 */
export async function pictureFromFile(file: File, maxSide = 800): Promise<SignaturePicture> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
  // PNG keeps transparent logos; photos are much smaller as JPEG.
  const png = canvas.toDataURL("image/png");
  const src = png.length <= 150_000 ? png : canvas.toDataURL("image/jpeg", 0.85);
  return { src, width, height };
}
