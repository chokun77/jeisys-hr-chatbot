import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import { aggregateByBucket, aggregateByUser, dayBuckets, weekBuckets, monthBuckets } from "@/lib/stats";
import BarChart from "./bar-chart";

function daysAgoIso(days: number) {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

export default async function AdminStatsPage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) redirect("/login");
  const userId = claims.claims.sub as string;

  await requireAdmin(supabase, userId);

  const [{ data: profiles }, { data: userMessages }] = await Promise.all([
    supabase.from("profiles").select("id, email"),
    supabase
      .from("chat_messages")
      .select("user_id, created_at")
      .eq("role", "user")
      .gte("created_at", daysAgoIso(180))
      .order("created_at", { ascending: true }),
  ]);

  const emailByUserId = new Map((profiles ?? []).map((p) => [p.id as string, p.email as string]));
  const rows = (userMessages ?? []) as { user_id: string; created_at: string }[];

  const daily = aggregateByBucket(rows, dayBuckets(14));
  const weekly = aggregateByBucket(rows, weekBuckets(8));
  const monthly = aggregateByBucket(rows, monthBuckets(6));

  const perUser = [...aggregateByUser(rows).entries()]
    .map(([id, stat]) => ({ id, email: emailByUserId.get(id) ?? "(알 수 없음)", ...stat }))
    .sort((a, b) => b.count - a.count);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-8">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">접속 통계</h1>
        <Link href="/admin" className="text-sm text-zinc-600 underline dark:text-zinc-400">
          관리자 화면으로
        </Link>
      </header>

      <p className="-mt-4 text-xs text-zinc-500 dark:text-zinc-400">
        &ldquo;접속자수&rdquo;는 별도 로그인 기록이 아니라, 해당 기간에 질문을 1건 이상 남긴 사용자 수(순사용자)를 뜻합니다.
        <span className="mx-1 inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm bg-zinc-900 dark:bg-zinc-100" /> 질문 수
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm bg-amber-500" /> 활성 사용자 수
        </span>
      </p>

      <section>
        <h2 className="mb-3 text-sm font-medium text-zinc-500 dark:text-zinc-400">일간 (최근 14일)</h2>
        <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <BarChart data={daily} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-zinc-500 dark:text-zinc-400">주간 (최근 8주)</h2>
        <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <BarChart data={weekly} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-zinc-500 dark:text-zinc-400">월간 (최근 6개월)</h2>
        <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <BarChart data={monthly} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-zinc-500 dark:text-zinc-400">사용자별 사용량 (최근 180일)</h2>
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-2">이메일</th>
                <th className="px-4 py-2">질문 수</th>
                <th className="px-4 py-2">마지막 활동</th>
              </tr>
            </thead>
            <tbody>
              {perUser.map((u) => (
                <tr key={u.id} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="px-4 py-2">{u.email}</td>
                  <td className="px-4 py-2">{u.count}</td>
                  <td className="px-4 py-2 text-zinc-500">{new Date(u.lastActive).toLocaleString("ko-KR")}</td>
                </tr>
              ))}
              {perUser.length === 0 && (
                <tr>
                  <td className="px-4 py-3 text-zinc-400" colSpan={3}>
                    아직 기록된 질문이 없습니다.
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
