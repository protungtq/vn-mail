# Privacy

VN Mail keeps your mail on your computer. There is no VN Mail account and no VN Mail server that sees your mail.

VN Mail is a fork of [OpenWren](https://github.com/VinceGHER/openwren). VN Mail sends no usage statistics and checks GitHub Releases for updates.

## Every network request the app makes

| Request | When | To whom |
|---|---|---|
| Reading and sending mail | Always, for the accounts you add | Your own mail servers (IMAP and SMTP) |
| Google sign-in | Only if you choose "Sign in with Google", and once more when you remove that account, to cancel its access | Google |
| Remote images in a message | Only when you click "Show images", or for senders you chose to always allow | The server named in the message |
| Unsubscribe | Only when you confirm "Unsubscribe" on a mailing | The sender's unsubscribe address |
| Checking and downloading updates | When the app periodically checks for a newer version, when you manually check, or when you install an update | GitHub Releases |
| Translating a message | Only after you confirm in the reading pane. The plain-text body is sent, which can include quoted replies or signatures | Google Translate |
| Opening a link | When you click one | Your browser opens it |

The app contains no usage analytics or crash reporter. External services receive the requests described above and can see the source IP address.

## Where your data lives

- Mail, search index, drafts, settings: an encrypted database in `~/.local/share/asia.so1.vnmail/` on Linux. Settings → About shows the exact folder on your computer.
- Passwords, Google tokens and the database key: the system keyring.
- Attachments you open: a temporary folder, emptied after 30 minutes and when VN Mail quits.

Removing an account in Settings deletes its local mail and saved credentials. If you connected via Google OAuth, VN Mail also attempts to revoke its access.
