-- 규정·공지사항 지식베이스(챗봇 검색 원본)를 Supabase에 저장한다.
-- 지금까지 src/data/regulations, src/data/announcements의 정적 TS 파일에 있던 내용을
-- 이 테이블로 옮기고, 앱은 이 테이블을 실제 검색 원본으로 사용한다.
create table if not exists public.knowledge_base (
  id          text primary key,
  title       text not null,
  category    text not null,
  keywords    text[] not null default '{}',
  content     text not null,
  updated_at  text not null,
  valid_until text,
  channel     text,
  recurring   boolean not null default false
);

alter table public.knowledge_base enable row level security;

-- 로그인한 임직원이라면 누구나 전체 항목을 읽을 수 있다(개인 데이터가 아니라 회사 공용 규정이므로
-- user_id 기반 제한이 필요 없다). 쓰기 정책은 두지 않는다 — 내용 갱신은 SQL Editor/마이그레이션으로만 한다.
drop policy if exists "knowledge_base_select_authenticated" on public.knowledge_base;
create policy "knowledge_base_select_authenticated" on public.knowledge_base
  for select to authenticated using (true);
