"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { signOut } from "@/app/login/actions";
import type { Message } from "@/lib/chat-types";

type SessionSummary = {
  id: string;
  title: string | null;
  updated_at: string;
};

type Props = {
  userEmail: string;
  role: "user" | "admin";
  initialSessionId: string | null;
  initialMessages: Message[];
  initialSessions: SessionSummary[];
};

// 데모용 예시 질문 — 클릭하면 바로 질문이 전송된다.
const EXAMPLE_QUESTIONS = [
  "연차는 며칠까지 쓸 수 있나요?",
  "통신비는 얼마나 지원되나요?",
  "병가는 어떻게 신청하나요?",
  "출산휴가는 며칠인가요?",
];

function formatRelativeTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "방금 전";
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  return `${Math.round(diffHour / 24)}일 전`;
}

export default function ChatClient({ userEmail, role, initialSessionId, initialMessages, initialSessions }: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId);
  const [sessions, setSessions] = useState<SessionSummary[]>(initialSessions);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const supabase = useRef(createClient());

  async function refreshSessions() {
    const { data } = await supabase.current
      .from("chat_sessions")
      .select("id, title, updated_at")
      .order("updated_at", { ascending: false })
      .limit(5);
    if (data) setSessions(data as SessionSummary[]);
  }

  async function ask(question: string) {
    if (!question.trim() || loading) return;

    // 후속 질문("그럼 병가는요?")의 맥락 파악용 폴백 — 서버가 sessionId로 DB 조회에 실패했을 때만 쓰인다.
    const history = messages.slice(-6);

    setMessages((prev) => [...prev, { role: "user", text: question }]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, sessionId, history }),
      });

      if (response.status === 401) {
        // 세션이 끊긴 상태 — 클라이언트 라우터 캐시와 상관없이 확실히 로그인 화면으로 보낸다.
        window.location.assign("/login");
        return;
      }

      const data = await response.json();

      setMessages((prev) => [
        ...prev,
        {
          role: "bot",
          text: data.answer ?? "답변을 가져오지 못했습니다.",
          sources: data.sources ?? [],
          handoff: data.handoff,
        },
      ]);
      if (data.sessionId) setSessionId(data.sessionId);
      refreshSessions();
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "bot", text: "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.", handoff: true },
      ]);
    } finally {
      setLoading(false);
      requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
    }
  }

  function startNewConversation() {
    setMessages([]);
    setSessionId(null);
    setSidebarOpen(false);
  }

  async function openSession(id: string) {
    const { data } = await supabase.current
      .from("chat_messages")
      .select("role, text, sources, handoff")
      .eq("session_id", id)
      .order("seq", { ascending: true });
    setMessages((data ?? []) as Message[]);
    setSessionId(id);
    setSidebarOpen(false);
  }

  async function deleteSession(id: string, event: React.MouseEvent) {
    event.stopPropagation();
    await supabase.current.from("chat_sessions").delete().eq("id", id);
    if (id === sessionId) startNewConversation();
    refreshSessions();
  }

  useEffect(() => {
    refreshSessions();
  }, []);

  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 dark:bg-zinc-950">
      <div className="flex w-full max-w-3xl flex-1 flex-col px-4 py-6 sm:py-10">
        <header className="mb-6 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              Jessica
            </h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              인사·복지·오피스 환경·근무지원 제도를 사내 규정과 공지사항에 근거해 안내해 드려요.
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5 text-right">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">{userEmail}</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSidebarOpen((v) => !v)}
                className="rounded-lg border border-zinc-300 px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                대화 목록
              </button>
              <button
                onClick={startNewConversation}
                className="rounded-lg border border-zinc-300 px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                새 대화
              </button>
              {role === "admin" && (
                <Link
                  href="/admin"
                  className="rounded-lg border border-amber-300 px-2.5 py-1 text-xs text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-900/20"
                >
                  관리자
                </Link>
              )}
              <form action={signOut}>
                <button className="rounded-lg border border-zinc-300 px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
                  로그아웃
                </button>
              </form>
            </div>
          </div>
        </header>

        {sidebarOpen && (
          <div className="mb-4 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              최근 대화 (최대 5개까지 저장됩니다)
            </p>
            {sessions.length === 0 && (
              <p className="text-sm text-zinc-400 dark:text-zinc-500">저장된 대화가 없습니다.</p>
            )}
            <ul className="space-y-1">
              {sessions.map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => openSession(s.id)}
                    className={
                      "group flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800" +
                      (s.id === sessionId ? " bg-zinc-100 dark:bg-zinc-800" : "")
                    }
                  >
                    <span className="truncate text-zinc-800 dark:text-zinc-200">{s.title || "(제목 없음)"}</span>
                    <span className="ml-2 flex shrink-0 items-center gap-2 text-xs text-zinc-400">
                      {formatRelativeTime(s.updated_at)}
                      <span
                        onClick={(e) => deleteSession(s.id, e)}
                        className="hidden rounded px-1 text-red-500 hover:bg-red-50 group-hover:inline dark:hover:bg-red-900/20"
                      >
                        삭제
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          {messages.length === 0 && (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                궁금한 회사생활 제도를 물어보세요. 아래 예시를 눌러도 됩니다.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {EXAMPLE_QUESTIONS.map((question) => (
                  <button
                    key={question}
                    onClick={() => ask(question)}
                    className="rounded-full border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message, index) => (
            <div
              key={index}
              className={message.role === "user" ? "flex justify-end" : "flex justify-start"}
            >
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
                          {source.channel && (
                            <span className="mr-1 rounded bg-amber-100 px-1 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-400">
                              공지
                            </span>
                          )}
                          {source.title} · {source.category} · {source.channel ? "공지일" : "개정"} {source.updatedAt}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {message.handoff && (
                  <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-500">
                    인사팀 문의가 필요한 질문입니다.
                  </p>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-zinc-100 px-4 py-2.5 text-sm text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                규정을 확인하는 중…
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            ask(input);
          }}
          className="mt-4 flex gap-2"
        >
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              // 한글 입력 조합 중의 Enter는 무시하고, 그 외에는 바로 질문을 보낸다.
              if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
              event.preventDefault();
              ask(input);
            }}
            placeholder="예: 연차는 며칠까지 쓸 수 있나요?"
            className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="shrink-0 whitespace-nowrap rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
          >
            질문
          </button>
        </form>

        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-500">
          POC 버전입니다. 답변은 등록된 사내 규정 문서에 근거하며, 확인되지 않는 내용은 인사팀 문의로 안내합니다.
          대화 내용은 최근 5개까지 저장되며, 관리자 권한 계정은 전체 임직원의 대화를 열람할 수 있습니다.
        </p>
      </div>
    </div>
  );
}
