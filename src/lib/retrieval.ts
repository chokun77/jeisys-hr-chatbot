import type { SupabaseClient } from "@supabase/supabase-js";
import { announcements } from "@/data/announcements";
import { regulations, type Regulation } from "@/data/regulations";

// 실제 검색 원본은 Supabase의 knowledge_base 테이블이다(regulations/announcements 정적 파일에서 이전).
// 정적 배열은 DB 조회가 실패했을 때만 쓰는 오프라인 폴백으로 남겨둔다 — 저장 인프라가 잠깐 죽어도
// 챗봇이 완전히 먹통이 되지 않도록 하기 위함(chat-history.ts의 "저장 실패는 답변을 막지 않는다"와 같은 원칙).
const fallbackKnowledgeBase: Regulation[] = [...regulations, ...announcements];

// 개인별 판단이 필요하거나 민감한 사안 — PRD must-2에 따라 챗봇이 자체 판단하지 않고 인사팀으로 안내한다.
const SENSITIVE_KEYWORDS = [
  "징계",
  "해고",
  "권고사직",
  "퇴사 처리",
  "이의제기",
  "이의신청",
  "급여 오류",
  "임금체불",
  "성희롱",
  "괴롭힘",
  "고충",
  "신고",
  "소송",
  "평가 불복",
  "연봉 협상",
];

export type SearchResult = {
  regulation: Regulation;
  score: number;
};

// 거의 모든 질문·규정에 등장해 검색 신호로 쓸모없는 범용 단어.
// 예: "지원"은 "근무지원" 카테고리명과 "지원금" 등 대부분의 복지 규정 키워드에 우연히 겹쳐 있어,
// 걸러내지 않으면 실제로 관련 없는 규정이 점수만 높아져 상위로 올라온다.
const STOPWORDS = new Set([
  "지원", "지원금", "지원돼요", "지원되나요", "지원되나",
  "얼마", "얼마나", "얼마까지", "얼마예요",
  "며칠", "몇개월", "몇일", "언제",
  "어떻게", "되나요", "하나요", "받나요", "가능한가요", "있나요", "되는지",
  "문의", "궁금", "알려주세요",
]);

// 한국어 질문에서 조사를 대략 제거해 검색어를 뽑는다. POC용 단순 처리.
function tokenize(question: string): string[] {
  const cleaned = question.replace(/[^가-힣a-zA-Z0-9\s]/g, " ");
  return cleaned
    .split(/\s+/)
    .map((word) => word.replace(/(은|는|이|가|을|를|의|에|에서|으로|로|와|과|도|만|까지|부터)$/, ""))
    .filter((word) => word.length >= 2 && !STOPWORDS.has(word));
}

// 질문이 민감 사안에 해당하는지 확인한다.
export function isSensitiveQuestion(question: string): boolean {
  return SENSITIVE_KEYWORDS.some((keyword) => question.includes(keyword));
}

// 제메티·콘도 신청처럼 매월/분기 반복되는 제도는, 이번 회차가 마감된 뒤에도 "신청 방식이
// 이렇게 반복된다"를 설명할 수 있도록 validUntil이 지나고도 한동안 검색 대상에 남겨둔다.
const RECURRING_GRACE_DAYS = 90;

// 공지사항의 유효기간이 지났는지 확인한다. 규정처럼 validUntil이 없는 항목은 항상 유효하다.
function isActive(regulation: Regulation, today: Date): boolean {
  if (!regulation.validUntil) return true;
  const cutoff = new Date(regulation.validUntil);
  if (regulation.recurring) {
    cutoff.setDate(cutoff.getDate() + RECURRING_GRACE_DAYS);
  }
  return cutoff >= today;
}

// knowledge_base 테이블에서 전체 항목을 읽어온다. 실패하면(네트워크 오류, 아직 시딩 전 등)
// 정적 파일 폴백을 사용한다 — 검색 자체가 죽어버리는 것보다는 낫다.
async function loadKnowledgeBase(supabase: SupabaseClient): Promise<Regulation[]> {
  try {
    const { data, error } = await supabase.from("knowledge_base").select("*");
    if (error || !data || data.length === 0) return fallbackKnowledgeBase;
    return data.map((row) => ({
      id: row.id as string,
      title: row.title as string,
      category: row.category as Regulation["category"],
      keywords: (row.keywords ?? []) as string[],
      content: row.content as string,
      updatedAt: row.updated_at as string,
      validUntil: (row.valid_until as string | null) ?? undefined,
      channel: (row.channel as string | null) ?? undefined,
      recurring: (row.recurring as boolean | null) ?? undefined,
    }));
  } catch {
    return fallbackKnowledgeBase;
  }
}

// 키워드 일치 점수로 관련 규정·공지사항을 찾는다. POC라 벡터 검색 대신 단순 키워드 매칭을 사용한다.
export async function searchRegulations(
  supabase: SupabaseClient,
  question: string,
  limit = 6,
  today: Date = new Date(),
): Promise<SearchResult[]> {
  const tokens = tokenize(question);
  if (tokens.length === 0) return [];

  const knowledgeBase = await loadKnowledgeBase(supabase);

  const scored = knowledgeBase.filter((regulation) => isActive(regulation, today)).map((regulation) => {
    let score = 0;
    // 본문에 흔한 단어가 우연히 겹친 경우를 걸러내려고 주제어 일치를 따로 센다.
    let topicMatch = 0;

    for (const token of tokens) {
      // 등록된 키워드와 겹치면 가중치를 높게 준다.
      if (regulation.keywords.some((keyword) => keyword.includes(token) || token.includes(keyword))) {
        score += 3;
        topicMatch += 1;
      }
      if (regulation.title.includes(token)) {
        score += 2;
        topicMatch += 1;
      }
      if (regulation.category.includes(token)) score += 2;
      if (regulation.content.includes(token)) score += 1;
    }

    return { regulation, score, topicMatch };
  });

  return scored
    .filter((result) => result.topicMatch > 0 && result.score >= 3)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ regulation, score }) => ({ regulation, score }));
}
