import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import type { Message } from "@/lib/chat-types";

export default async function AdminSessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) redirect("/login");
  const userId = claims.claims.sub as string;

  await requireAdmin(supabase, userId);

  const [{ data: session }, { data: messages }] = await Promise.all([
    supabase.from("chat_sessions").select("id, user_id, title, updated_at").eq("id", id).single(),
    supabase
      .from("chat_messages")
      .select("role, text, sources, handoff")
      .eq("session_id", id)
      .order("seq", { ascending: true }),
  ]);

  const { data: profile } = session
    ? await supabase.from("profiles").select("email").eq("id", session.user_id as string).single()
    : { data: null };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {(session?.title as string) || "(제목 없음)"}
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {profile?.email ?? "(알 수 없음)"} · 읽기 전용
          </p>
        </div>
        <Link href="/admin" className="text-sm text-zinc-600 underline dark:text-zinc-400">
          관리자 화면으로
        </Link>
      </header>

      <div className="flex flex-1 flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        {((messages ?? []) as Message[]).map((message, index) => (
          <div key={index} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={
                message.role === "user"
                  ? "max-w-[85%] rounded-2xl bg-zinc-900 px-4 py-2.5 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "max-w-[85%] rounded-2xl bg-zinc-100 px-4 py-2.5 text-sm text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
              }
            >
              <p className="whitespace-pre-wrap leading-relaxed">{message.text}</p>
              {message.sources && message.sources.length > 0 && (
                <div className="mt-3 border-t border-zinc-300 pt-2 dark:border-zinc-700">
                  <p className="mb-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">근거 문서</p>
                  <ul className="space-y-0.5">
                    {message.sources.map((source) => (
                      <li key={source.title} className="text-xs text-zinc-600 dark:text-zinc-400">
                        {source.title} · {source.category} · {source.updatedAt}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ))}
        {(messages ?? []).length === 0 && <p className="text-sm text-zinc-400">메시지가 없습니다.</p>}
      </div>
    </div>
  );
}
