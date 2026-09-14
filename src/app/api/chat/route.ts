import { HR_CONTACT, isSensitiveQuestion, searchRegulations } from "@/lib/retrieval";

// 답변 생성 규칙 — PRD must-1 (근거 없는 추측 금지, 근거 문서명 표시)
const SYSTEM_PROMPT = `너는 사내 인사·복지·오피스 환경·근무지원 제도를 안내하는 사내 챗봇 "Jeisian 회사생활 도우미"다.

반드시 지킬 규칙:
1. 아래에 제공된 [규정 발췌]에 있는 내용만 근거로 답한다. 발췌에 없는 내용은 추측하거나 일반 상식으로 보충하지 않는다.
2. 질문에 대한 답이 발췌에 없으면 "확인되지 않음, 인사팀 문의 필요"라고만 답한다.
3. 답변은 한국어 존댓말로 3~5문장 이내로 간결하게 작성한다.
4. 개인별 판단이 필요한 사안(급여 이의제기, 징계 등)은 판단하지 말고 인사팀 문의를 안내한다.
5. 금액·기간·한도 같은 숫자는 발췌에 적힌 값을 그대로 사용한다.`;

type ChatRequestBody = {
  question?: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as ChatRequestBody;
  const question = body.question?.trim();

  if (!question) {
    return Response.json({ error: "질문 내용이 비어 있습니다." }, { status: 400 });
  }

  // must-2: 민감 사안은 자체 판단 없이 인사팀으로 안내한다.
  if (isSensitiveQuestion(question)) {
    return Response.json({
      answer: `해당 사안은 개인별 상황 확인이 필요해 챗봇이 판단하지 않습니다. ${HR_CONTACT}으로 문의해 주세요.`,
      sources: [],
      handoff: true,
    });
  }

  const results = searchRegulations(question);

  // must-1: 근거 문서를 찾지 못하면 추측하지 않는다.
  if (results.length === 0) {
    return Response.json({
      answer: `확인되지 않음, 인사팀 문의 필요 — 관련 규정이나 공지사항을 찾지 못했습니다. ${HR_CONTACT}으로 문의해 주세요.`,
      sources: [],
      handoff: true,
    });
  }

  const excerpts = results
    .map(({ regulation }) => `[${regulation.title}] (${regulation.category}, 개정일 ${regulation.updatedAt})\n${regulation.content}`)
    .join("\n\n");

  const sources = results.map(({ regulation }) => ({
    title: regulation.title,
    category: regulation.category,
    updatedAt: regulation.updatedAt,
  }));

  const apiKey = process.env.OPENAI_API_KEY;

  // API 키가 없어도 POC 동작을 확인할 수 있도록 규정 원문을 그대로 보여준다.
  if (!apiKey) {
    return Response.json({
      answer: `AI 응답 키가 설정되지 않아 규정 원문을 그대로 안내합니다.\n\n${excerpts}`,
      sources,
      handoff: false,
    });
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
        { role: "user", content: `[규정 발췌]\n${excerpts}\n\n[질문]\n${question}` },
      ],
    }),
  });

  if (!response.ok) {
    return Response.json(
      {
        answer: `AI 응답을 가져오지 못했습니다. 잠시 후 다시 시도하시거나 ${HR_CONTACT}으로 문의해 주세요.`,
        sources,
        handoff: true,
      },
      { status: 502 },
    );
  }

  const data = await response.json();
  const answer = data.choices?.[0]?.message?.content?.trim();

  if (!answer) {
    return Response.json({
      answer: `확인되지 않음, 인사팀 문의 필요 — ${HR_CONTACT}으로 문의해 주세요.`,
      sources: [],
      handoff: true,
    });
  }

  // 발췌에서 답을 찾지 못한 응답에는 근거 문서를 붙이지 않는다.
  const notFound = answer.includes("확인되지 않음");

  return Response.json({
    answer: notFound ? `${answer} ${HR_CONTACT}으로 문의해 주세요.` : answer,
    sources: notFound ? [] : sources,
    handoff: notFound,
  });
}
