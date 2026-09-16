import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

// 관리자 전용 화면 진입 전 확인. 관리자가 아니면 조용히 홈으로 돌려보낸다.
// 실제 방어선은 DB의 RLS(9번 스키마 참고)이고, 이 함수는 UX용 1차 관문이다.
export async function requireAdmin(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase.from("profiles").select("role").eq("id", userId).single();
  if (data?.role !== "admin") redirect("/");
  return data;
}
