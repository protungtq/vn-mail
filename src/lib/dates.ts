import { getLanguage, t } from "./i18n";

const DAY = 24 * 60 * 60 * 1000;

// Own name tables: Intl output differs between runtimes ("Sep" vs "Sept").
const MONTHS = {
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  vi: ["Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6", "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"],
};
const WEEKDAYS = {
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  vi: ["CN", "T2", "T3", "T4", "T5", "T6", "T7"],
};

/** "14 Sep 2025", or "14 thg 9 2025" in Vietnamese. */
function dayMonthYear(d: Date): string {
  if (getLanguage() === "vi") return `${d.getDate()} thg ${d.getMonth() + 1} ${d.getFullYear()}`;
  return `${d.getDate()} ${MONTHS.en[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Whole calendar days between `date` and `now` (0 = today, 1 = yesterday). */
export function daysAgo(date: Date, now: Date): number {
  return Math.round((startOfDay(now) - startOfDay(date)) / DAY);
}

/** Section heading for the message list. */
export function groupLabel(date: Date, now: Date): string {
  const d = daysAgo(date, now);
  if (d <= 0) return t("dates.today");
  if (d === 1) return t("dates.yesterday");
  if (d < 7) return t("dates.thisWeek");
  if (date.getFullYear() === now.getFullYear()) {
    return MONTHS[getLanguage()][date.getMonth()];
  }
  return String(date.getFullYear());
}

const pad = (n: number) => String(n).padStart(2, "0");

let twelveHour = false;

/** Show times as "3:05 PM" (true) or "15:05" (false). Set from the "Time format" setting. */
export function useTwelveHourClock(on: boolean) {
  twelveHour = on;
}

/** The time of day: "15:05", or "3:05 PM" with the 12-hour clock ("3:05 CH" in Vietnamese). */
export function clock(date: Date): string {
  const minutes = pad(date.getMinutes());
  if (!twelveHour) return `${date.getHours()}:${minutes}`;
  const hour = date.getHours() % 12 || 12;
  const meridiem = getLanguage() === "vi" ? (date.getHours() < 12 ? "SA" : "CH") : date.getHours() < 12 ? "AM" : "PM";
  return `${hour}:${minutes} ${meridiem}`;
}

/** Short time for a list row: "11:58", "Wed 15:55" or "14 Sep 2025". */
export function shortTime(date: Date, now: Date): string {
  const d = daysAgo(date, now);
  const hm = clock(date);
  if (d <= 0) return hm;
  if (d < 7) return `${WEEKDAYS[getLanguage()][date.getDay()]} ${hm}`;
  return dayMonthYear(date);
}

/** Full time for the reading pane. `lowerFirst` writes "today"/"hôm nay" mid-sentence. */
export function longTime(date: Date, now: Date, lowerFirst = false): string {
  const d = daysAgo(date, now);
  const hm = clock(date);
  const lower = (word: string) => (lowerFirst ? word.toLowerCase() : word);
  if (d <= 0) return `${lower(t("dates.today"))} ${hm}`;
  if (d === 1) return `${lower(t("dates.yesterday"))} ${hm}`;
  return `${dayMonthYear(date)}, ${hm}`;
}

/** Date that lies `years` calendar years before `now`. */
export function yearsBefore(now: Date, years: number): Date {
  const d = new Date(now);
  d.setFullYear(d.getFullYear() - years);
  return d;
}
