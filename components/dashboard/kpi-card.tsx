type Props = {
  label: string;
  value: string;
  change: string;
  /** 前月比の向き。null は比較対象なし（最初の月） */
  changeDirection: "up" | "down" | "flat" | null;
  /** 同じ「リピート率」でも定義が2種類あるため、画面に定義を必ず添える（D-1） */
  definition: string;
};

export function KpiCard({ label, value, change, changeDirection, definition }: Props) {
  const changeColor =
    changeDirection === "up"
      ? "text-green-700"
      : changeDirection === "down"
        ? "text-red-700"
        : "text-zinc-500";

  return (
    <div className="rounded-lg border border-zinc-200 border-l-4 border-l-brand-navy bg-white p-5">
      <p className="text-sm text-zinc-600">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums text-brand-navy">{value}</p>
      <p className={`mt-1 text-sm tabular-nums ${changeColor}`}>
        前月比 {change}
        {changeDirection === null && <span className="ml-1 text-zinc-400">（前月のデータなし）</span>}
      </p>
      <p className="mt-3 border-t border-zinc-100 pt-2 text-xs leading-relaxed text-zinc-500">
        {definition}
      </p>
    </div>
  );
}
