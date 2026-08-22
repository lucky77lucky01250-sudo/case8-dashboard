import { describe, expect, it, vi } from "vitest";
import { fetchAllPages } from "../lib/supabase/paginate";

/** PostgREST を模した取得元。全体が total 行あり、要求された範囲だけ返す */
function fakeSource(total: number) {
  const all = Array.from({ length: total }, (_, i) => ({ id: i + 1 }));
  const fetchPage = vi.fn(async (from: number, to: number) => all.slice(from, to + 1));
  return { all, fetchPage };
}

describe("fetchAllPages（1,000行の上限対策）", () => {
  it("1ページに収まる場合は1回で終わる", async () => {
    const { fetchPage } = fakeSource(40);

    const rows = await fetchAllPages(1000, fetchPage);

    expect(rows).toHaveLength(40);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  // 素直に select すると1,000行で打ち切られ、合計金額が実際より小さくなる
  it("1,000行を超えても全件取得する", async () => {
    const { fetchPage } = fakeSource(2500);

    const rows = await fetchAllPages(1000, fetchPage);

    expect(rows).toHaveLength(2500);
    expect(rows[0].id).toBe(1);
    expect(rows[2499].id).toBe(2500);
    expect(fetchPage).toHaveBeenCalledTimes(3);
  });

  it("ちょうどページサイズの倍数でも取りこぼさない", async () => {
    const { fetchPage } = fakeSource(2000);

    const rows = await fetchAllPages(1000, fetchPage);

    // 2回目でちょうど終わるが、それを知るために3回目（空）を取りに行く
    expect(rows).toHaveLength(2000);
    expect(fetchPage).toHaveBeenCalledTimes(3);
  });

  it("要求した範囲を順に渡す", async () => {
    const { fetchPage } = fakeSource(2500);

    await fetchAllPages(1000, fetchPage);

    expect(fetchPage.mock.calls).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it("0件でも落ちない", async () => {
    const { fetchPage } = fakeSource(0);

    await expect(fetchAllPages(1000, fetchPage)).resolves.toEqual([]);
  });

  it("集計に渡したとき件数が減らない（1,000行打ち切りの回帰）", async () => {
    const { all, fetchPage } = fakeSource(3000);

    const rows = await fetchAllPages(1000, fetchPage);

    expect(rows.map((r) => r.id)).toEqual(all.map((r) => r.id));
  });
});
