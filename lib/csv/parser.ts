import Papa from "papaparse";
import type { InvalidRow, ParseResult, SaleRow } from "./types";

const UNCATEGORIZED = "未分類";

const REQUIRED_COLUMNS = [
  "order_date",
  "customer_id",
  "product_name",
  "sku",
  "quantity",
  "revenue",
  "cost",
] as const;

const HEADER_ALIASES: Record<string, string> = {
  order_date: "order_date",
  orderdate: "order_date",
  date: "order_date",
  created_at: "order_date",
  注文日: "order_date",
  日付: "order_date",
  customer_id: "customer_id",
  customerid: "customer_id",
  customer: "customer_id",
  顧客id: "customer_id",
  product_name: "product_name",
  productname: "product_name",
  product: "product_name",
  商品名: "product_name",
  category: "category",
  カテゴリ: "category",
  カテゴリー: "category",
  sku: "sku",
  商品コード: "sku",
  quantity: "quantity",
  qty: "quantity",
  数量: "quantity",
  revenue: "revenue",
  sales: "revenue",
  amount: "revenue",
  売上: "revenue",
  売上金額: "revenue",
  cost: "cost",
  原価: "cost",
};

/** "Order Date" / "Created at" のような表記揺れを内部キーに寄せる */
export function normalizeHeader(header: string): string {
  const key = header.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return HEADER_ALIASES[key] ?? key;
}

const DATE_PATTERN = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/;

/**
 * YYYY-MM-DD へ正規化する。解釈できない場合は null。
 * new Date() は "あいうえお" に対して Invalid Date という「有効なDateオブジェクト」を
 * 返すため検証に使えない。また文字列によって UTC 解釈とローカル解釈が切り替わり、
 * 月境界がタイムゾーン依存になる。ここでは Date を暦計算にしか使わない。
 */
export function normalizeDate(input: string): string | null {
  const matched = DATE_PATTERN.exec(input.trim());
  if (!matched) return null;

  const year = Number(matched[1]);
  const month = Number(matched[2]);
  const day = Number(matched[3]);
  if (month < 1 || month > 12) return null;

  const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day < 1 || day > lastDayOfMonth) return null;

  return `${matched[1]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * 金額をパースする。空文字は null（＝無効行）として返す。
 * Number("") === 0 なので coerce に任せると空欄が「0円の有効行」として
 * 集計に混入し、無効行にも計上されない（D-3 #2）。
 * 返品・キャンセルを表すマイナス値は有効として通す（D-3 #3）。
 */
export function parseAmount(input: string): number | null {
  const cleaned = input.trim().replace(/[,¥￥\s]/g, "");
  if (cleaned === "") return null;
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  return Number(cleaned);
}

function parseQuantity(input: string): number | null {
  const parsed = parseAmount(input);
  if (parsed === null || !Number.isInteger(parsed) || parsed === 0) return null;
  return parsed;
}

/**
 * UTF-8 として読めなかったバイトを検出する。
 * File.text() は UTF-8 でデコードするため、Shift_JIS のCSVを渡すと
 * 不正なバイトが U+FFFD（置換文字）になる。金額や日付は ASCII なので
 * そのまま通り、商品名とカテゴリだけが文字化けしたまま有効行として
 * 集計される。エラーは出ないので画面上は成功に見える。
 * Excel の「CSV(カンマ区切り)」は既定が Shift_JIS なので普通に起きる。
 */
function hasDecodingFailure(raw: Record<string, string>): boolean {
  return Object.values(raw).some((value) => (value ?? "").toString().includes("\uFFFD"));
}

function validateRow(raw: Record<string, string>): { row?: SaleRow; reason?: string } {
  const get = (key: string) => (raw[key] ?? "").toString();
  const reasons: string[] = [];

  if (hasDecodingFailure(raw)) {
    return {
      reason:
        "文字コードが UTF-8 ではないため読み取れません" +
        "（Excel では「CSV UTF-8 (コンマ区切り)」で保存し直してください）",
    };
  }

  const orderDate = normalizeDate(get("order_date"));
  if (orderDate === null) reasons.push(`order_date が日付として解釈できません（"${get("order_date")}"）`);

  const customerId = get("customer_id").trim();
  if (customerId === "") reasons.push("customer_id が空です");

  const productName = get("product_name").trim();
  if (productName === "") reasons.push("product_name が空です");

  const sku = get("sku").trim();
  if (sku === "") reasons.push("sku が空です");

  const quantity = parseQuantity(get("quantity"));
  if (quantity === null) reasons.push(`quantity が 0 以外の整数ではありません（"${get("quantity")}"）`);

  const revenue = parseAmount(get("revenue"));
  if (revenue === null) reasons.push(`revenue が数値ではありません（"${get("revenue")}"）`);

  const cost = parseAmount(get("cost"));
  if (cost === null) reasons.push(`cost が数値ではありません（"${get("cost")}"）`);

  if (reasons.length > 0) return { reason: reasons.join(" / ") };

  return {
    row: {
      orderDate: orderDate!,
      month: orderDate!.slice(0, 7),
      customerId,
      productName,
      category: get("category").trim() || UNCATEGORIZED,
      sku,
      quantity: quantity!,
      revenue: revenue!,
      cost: cost!,
    },
  };
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

export function parseSalesCsvText(text: string): ParseResult {
  const { data, errors, meta } = Papa.parse<Record<string, string>>(stripBom(text), {
    header: true,
    // 空行を飛ばすとパース後のインデックスと実CSV行番号がズレ、
    // クライアントに渡すスキップ行CSVが実際と食い違う（D-3 #4）
    skipEmptyLines: false,
    transformHeader: normalizeHeader,
  });

  const fields = meta.fields ?? [];
  const missingColumns = REQUIRED_COLUMNS.filter((column) => !fields.includes(column));
  if (missingColumns.length > 0) {
    return { valid: [], invalid: [], missingColumns };
  }

  const isBlank = (row: Record<string, string>) =>
    Object.values(row).every((value) => (value ?? "").toString().trim() === "");

  const blankLines = new Set<number>();
  const reasonsByLine = new Map<number, { reasons: string[]; raw: Record<string, string> }>();
  const valid: SaleRow[] = [];

  data.forEach((raw, index) => {
    const line = index + 2; // 1行目はヘッダー
    if (isBlank(raw)) {
      blankLines.add(line);
      return;
    }
    const { row, reason } = validateRow(raw);
    if (row) valid.push(row);
    else reasonsByLine.set(line, { reasons: [reason!], raw });
  });

  // Papa 自身が検出したエラー（列数不一致など）も握りつぶさない（D-3 #5）
  for (const error of errors) {
    if (typeof error.row !== "number") continue;
    const line = error.row + 2;
    if (blankLines.has(line)) continue;
    const existing = reasonsByLine.get(line);
    if (existing) {
      if (!existing.reasons.includes(error.message)) existing.reasons.push(error.message);
    } else {
      reasonsByLine.set(line, { reasons: [error.message], raw: data[error.row] ?? {} });
    }
  }

  const invalid: InvalidRow[] = [...reasonsByLine.entries()]
    .map(([line, { reasons, raw }]) => ({ line, reason: reasons.join(" / "), raw }))
    .sort((a, b) => a.line - b.line);

  return { valid, invalid, missingColumns: [] };
}

export async function parseSalesCsv(file: File): Promise<ParseResult> {
  return parseSalesCsvText(await file.text());
}

/** スキップ行をクライアントへ返すためのCSV（講義の「スキップ行のダウンロードCSV」要件） */
export function invalidRowsToCsv(invalid: InvalidRow[]): string {
  return Papa.unparse(
    invalid.map(({ line, reason, raw }) => ({ 行番号: line, 理由: reason, ...raw })),
  );
}
