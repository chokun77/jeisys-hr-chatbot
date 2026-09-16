"use client";

import { useActionState } from "react";
import { signIn, type LoginState } from "./actions";

const initialState: LoginState = { error: null };

export default function LoginForm() {
  const [state, formAction, pending] = useActionState(signIn, initialState);

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-3">
      <div>
        <label htmlFor="email" className="mb-1 block text-sm text-zinc-700 dark:text-zinc-300">
          이메일
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="username"
          placeholder="name@jeisys.com"
          className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-1 block text-sm text-zinc-700 dark:text-zinc-300">
          비밀번호
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
      </div>

      {state.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="mt-1 rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {pending ? "로그인 중…" : "로그인"}
      </button>
    </form>
  );
}
