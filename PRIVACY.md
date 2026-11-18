# Privacy

VN Mail keeps your mail on your computer. There is no VN Mail account and no VN Mail server that sees your mail.

VN Mail is a fork of [OpenWren](https://github.com/VinceGHER/openwren). Unlike OpenWren, this fork sends no anonymous usage count and checks for no new version: both are disabled in the code, so the requests below are the only ones the app makes.

## Every network request the app makes

| Request | When | To whom |
|---|---|---|
| Reading and sending mail | Always, for the accounts you add | Your own mail servers (IMAP and SMTP) |
| Google sign-in | Only if you choose "Sign in with Google", and once more when you remove that account, to cancel its access | Google |
| Remote images in a message | Only when you click "Show images", or for senders you chose to always allow | The server named in the message |
| Unsubscribe | Only when you confirm "Unsubscribe" on a mailing | The sender's unsubscribe address |
| Opening a link | When you click one | Your browser opens it |

Nothing else. No analytics library, no crash reporter, no update check, no usage count.

## Never collected

Email addresses, names, subjects, mail text, attachments, contacts, folder names, mail server names, IP addresses.

## Where your data lives

- Mail, search index, drafts, settings: an encrypted database in `~/.local/share/asia.so1.vnmail/` on Linux. Settings → About shows the exact folder on your computer.
- Passwords, Google tokens and the database key: the system keyring.
- Attachments you open: a temporary folder, emptied after 30 minutes and when VN Mail quits.

Removing an account in Settings deletes its local mail and its saved password. Nothing changes on the server.
