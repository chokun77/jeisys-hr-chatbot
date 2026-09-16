import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// 로그인 없이 통과시킬 경로. "/login" 자체와 정적 자산은 proxy config.matcher에서
// 이미 제외되므로 여기서는 "/login"만 예외로 둔다.
function isPublicPath(pathname: string) {
  return pathname === "/login";
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  // createServerClient와 getClaims() 사이에는 다른 코드를 넣지 않는다.
  // (Supabase 공식 경고: 그 사이에 로직이 끼면 세션이 무작위로 끊기는 문제가 생긴다.)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            // CDN이 앞단에 있을 때(Vercel) 세션 쿠키가 캐시되어 누출되지 않도록
            // headers를 함께 넘긴다(공식 경고).
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const isLoggedIn = Boolean(data?.claims);
  const { pathname } = request.nextUrl;

  if (!isLoggedIn && pathname.startsWith("/api")) {
    return NextResponse.json(
      { error: "unauthenticated", answer: "로그인이 필요합니다. 다시 로그인해 주세요.", sources: [], handoff: false },
      { status: 401 },
    );
  }

  if (!isLoggedIn && !isPublicPath(pathname)) {
    const loginUrl = new URL("/login", request.url);
    // 원래 가려던 경로를 보존한다. "/"로 시작하는 상대 경로만 허용해 open redirect를 막는다.
    if (pathname.startsWith("/")) loginUrl.searchParams.set("redirectTo", pathname);
    const redirectResponse = NextResponse.redirect(loginUrl);
    supabaseResponse.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
    return redirectResponse;
  }

  if (isLoggedIn && isPublicPath(pathname)) {
    const redirectResponse = NextResponse.redirect(new URL("/", request.url));
    supabaseResponse.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
    return redirectResponse;
  }

  return supabaseResponse;
}
