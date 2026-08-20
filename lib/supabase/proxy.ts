import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** ログイン不要で見せるパス */
const PUBLIC_PATHS = ["/login", "/auth"];

/**
 * セッションCookieを更新し、未ログインならログイン画面へ送る。
 *
 * Next.js 16 では middleware が proxy に改名された。Supabase の公式手順は
 * middleware.ts を作る前提で書かれているので、そのまま従うと非推奨のAPIになる。
 *
 * ここで行うのは「Cookieを見た軽い判定」までにとどめる。
 * proxy はプリフェッチを含む全リクエストで走るため、重い処理を置くと遅くなる。
 * 本当の認可はページ側（app/page.tsx）の getUser() で行う
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // getSession ではなく getUser を使う。
  // getSession は Cookie の中身をそのまま信じるため、改ざんを検知できない
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((prefix) => path.startsWith(prefix));

  if (!user && !isPublic) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    // ログイン後に元のページへ戻せるようにする
    loginUrl.searchParams.set("next", path);
    return NextResponse.redirect(loginUrl);
  }

  // ログイン済みでログイン画面に来たらダッシュボードへ
  if (user && path.startsWith("/login")) {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/";
    homeUrl.search = "";
    return NextResponse.redirect(homeUrl);
  }

  return response;
}
