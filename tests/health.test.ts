import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Supabase への実接続なしで「クエリ失敗 → 500」まで検証できるようにモックする
const selectMock = vi.fn();
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ from: () => ({ select: selectMock }) }),
}));

const { GET } = await import("../app/api/health/route");

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  selectMock.mockReset();
  delete process.env.HEALTH_FORCE_FAIL;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("/api/health", () => {
  it("HEALTH_FORCE_FAIL=1 で500を返す（検収でわざと落として通知を実演するための分岐）", async () => {
    process.env.HEALTH_FORCE_FAIL = "1";

    const response = await GET();

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      status: "error",
      reason: "forced_failure",
    });
  });

  it("Supabase未設定のうちは200を返す（監視を先に始められるようにするため）", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "ok",
      database: "not_configured",
    });
  });

  it("プレースホルダのままの値も未設定として扱う", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "ここに貼る";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "ここに貼る";

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ database: "not_configured" });
  });

  it("Supabaseに繋がれば200を返す", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    selectMock.mockResolvedValue({ error: null });

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok", database: "reachable" });
  });

  it("クエリが失敗したら500を返す（UptimeRobotが検知する経路）", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    selectMock.mockResolvedValue({ error: { message: "relation does not exist" } });

    const response = await GET();

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      status: "error",
      database: "query_failed",
    });
  });

  it("Supabaseが応答しない（例外）場合も500を返す", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    selectMock.mockRejectedValue(new Error("network down"));

    const response = await GET();

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ database: "unreachable" });
  });
});
