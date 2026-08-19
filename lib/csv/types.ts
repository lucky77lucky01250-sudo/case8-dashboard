export type SaleRow = {
  /** YYYY-MM-DD に正規化済み。Date には変換しない（D-3 #1） */
  orderDate: string;
  /** YYYY-MM。orderDate の文字列スライスなのでタイムゾーンに依存しない */
  month: string;
  customerId: string;
  productName: string;
  /** 欠損時は「未分類」。合計を売上合計と一致させるため捨てない（D-3 #6） */
  category: string;
  sku: string;
  quantity: number;
  revenue: number;
  cost: number;
};

export type InvalidRow = {
  /** ヘッダーを1行目とした実CSVの行番号（D-3 #4） */
  line: number;
  reason: string;
  raw: Record<string, string>;
};

export type ParseResult = {
  valid: SaleRow[];
  invalid: InvalidRow[];
  /** 必須列そのものが欠けている場合の列名。空でなければ集計に進んではいけない */
  missingColumns: string[];
};
