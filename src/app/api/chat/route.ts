import { tryCalculateAnnualLeaveFromQuestion } from "@/lib/annual-leave";
import { pickContact } from "@/lib/contacts";
import { isSensitiveQuestion, searchRegulations } from "@/lib/retrieval";
import { createClient } from "@/lib/supabase/server";
import { loadHistory, saveTurnSafely } from "@/lib/chat-history";
import type { Message, Source } from "@/lib/chat-types";

// 답변 생성 규칙 — PRD must-1 (근거 없는 추측 금지, 근거 문서명 표시)
const SYSTEM_PROMPT = `너는 제이시스메디칼 임직원들의 회사생활을 도와주는 상담사 "Jessica"다.
밝고 활기차며 상냥하지만, 회사 제도에 정통한 전문성 있는 상담사로서 믿음직하게 조언한다.

반드시 지킬 규칙:
1. 아래에 제공된 [규정 발췌]에 있는 숫자·조건만 근거로 삼는다. 발췌에 없는 수치나 조건을 지어내거나 일반 상식으로 보충하지 않는다.
2. 발췌 중 "(출처: ...)"가 붙은 항목은 정식 규정이 아니라 Teams 전사공지 등 사내 공지사항이다. 정식 규정과 섞어 답할 때는 "OO 공지에 따르면" 처럼 공지 내용임을 자연스럽게 알려준다.
3. 발췌에 있는 숫자·조건을 그대로 옮기는 것을 넘어, 질문에 필요한 계산(덧셈·곱셈·기간 환산 등)은 직접 수행해서 최종 답을 알려준다. 예: "1박 20만원"과 "2박 묵는다"는 정보가 있으면 "2박이면 40만원까지"라고 계산해서 답한다. 이런 계산은 "추측"이 아니라 "발췌 내용의 적용"이므로 규칙 1 위반이 아니다.
   - 계산에 쓴 조건(근속연수, 박수, 건수 등)은 질문자가 알려준 값이거나 발췌에 명시된 값이어야 한다. 그중 하나라도 발췌에 없으면 계산하지 말고 그 부분만 "확인되지 않음"으로 답한다.
   - 여러 조항의 조건을 조합해야 할 때는 각 조항의 조건을 하나씩 확인한 뒤 계산한다. 계산 과정에서 실수가 없도록 최종 숫자를 말하기 전에 속으로 다시 검산한다.
   - [계산된 값] 블록이 함께 제공되면, 그 값은 코드로 정확히 계산된 결과이니 절대 다시 계산하거나 다른 숫자로 고치지 말고 그대로 인용해서 자연스럽게 설명만 붙인다.
4. 질문에 대한 답(사실이든 계산 결과든)을 발췌 내용만으로 구할 수 없으면 "확인되지 않음, 인사팀 문의 필요"라고 답한다.
5. 개인별 판단이 필요한 사안(급여 이의제기, 징계 등)은 판단하지 말고 인사팀 문의를 안내한다.
6. 금액·기간·한도 같은 숫자와 조건 자체(단가, 한도, 일수 등 발췌에 적힌 값)는 절대 바꾸거나 지어내면 안 된다. 이 값들을 계산에 사용하는 것은 되지만, 값 자체를 다른 숫자로 착각해 말하면 안 된다.
7. 제메티·콘도 예약·시차출퇴근처럼 "매월/분기 신청받아 당첨자를 선정"하는 반복 제도의 공지는 특정 회차(예: "9/7~9/11 신청, 11~12월 이용")의 스냅샷이다. [오늘 날짜]와 비교해서 그 회차의 신청·이용 기간이 이미 지났다면, 그 날짜를 지금도 유효한 것처럼 답하지 말고 "그 회차는 마감되었고, 이 제도는 매월/분기 반복되니 최신 공지에서 정확한 신청 기간을 확인해야 한다"고 안내한다. 아직 지나지 않은 회차라면 발췌의 날짜를 그대로 안내한다.

페르소나·말투 지침 (사실관계와 위 규칙 1~7은 절대 바꾸지 않고, 말투와 태도에만 반영한다):
- 딱딱한 안내문이 아니라, 옆에서 챙겨주는 선배 상담사처럼 다정하게 말을 건다. "~하시면 돼요!", "제가 확인해 드릴게요" 처럼 밝고 친근한 표현을 자연스럽게 섞되, 이모티콘 남발이나 과도한 들뜸은 피하고 전문성 있는 신뢰감을 유지한다.
- 발췌 조항의 법률 문어체("~에 한한다", "~로 한다", "제1항" 같은 조항 번호 나열)를 그대로 베끼지 말고, 신뢰가 가면서도 친근한 구어체 존댓말로 풀어서 답한다.
- 여러 조항이 함께 제공되면 조항별로 나열하지 말고, 질문자가 실제로 궁금해할 순서로 자연스럽게 엮어서 설명한다.
- 3~6문장 정도로 답하되, 필요하면 조건이나 예외를 짧게 덧붙여도 된다. 너무 딱딱하게 끊어 말하지 않는다.
- 민감 사안 이관이나 "확인되지 않음" 같이 진지한 답변에서는 밝은 성격보다 차분하고 믿음직한 톤을 우선한다 — 발랄함이 진지함을 가볍게 만들면 안 된다.

대화 맥락: 이전 대화가 함께 제공되면 "그럼 병가는요?" 같은 후속 질문의 맥락(무엇을 이어 묻는지)을 파악하는 데만 참고한다.
답변의 근거는 항상 이번 턴에 새로 제공된 [규정 발췌]로 한정한다 — 이전 턴 답변에 있던 내용이라도 이번 발췌에 없으면 근거로 쓰지 않는다.`;

type ChatRequestBody = {
  question?: string;
  sessionId?: string | null;
  // 직전 대화 내역 (후속 질문 맥락 파악용). sessionId가 있으면 서버가 DB에서 다시 읽어오고,
  // 여기 보낸 값은 DB 조회가 실패했을 때의 폴백으로만 쓴다.
  history?: Message[];
};

// 대화가 길어져도 토큰이 과도하게 늘지 않도록 최근 몇 턴만 사용한다.
const MAX_HISTORY_MESSAGES = 6;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) {
    return Response.json(
      { error: "unauthenticated", answer: "로그인이 필요합니다. 다시 로그인해 주세요.", sources: [], handoff: false },
      { status: 401 },
    );
  }
  const userId = claims.claims.sub as string;

  const body = (await request.json()) as ChatRequestBody;
  const question = body.question?.trim();
  const sessionId = body.sessionId ?? null;

  if (!question) {
    return Response.json({ error: "질문 내용이 비어 있습니다." }, { status: 400 });
  }

  // sessionId가 있으면 DB에서 최근 대화를 다시 읽어와 history로 쓴다(클라이언트가 보낸 history는 무시 —
  // 조작된 대화 내역으로 시스템 프롬프트를 우회하는 경로도 함께 막힌다).
  // DB 조회가 실패하면 클라이언트가 보낸 history로 폴백해, 저장 인프라가 잠깐 죽어도 후속 질문 맥락이 끊기지 않게 한다.
  const dbHistory = sessionId ? await loadHistory(supabase, userId, sessionId, MAX_HISTORY_MESSAGES) : null;
  const history = (dbHistory ?? body.history ?? []).slice(-MAX_HISTORY_MESSAGES);

  // 한 턴을 저장하고 공통 형식으로 응답한다. 저장은 절대 답변 자체를 막지 않는다(saveTurnSafely가 throw하지 않음).
  async function respond(
    answer: string,
    sources: Source[],
    handoff: boolean,
    status = 200,
  ) {
    const newSessionId = await saveTurnSafely(supabase, userId, sessionId, {
      question: question!, // 이 시점엔 이미 위에서 빈 질문을 걸러낸 뒤라 항상 문자열이다
      answer,
      sources,
      handoff,
    });
    return Response.json({ answer, sources, handoff, sessionId: newSessionId }, { status });
  }

  // must-2: 민감 사안은 자체 판단 없이 인사팀으로 안내한다.
  if (isSensitiveQuestion(question)) {
    return respond(
      `해당 사안은 개인별 상황 확인이 필요해 챗봇이 판단하지 않습니다. ${pickContact(question)}으로 문의해 주세요.`,
      [],
      true,
    );
  }

  // "그럼 병가는요?" 같은 후속 질문은 그 자체로 검색어가 부족할 수 있어, 직전 사용자 질문을 함께 검색어로 쓴다.
  const previousQuestion = [...history].reverse().find((m) => m.role === "user")?.text ?? "";
  const searchQuery = previousQuestion ? `${previousQuestion} ${question}` : question;

  const results = await searchRegulations(supabase, searchQuery);

  // must-1: 근거 문서를 찾지 못하면 추측하지 않는다.
  if (results.length === 0) {
    return respond(
      `확인되지 않음, 인사팀 문의 필요 — 관련 규정이나 공지사항을 찾지 못했습니다. ${pickContact(question)}으로 문의해 주세요.`,
      [],
      true,
    );
  }

  // AI에게는 계산에 쓸 수 있도록 검색된 조항을 전부 전달하되, 화면에 "근거 문서"로 표시하는 것은
  // 상위 점수와 차이가 큰(동점 채우기용) 조항을 걸러내 실제로 관련된 것만 보여준다.
  const excerpts = results
    .map(({ regulation }) => {
      const sourceNote = regulation.channel ? `, 출처: ${regulation.channel}` : "";
      return `[${regulation.title}] (${regulation.category}, 개정일 ${regulation.updatedAt}${sourceNote})\n${regulation.content}`;
    })
    .join("\n\n");

  // 연차 가산일수 계산은 LLM이 산수를 틀리는 경우가 있어 코드로 직접 계산해 정답을 고정한다.
  // "연차" 관련 질문에서만 시도하며, "6년차인데" 처럼 근속연수를 이전 턴에 말했을 수도 있어 searchQuery(이전 질문 포함)를 본다.
  const annualLeaveCalc = searchQuery.includes("연차") ? tryCalculateAnnualLeaveFromQuestion(searchQuery) : null;
  const calculatedBlock = annualLeaveCalc
    ? `\n\n[계산된 값] ${annualLeaveCalc.breakdown} → 총 ${annualLeaveCalc.days}일`
    : "";

  const topScore = results[0].score;
  const displaySources = results.filter(({ score }) => score >= topScore * 0.7);

  const sources = displaySources.map(({ regulation }) => ({
    title: regulation.title,
    category: regulation.category,
    updatedAt: regulation.updatedAt,
    channel: regulation.channel,
  }));

  const apiKey = process.env.OPENAI_API_KEY;

  // API 키가 없어도 POC 동작을 확인할 수 있도록 규정 원문을 그대로 보여준다.
  if (!apiKey) {
    return respond(
      `AI 응답 키가 설정되지 않아 규정 원문을 그대로 안내합니다.\n\n${excerpts}${calculatedBlock}`,
      sources,
      false,
    );
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        // 이전 턴은 대화 맥락(무엇을 이어 묻는지) 파악용으로만 포함하고, 근거 발췌는 이번 턴 것만 준다.
        ...history.map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.text ?? "" })),
        {
          role: "user",
          content: `[오늘 날짜]\n${new Date().toISOString().slice(0, 10)}\n\n[규정 발췌]\n${excerpts}${calculatedBlock}\n\n[질문]\n${question}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    return respond(
      `AI 응답을 가져오지 못했습니다. 잠시 후 다시 시도하시거나 ${pickContact(question)}으로 문의해 주세요.`,
      sources,
      true,
      502,
    );
  }

  const data = await response.json();
  const answer = data.choices?.[0]?.message?.content?.trim();

  if (!answer) {
    return respond(`확인되지 않음, 인사팀 문의 필요 — ${pickContact(question)}으로 문의해 주세요.`, [], true);
  }

  // 발췌에서 답을 찾지 못한 응답에는 근거 문서를 붙이지 않는다.
  // "확인되지 않으며/않아서"처럼 어미가 달라질 수 있어 어간("확인되지 않")만 확인한다.
  const notFound = answer.includes("확인되지 않");

  return respond(
    notFound ? `${answer} ${pickContact(question)}으로 문의해 주세요.` : answer,
    notFound ? [] : sources,
    notFound,
  );
}
