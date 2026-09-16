-- 로그인 사용자 역할(관리자/일반) + 대화 기록(최근 5개 세션) 저장용 스키마.
-- PRD/CLAUDE.md 원칙: 급여·평가 등 인사 개인정보는 다루지 않으며, 저장 항목은
-- user_id·텍스트·근거문서·이관여부·시각뿐이다.

-- 사용자 역할 저장용. auth.users는 publishable key로 직접 조회할 수 없어(auth 스키마 미노출),
-- 이메일 표시·권한 분기에 필요한 최소 정보만 별도 테이블에 복제해 둔다.
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  role       text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz not null default now()
);

-- 관리자가 대시보드에서 계정을 만들 때마다 자동으로 profiles 행을 만든다(기본 role='user').
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS 정책 안에서 "이 요청자가 관리자인가"를 안전하게 확인하기 위한 헬퍼.
-- security definer로 만들어야 profiles 자체의 RLS와 순환 참조 없이 동작한다.
create or replace function public.is_admin()
returns boolean
language sql
security definer set search_path = ''
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

create table if not exists public.chat_sessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  title      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create index if not exists chat_sessions_user_updated_idx
  on public.chat_sessions (user_id, updated_at desc);

create table if not exists public.chat_messages (
  id         uuid primary key default gen_random_uuid(),
  seq        bigint generated always as identity,
  session_id uuid not null,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null check (role in ('user','bot')),
  text       text not null,
  sources    jsonb not null default '[]'::jsonb,
  handoff    boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (session_id, user_id)
    references public.chat_sessions (id, user_id) on delete cascade
);
create index if not exists chat_messages_session_seq_idx
  on public.chat_messages (session_id, seq);

alter table public.profiles enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_select_admin_all" on public.profiles;
create policy "profiles_select_own" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "profiles_select_admin_all" on public.profiles for select to authenticated using (public.is_admin());

drop policy if exists "sessions_select_own" on public.chat_sessions;
drop policy if exists "sessions_select_admin_all" on public.chat_sessions;
drop policy if exists "sessions_insert_own" on public.chat_sessions;
drop policy if exists "sessions_update_own" on public.chat_sessions;
drop policy if exists "sessions_delete_own" on public.chat_sessions;
create policy "sessions_select_own" on public.chat_sessions for select to authenticated using ((select auth.uid()) = user_id);
create policy "sessions_select_admin_all" on public.chat_sessions for select to authenticated using (public.is_admin());
create policy "sessions_insert_own" on public.chat_sessions for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "sessions_update_own" on public.chat_sessions for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "sessions_delete_own" on public.chat_sessions for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "messages_select_own" on public.chat_messages;
drop policy if exists "messages_select_admin_all" on public.chat_messages;
drop policy if exists "messages_insert_own" on public.chat_messages;
drop policy if exists "messages_delete_own" on public.chat_messages;
create policy "messages_select_own" on public.chat_messages for select to authenticated using ((select auth.uid()) = user_id);
create policy "messages_select_admin_all" on public.chat_messages for select to authenticated using (public.is_admin());
create policy "messages_insert_own" on public.chat_messages for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "messages_delete_own" on public.chat_messages for delete to authenticated using ((select auth.uid()) = user_id);
-- messages에 UPDATE 정책은 의도적으로 두지 않는다: 지나간 기록은 수정할 이유가 없다.
-- 관리자 정책은 select(읽기)만 추가한다 — 관리자도 남의 대화를 대신 쓰거나 지우지는 못한다.
