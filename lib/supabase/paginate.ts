/**
 * PostgREST は1回のクエリで最大1,000行しか返さない。
 * 本番の売上データは1,000行を超えるため、素直に select すると
 * エラーも警告もなく1,000行だけ取得され、合計金額が実際より小さくなる。
 *
 * 「画面の数字が既存Excelと一致すること」（提案書 第9項(1)）を
 * 静かに壊す経路なので、取得は必ずこの関数を通す。
 *
 * server-only を import していないのは、テストから直接呼べるようにするため。
 */
export async function fetchAllPages<T>(
  pageSize: number,
  fetchPage: (from: number, to: number) => Promise<T[]>,
): Promise<T[]> {
  if (pageSize < 1) throw new Error("pageSize は1以上である必要があります");

  const all: T[] = [];

  for (let from = 0; ; from += pageSize) {
    const page = await fetchPage(from, from + pageSize - 1);
    all.push(...page);

    // 返ってきた件数がページサイズ未満なら、そこが最後のページ。
    // ちょうど pageSize 件だった場合は次を取りに行く（次が空でループが終わる）
    if (page.length < pageSize) break;
  }

  return all;
}
