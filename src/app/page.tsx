import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadRecentSessionForRestore, listRecentSessions } from "@/lib/chat-history";
import ChatClient from "./chat-client";

export default async function Home() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  // proxy가 이미 막았겠지만, 이 페이지 단독으로도 방어적으로 한 번 더 확인한다.
  if (!claims?.claims) redirect("/login");

  const userId = claims.claims.sub as string;
  const userEmail = (claims.claims.email as string | undefined) ?? "";

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).single();
  const role = profile?.role === "admin" ? "admin" : "user";

  const [restored, sessions] = await Promise.all([
    loadRecentSessionForRestore(supabase, userId),
    listRecentSessions(supabase, userId),
  ]);

  return (
    <ChatClient
      userEmail={userEmail}
      role={role}
      initialSessionId={restored?.sessionId ?? null}
      initialMessages={restored?.messages ?? []}
      initialSessions={sessions as { id: string; title: string | null; updated_at: string }[]}
    />
  );
}
