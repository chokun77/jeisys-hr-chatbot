import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LoginForm from "./login-form";

export default async function LoginPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims) redirect("/");

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Jessica
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          사내 임직원 계정(@jeisys.com)으로 로그인해 주세요.
        </p>
      </div>
      <LoginForm />
    </div>
  );
}
