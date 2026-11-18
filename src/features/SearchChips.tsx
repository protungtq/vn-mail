import { IconCalendar, IconPaperclip } from "@tabler/icons-react";
import { Chip, Divider } from "../components/ui";
import { useT } from "../lib/useT";
import { useStore } from "../store";
import type { DateFilter } from "../types";

const dateBox = "h-7 rounded-full border border-edge bg-card px-2 text-ink";

/** Unix seconds for the start of a yyyy-mm-dd day (local time), plus `addDays`; null when empty. */
function toSeconds(day: string, addDays: number): number | null {
  if (!day) return null;
  const d = new Date(`${day}T00:00:00`);
  d.setDate(d.getDate() + addDays);
  return Math.floor(d.getTime() / 1000);
}

/** Filter row shown under the header while a search is active. */
export function SearchChips() {
  const t = useT();
  const filters = useStore((s) => s.filters);
  const setFilters = useStore((s) => s.setFilters);
  const accounts = useStore((s) => s.accounts);
  const dates: [DateFilter, string][] = [
    ["any", t("search.date.any")],
    ["past-year", t("search.date.pastYear")],
    ["older-1y", t("search.date.older1y")],
    ["older-2y", t("search.date.older2y")],
  ];
  return (
    <div className="mt-2 flex flex-none flex-wrap items-center gap-1.5" role="toolbar" aria-label={t("search.filtersLabel")}>
      <Chip on={filters.accountId === null} onClick={() => setFilters({ accountId: null })}>
        {t("search.allAccounts")}
      </Chip>
      {accounts.map((a) => (
        <Chip key={a.id} on={filters.accountId === a.id} onClick={() => setFilters({ accountId: a.id })}>
          {a.address}
        </Chip>
      ))}
      <Divider />
      <Chip on={filters.hasAttachment} onClick={() => setFilters({ hasAttachment: !filters.hasAttachment })}>
        <IconPaperclip size={15} />
        {t("search.hasAttachment")}
      </Chip>
      <Divider />
      {dates.map(([value, label]) => (
        <Chip key={value} on={filters.date === value} onClick={() => setFilters({ date: value })}>
          {label}
        </Chip>
      ))}
      <Chip on={filters.date === "custom"} onClick={() => setFilters({ date: "custom" })}>
        <IconCalendar size={15} />
        {t("search.date.custom")}
      </Chip>
      {filters.date === "custom" && (
        <span className="flex items-center gap-1.5 text-[13px] text-ink2">
          <input type="date" aria-label={t("search.date.from")} className={dateBox} onChange={(e) => setFilters({ after: toSeconds(e.target.value, 0) })} />
          {t("search.date.toWord")}
          <input type="date" aria-label={t("search.date.to")} className={dateBox} onChange={(e) => setFilters({ before: toSeconds(e.target.value, 1) })} />
        </span>
      )}
    </div>
  );
}
