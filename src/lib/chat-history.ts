import type { SupabaseClient } from "@supabase/supabase-js";
import type { Message, Source } from "@/lib/chat-types";

// 사용자당 최근 5개 대화 세션만 유지한다(개인정보 최소 보관 원칙).
const MAX_SESSIONS_PER_USER = 5;

// 새로고침 시 자동 복원할 세션의 최대 나이. 그보다 오래됐으면 빈 화면으로 시작한다.
const AUTO_RESTORE_HOURS = 24;

type SaveTurnInput = {
  question: string;
  answer: string;
  sources: Source[];
  handoff: boolean;
};

// 세션이 5개를 넘으면 오래된 것부터 지운다. 실패해도 절대 throw하지 않는다 —
// 정리 실패가 챗봇 답변을 막으면 안 되고, 다음 저장 때 다시 시도된다.
async function pruneOldSessions(supabase: SupabaseClient, userId: string) {
  try {
    const { data: keep } = await supabase
      .from("chat_sessions")
      .select("id")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(MAX_SESSIONS_PER_USER);

    const keepIds = (keep ?? []).map((s) => s.id as string);
    if (keepIds.length === 0) return;

    await supabase
      .from("chat_sessions")
      .delete()
      .eq("user_id", userId)
      .not("id", "in", `(${keepIds.join(",")})`);
    // chat_messages는 FK on delete cascade로 함께 삭제된다.
  } catch {
    // 정리 실패는 무시한다.
  }
}

// 한 턴(질문+답변)을 저장한다. sessionId가 없으면 새 세션을 만든다.
// 실패해도 throw하지 않고 null을 반환한다 — 저장 실패가 챗봇 답변 자체를 막지 않는다.
export async function saveTurnSafely(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string | null,
  turn: SaveTurnInput,
): Promise<string | null> {
  try {
    let resolvedSessionId = sessionId;

    if (!resolvedSessionId) {
      const title = turn.question.slice(0, 40);
      const { data, error } = await supabase
        .from("chat_sessions")
        .insert({ user_id: userId, title })
        .select("id")
        .single();
      if (error || !data) return null;
      resolvedSessionId = data.id as string;
    } else {
      await supabase
        .from("chat_sessions")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", resolvedSessionId)
        .eq("user_id", userId);
    }

    await supabase.from("chat_messages").insert([
      { session_id: resolvedSessionId, user_id: userId, role: "user", text: turn.question },
      {
        session_id: resolvedSessionId,
        user_id: userId,
        role: "bot",
        text: turn.answer,
        sources: turn.sources,
        handoff: turn.handoff,
      },
    ]);

    await pruneOldSessions(supabase, userId);

    return resolvedSessionId;
  } catch {
    return null;
  }
}

// route.ts에서 후속 질문 맥락(history)을 만들 때, sessionId가 있으면 DB에서 최근 메시지를 읽어온다.
// 실패하면 null을 반환해 호출자가 클라이언트가 보낸 history로 폴백할 수 있게 한다.
export async function loadHistory(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
  limit: number,
): Promise<Message[] | null> {
  try {
    const { data, error } = await supabase
      .from("chat_messages")
      .select("role, text, sources, handoff")
      .eq("session_id", sessionId)
      .eq("user_id", userId)
      .order("seq", { ascending: false })
      .limit(limit);
    if (error || !data) return null;
    return data.reverse() as Message[];
  } catch {
    return null;
  }
}

// page.tsx(서버)에서 새로고침 시 복원할 "가장 최근 세션"을 찾는다.
// 마지막 활동이 AUTO_RESTORE_HOURS 이내가 아니면 복원하지 않는다(오래된 대화가 불쑥 뜨지 않도록).
export async function loadRecentSessionForRestore(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ sessionId: string; messages: Message[] } | null> {
  try {
    const { data: session } = await supabase
      .from("chat_sessions")
      .select("id, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!session) return null;

    const ageHours = (Date.now() - new Date(session.updated_at as string).getTime()) / 3_600_000;
    if (ageHours > AUTO_RESTORE_HOURS) return null;

    const { data: messages } = await supabase
      .from("chat_messages")
      .select("role, text, sources, handoff")
      .eq("session_id", session.id)
      .order("seq", { ascending: true });

    return { sessionId: session.id as string, messages: (messages ?? []) as Message[] };
  } catch {
    return null;
  }
}

// 사이드바 목록용 — 최근 세션 몇 개의 id/title/updated_at만 가볍게 가져온다.
export async function listRecentSessions(supabase: SupabaseClient, userId: string) {
  try {
    const { data } = await supabase
      .from("chat_sessions")
      .select("id, title, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(MAX_SESSIONS_PER_USER);
    return data ?? [];
  } catch {
    return [];
  }
}
