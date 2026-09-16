import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import type { Source } from "@/lib/chat-types";

function daysAgo(days: number) {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) redirect("/login");
  const userId = claims.claims.sub as string;

  await requireAdmin(supabase, userId);

  const [{ data: profiles }, { data: sessions }, { data: recentMessages }] = await Promise.all([
    supabase.from("profiles").select("id, email, role, created_at").order("created_at", { ascending: true }),
    supabase.from("chat_sessions").select("id, user_id, title, updated_at").order("updated_at", { ascending: false }),
    supabase
      .from("chat_messages")
      .select("role, sources, handoff, created_at")
      .eq("role", "bot")
      .gte("created_at", daysAgo(30)),
  ]);

  const emailByUserId = new Map((profiles ?? []).map((p) => [p.id as string, p.email as string]));

  const botMessages = recentMessages ?? [];
  const last7 = botMessages.filter((m) => new Date(m.created_at as string) >= new Date(daysAgo(7)));
  const handoffCount = botMessages.filter((m) => m.handoff).length;
  const handoffRate = botMessages.length > 0 ? Math.round((handoffCount / botMessages.length) * 100) : 0;

  const categoryCounts = new Map<string, number>();
  for (const m of botMessages) {
    const sources = (m.sources ?? []) as Source[];
    for (const s of sources) {
      categoryCounts.set(s.category, (categoryCounts.get(s.category) ?? 0) + 1);
    }
  }
  const topCategories = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-8">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">관리자 화면</h1>
        <div className="flex items-center gap-4">
          <Link href="/admin/stats" className="text-sm text-zinc-600 underline dark:text-zinc-400">
            접속 통계
          </Link>
          <Link href="/" className="text-sm text-zinc-600 underline dark:text-zinc-400">
            챗봇으로 돌아가기
          </Link>
        </div>
      </header>

      <section>
        <h2 className="mb-3 text-sm font-medium text-zinc-500 dark:text-zinc-400">계정 관리</h2>
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-2">이메일</th>
                <th className="px-4 py-2">권한</th>
                <th className="px-4 py-2">생성일</th>
              </tr>
            </thead>
            <tbody>
              {(profiles ?? []).map((p) => (
                <tr key={p.id as string} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="px-4 py-2">{p.email as string}</td>
                  <td className="px-4 py-2">{p.role === "admin" ? "관리자" : "일반"}</td>
                  <td className="px-4 py-2 text-zinc-500">{new Date(p.created_at as string).toLocaleDateString("ko-KR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-zinc-500 dark:text-zinc-400">집계 통계 (최근 30일)</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">최근 7일 질문 수</p>
            <p className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-50">{last7.length}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">최근 30일 질문 수</p>
            <p className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-50">{botMessages.length}</p>
          </div>
          <div className="col-span-2 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">인사팀 이관 비율(30일)</p>
            <p className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-50">{handoffRate}%</p>
          </div>
        </div>
        {topCategories.length > 0 && (
          <div className="mt-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
            <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">많이 질문된 카테고리(30일)</p>
            <ul className="space-y-1 text-sm">
              {topCategories.map(([category, count]) => (
                <li key={category} className="flex justify-between text-zinc-700 dark:text-zinc-300">
                  <span>{category}</span>
                  <span className="text-zinc-500">{count}건</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-zinc-500 dark:text-zinc-400">전 직원 대화 목록</h2>
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-2">계정</th>
                <th className="px-4 py-2">제목</th>
                <th className="px-4 py-2">최근 활동</th>
              </tr>
            </thead>
            <tbody>
              {(sessions ?? []).map((s) => (
                <tr key={s.id as string} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="px-4 py-2 text-zinc-500">{emailByUserId.get(s.user_id as string) ?? "(알 수 없음)"}</td>
                  <td className="px-4 py-2">
                    <Link href={`/admin/sessions/${s.id}`} className="text-zinc-900 underline dark:text-zinc-100">
                      {(s.title as string) || "(제목 없음)"}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-zinc-500">{new Date(s.updated_at as string).toLocaleString("ko-KR")}</td>
                </tr>
              ))}
              {(sessions ?? []).length === 0 && (
                <tr>
                  <td className="px-4 py-3 text-zinc-400" colSpan={3}>
                    아직 저장된 대화가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
