import { regulations, type Regulation } from "@/data/regulations";

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

// POC 단계에서는 사내 인사팀 문의 채널을 상수로 둔다. 실제 운영 시 실제 채널 정보로 교체한다.
export const HR_CONTACT = "인사팀 (사내 메신저 '인사팀' 또는 인사팀 대표 메일)";

export type SearchResult = {
  regulation: Regulation;
  score: number;
};

// 한국어 질문에서 조사를 대략 제거해 검색어를 뽑는다. POC용 단순 처리.
function tokenize(question: string): string[] {
  const cleaned = question.replace(/[^가-힣a-zA-Z0-9\s]/g, " ");
  return cleaned
    .split(/\s+/)
    .map((word) => word.replace(/(은|는|이|가|을|를|의|에|에서|으로|로|와|과|도|만|까지|부터)$/, ""))
    .filter((word) => word.length >= 2);
}

// 질문이 민감 사안에 해당하는지 확인한다.
export function isSensitiveQuestion(question: string): boolean {
  return SENSITIVE_KEYWORDS.some((keyword) => question.includes(keyword));
}

// 키워드 일치 점수로 관련 규정을 찾는다. POC라 벡터 검색 대신 단순 키워드 매칭을 사용한다.
export function searchRegulations(question: string, limit = 3): SearchResult[] {
  const tokens = tokenize(question);
  if (tokens.length === 0) return [];

  const scored = regulations.map((regulation) => {
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
