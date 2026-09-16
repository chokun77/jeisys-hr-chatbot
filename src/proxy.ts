import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Next.js 16부터 middleware.ts 대신 proxy.ts를 쓴다. 모든 요청에서 세션을 갱신하고,
// 로그인 여부에 따라 /login ↔ 앱 화면을 오가게 한다. 실제 인가(무엇을 볼 수 있는지)는
// 각 라우트/페이지에서 다시 한번 확인한다 — 여기가 유일한 방어선이 아니다.
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
