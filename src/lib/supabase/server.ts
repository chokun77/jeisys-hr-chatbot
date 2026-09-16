import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// 서버 컴포넌트·Server Action·라우트 핸들러에서 쓰는 Supabase 클라이언트.
// 쿠키 기반 세션을 읽고, 필요하면 갱신된 쿠키를 다시 써 준다.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component에서 호출되면 쿠키를 쓸 수 없어 에러가 나는데,
            // 세션 갱신은 proxy가 대신 처리하므로 여기서는 무시해도 된다(공식 패턴).
          }
        },
      },
    },
  );
}
