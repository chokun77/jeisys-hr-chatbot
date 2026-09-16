// @jeisys.com 도메인 검증. 이건 UX용(사용자에게 빠른 에러 메시지)일 뿐,
// 실제 방어선은 Supabase의 before-user-created Auth Hook이다 — 이 함수만으로는
// 가입 자체를 막을 수 없다(가입 경로는 관리자가 대시보드에서 직접 만드는 방식이라 애초에 없음).
export function isAllowedCompanyEmail(email: string): boolean {
  return /^[^\s@]+@jeisys\.com$/i.test(email);
}
