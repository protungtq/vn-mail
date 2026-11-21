import { createRoot } from "react-dom/client";
import { HtmlBody } from "../src/features/HtmlBody";
import { cleanMail } from "../src/lib/privacy";

// Keep the probe on loopback. WebKit reports the attempted load before TLS.
const probe = "https://127.0.0.1:1420/webkit-mail-probe.png";
const html = cleanMail(`<p>Mail privacy fixture</p><img src="${probe}" width="120">`).html;
createRoot(document.getElementById("root")!).render(<HtmlBody html={html} sender="" confirmed={false} />);

const ready = window.setInterval(() => {
  const frame = document.querySelector("iframe");
  if (!frame?.contentDocument?.body.textContent?.includes("Mail privacy fixture")) return;
  const button = document.querySelector("button");
  if (!button) return;
  window.clearInterval(ready);
  // Give an unexpected default request time to reach the WebKit observer.
  window.setTimeout(() => {
    document.title = "Show images clicked";
    window.setTimeout(() => button.click(), 150);
  }, 500);
}, 25);
