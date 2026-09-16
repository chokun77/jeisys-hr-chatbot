-- before-user-created Auth Hook: @jeisys.com 외 도메인 가입 차단 (2차 방어선).
-- 앱에 자율 가입 화면 자체가 없지만, 나중에 실수로 가입을 열어도 이 함수가 막아준다.
create or replace function public.restrict_signup_domain(event jsonb)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_email  text := lower(event -> 'user' ->> 'email');
  v_domain text := split_part(v_email, '@', 2);
begin
  if v_email is null or v_domain <> 'jeisys.com' then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 403,
      'message', '사내 이메일(@jeisys.com) 계정만 가입할 수 있습니다.'
    ));
  end if;
  return '{}'::jsonb;
end;
$$;

grant execute on function public.restrict_signup_domain to supabase_auth_admin;
revoke execute on function public.restrict_signup_domain from anon, authenticated, public;
