"use client";

import { useRef, useState } from "react";

type Source = {
  title: string;
  category: string;
  updatedAt: string;
};

type Message = {
  role: "user" | "bot";
  text: string;
  sources?: Source[];
  handoff?: boolean;
};

// 데모용 예시 질문 — 클릭하면 바로 질문이 전송된다.
const EXAMPLE_QUESTIONS = [
  "육아휴직은 몇 개월까지 쓸 수 있나요?",
  "재택근무는 주 며칠까지 가능한가요?",
  "경조사 지원금은 얼마인가요?",
  "교육비는 얼마까지 지원되나요?",
];

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function ask(question: string) {
    if (!question.trim() || loading) return;

    setMessages((prev) => [...prev, { role: "user", text: question }]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
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

  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 dark:bg-zinc-950">
      <div className="flex w-full max-w-3xl flex-1 flex-col px-4 py-6 sm:py-10">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Jeisian 회사생활 도우미
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            인사·복지·오피스 환경·근무지원 제도를 사내 규정과 공지사항에 근거해 안내합니다.
          </p>
        </header>

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
                          {source.title} · {source.category} · 개정 {source.updatedAt}
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
          POC 버전입니다. 답변은 등록된 샘플 규정에 근거하며, 확인되지 않는 내용은 인사팀 문의로 안내합니다.
        </p>
      </div>
    </div>
  );
}
