"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isAllowedCompanyEmail } from "@/lib/auth/domain";

export type LoginState = { error: string | null };

export async function signIn(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!isAllowedCompanyEmail(email)) {
    return { error: "사내 이메일(@jeisys.com)로만 로그인할 수 있습니다." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Supabase 원본 에러 메시지를 그대로 노출하지 않는다(어떤 계정이 존재하는지 추측 가능해지는 걸 막기 위함).
    return { error: "이메일 또는 비밀번호가 올바르지 않습니다." };
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
