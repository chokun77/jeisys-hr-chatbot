// 관리자 접속통계 화면(집계 로직). 실제 "로그인 이벤트"는 별도로 기록하지 않으므로
// (auth.users 접근에는 service_role 키가 필요하고, 이 프로젝트는 그 키를 쓰지 않기로 했다 —
// SUPABASE_PLAN.md 3번 결정), "접속자수"는 "해당 기간에 질문을 1건 이상 남긴 사용자 수"로 근사한다.

export type UsageRow = { user_id: string; created_at: string };

export type Bucket = { label: string; start: Date; end: Date };

export type BucketStat = { label: string; questions: number; activeUsers: number };

// 최근 N일을 하루 단위로 나눈다 (오늘 포함, 과거 방향).
export function dayBuckets(count: number, today: Date = new Date()): Bucket[] {
  const buckets: Bucket[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const start = new Date(today);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - i);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    buckets.push({ label: `${start.getMonth() + 1}/${start.getDate()}`, start, end });
  }
  return buckets;
}

// 최근 N주를 7일 단위로 나눈다.
export function weekBuckets(count: number, today: Date = new Date()): Bucket[] {
  const buckets: Bucket[] = [];
  const base = new Date(today);
  base.setHours(0, 0, 0, 0);
  base.setDate(base.getDate() + 1); // 오늘을 포함하도록 끝 경계를 하루 뒤로
  for (let i = count - 1; i >= 0; i--) {
    const end = new Date(base);
    end.setDate(end.getDate() - i * 7);
    const start = new Date(end);
    start.setDate(start.getDate() - 7);
    buckets.push({ label: `${start.getMonth() + 1}/${start.getDate()}~`, start, end });
  }
  return buckets;
}

// 최근 N개월을 달력월 단위로 나눈다.
export function monthBuckets(count: number, today: Date = new Date()): Bucket[] {
  const buckets: Bucket[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const start = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const end = new Date(today.getFullYear(), today.getMonth() - i + 1, 1);
    buckets.push({ label: `${start.getFullYear()}.${start.getMonth() + 1}`, start, end });
  }
  return buckets;
}

// 사용자 질문(role='user') 행들을 버킷별로 집계한다: 질문 수, 순사용자 수.
export function aggregateByBucket(rows: UsageRow[], buckets: Bucket[]): BucketStat[] {
  return buckets.map(({ label, start, end }) => {
    const inBucket = rows.filter((r) => {
      const t = new Date(r.created_at);
      return t >= start && t < end;
    });
    return {
      label,
      questions: inBucket.length,
      activeUsers: new Set(inBucket.map((r) => r.user_id)).size,
    };
  });
}

// 사용자별 총 질문 수 + 마지막 활동 시각.
export function aggregateByUser(rows: UsageRow[]): Map<string, { count: number; lastActive: string }> {
  const map = new Map<string, { count: number; lastActive: string }>();
  for (const r of rows) {
    const existing = map.get(r.user_id);
    if (!existing) {
      map.set(r.user_id, { count: 1, lastActive: r.created_at });
    } else {
      existing.count += 1;
      if (r.created_at > existing.lastActive) existing.lastActive = r.created_at;
    }
  }
  return map;
}
