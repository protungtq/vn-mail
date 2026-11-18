# Changelog

> VN Mail is a fork of [OpenWren](https://github.com/VinceGHER/openwren)
> (Apache-2.0). The entries below are OpenWren's history, kept as it was.
> Fork changes so far: renamed to VN Mail (new name, icon and app
> identifier); the update check and the anonymous usage count disabled,
> since VN Mail has no server for them yet; Ctrl+A (Cmd+A on macOS)
> selects every message in the list.

## 0.1.12

- A `mailto:` link in a message opens OpenWren's own composer, filled with the recipient, copy, subject and text only. It used to go to the system mail program with all its parameters, and some programs attach local files when a link asks them to.
- The phishing warnings catch more tricks: a company name anywhere in the sender name ("Service PayPal", "PayPal-Support", "PayPal Inc."), names spelt with look-alike letters ("PayPaI" with a capital i, "Micr0soft"), addresses that imitate a company's ("paypa1.com"), and companies without a logo such as Microsoft, Amazon and DHL.
- Sites on shared hosting (github.io, pages.dev and the like) are told apart, using the Public Suffix List bundled with the app.
- Senders are harder to fake as "confirmed". For Gmail, only Google's own checks count. For other providers, the server whose checks are believed is learned only from at least 50 messages, and it must have checked at least 80% of them; it used to take 5 messages and half. Settings, Accounts shows which server it is. Until an account has enough checked mail, its senders show as not confirmed and without company logos.
- Old Office files (`.doc`, `.xls`, `.ppt`) and `.rtf` files no longer open straight from mail, since they can carry macros or exploits. Save them first if you trust the sender.
- A message can no longer position text over the reading pane, such as a fake "verified" mark, and links in image maps are removed, so every link goes through the link checks.
- An attachment you open is written readable by you only from the first moment; its folder used to be readable by others for an instant.
- "None (not secure)" now works only for a mail server on this computer, as the setting always said.
- Removing a Google account asks Google to cancel its access; before, the sign-in stayed valid at Google.
- Files chosen for attaching are forgotten after a week unless a draft still attaches them, and unsubscribe requests refuse a few more special address ranges.
- The anonymous usage count is now a choice you make. The welcome screen asks in the maintainer's own words, with neither answer picked and a "See what is sent" link that lists everything the request contains; nothing is sent until you say yes. If you already use OpenWren, your setting stays as it was.
- The usage count sends less: the major system version ("ubuntu-24") and the month of installation, instead of the full version and the week. PRIVACY.md no longer says that two requests can never be linked: on an uncommon system the facts in them may be shared by only a few installations.
- The last welcome page and a new Sponsor page in Settings say how to sponsor OpenWren on GitHub.
- The mail cleaner (ammonia) is updated to 4.2.5, which fixes a flaw in handling SVG and MathML. OpenWren does not allow those tags in mail, so it was not affected.
- If you used version 0.1.0, which stored mail unencrypted: later versions encrypted the database, but the disk space of the old unencrypted file is only overwritten over time.

## 0.1.11

- Accounts can be put in any order in Settings, Accounts: drag one by its dots, or use the arrow keys. The folder list follows.
- The welcome screen has a switch for the anonymous usage count on its "Make it yours" page, and nothing is sent before that screen is finished.
- The welcome screen scrolls in a short window, with its buttons always in view; the lower part used to be cut off.
- The sync line and the header of the folder list stay in place while the folders scroll, so the scrollbar no longer runs through the sync status popup.
- "Show what is sent" is gone from Settings, Privacy; PRIVACY.md still shows the exact request.

## 0.1.10

- The sync line at the bottom opens a list of every account with its state, so an error shows which account it belongs to.
- A button beside Settings checks for new mail now.
- Removing an account with a large mailbox no longer freezes the app; the account shows "Removing…" until it is gone.

## 0.1.9

- On Linux with Wayland, the window is sharp on a 100% monitor that sits beside a 200% screen; it used to be drawn blurred.

## 0.1.8

- A sent message's copy in Sent is saved even when the server had closed the idle connection; if it still cannot be saved, OpenWren says so.
- Send problems are written to the system log.

## 0.1.7

- Forwarding a message takes its attachments along; remove any you do not want to send.
- The forwarded message is text in the editor, so you can shorten or correct it before sending.
- After an update, OpenWren shows what is new.

## 0.1.6

- Unread messages are bold in the list and turn regular once read.

## 0.1.5

- On macOS, keyboard shortcuts use the Command key, and hints show it.
- The first version that earlier installs are told about by the update notice.

## 0.1.4

- OpenWren tells you when a new version is out, in the sidebar and in Settings, About.
- On Windows, macOS and the AppImage it installs the update for you, after checking its signature.
- Windows and macOS versions are part of every release; the macOS one runs on Apple silicon and Intel.
- A file attached to a message you are writing opens with a click on its name.

## 0.1.3

- The anonymous daily usage request is sent within 30 seconds of starting, not after several minutes.

## 0.1.2

Security fixes from a review before the public release.

- Sender checks: text chosen by the sender can no longer be read as a passed check, and a signature counts only when the sender's own domain made it. Stored results are read again.
- "Always show images from this sender" applies only when your mail server confirmed the sender.
- Unsubscribe by mail goes to one address with a short one-line subject and text; a message can no longer choose extra recipients.
- Attachments open only when they are documents, pictures, sound, video or archives; everything else is saved first.
- Releases: packages are built without access to the signing key, and the repositories are checked before they are signed again.

## 0.1.1

- The package is now called `openwren` (0.1.0 was published as `open-wren`), with a proper description and maintainer.
- OpenWren starts in the tray when you log in; switch it off in Settings → Notifications. The login entry is skipped once the program is uninstalled.
- Signatures: one table says which accounts use a signature for new mail and for replies; changes save by themselves.
- Links in a message open in the browser; the conversation list can be folded.

## 0.1.0

First version.

- Gmail (app password or Google sign-in) and any IMAP account; several accounts with "All inboxes".
- Encrypted local storage and search across the whole mailbox.
- Rich-text writing with signatures, attachments, undo send, send later and drafts kept on the server.
- Tracker removal, warnings for suspicious mail, block sender, one-click unsubscribe.
- Snooze, rules, colour categories, favourites, conversations.
- Light and dark themes, tray icon, desktop notifications.
