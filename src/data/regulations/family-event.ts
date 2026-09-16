import type { Regulation } from "./types";

// 출처: policy/[HR팀] 03. 경조 매뉴얼.pdf
export const familyEvent: Regulation[] = [
  {
    id: "family-event-manual-reference",
    title: "경조 매뉴얼 (경조기준 확인 방법)",
    category: "복지",
    keywords: ["경조기준", "경조금", "복리후생 규정", "출산선물"],
    content:
      "경조기준은 팀즈에서 'HR Helpdesk' 클릭 후 하단의 '파일' -> '02.복리후생 규정'을 클릭하여, 복리후생 규정 제7조 [경조금의 지급] 및 [별표-1] 경조금 및 휴가 지급표에서 확인할 수 있다. 출산 선물 관련내용은 기업문화팀에 문의한다.",
    updatedAt: "2025-04-01",
  },
  {
    id: "family-event-manual-leave-application",
    title: "경조 매뉴얼 (근태신청: 경조휴가 신청방법)",
    category: "복지",
    keywords: ["경조휴가", "휴가신청", "그룹웨어", "결혼휴가", "부고휴가", "부재/휴가관리"],
    content:
      "그룹웨어(https://ngw.jeisys.com)에 로그인하여 '부재/휴가관리' 클릭 후 '부재/휴가신청'을 클릭하여 신청한다. 결혼의 경우 결혼일을 기준으로 3개월 이내 사용 가능하며, 부고의 경우 부고일을 기준으로 1주일 이내 사용 가능하다. 증빙첨부는 필수이다.",
    updatedAt: "2025-04-01",
  },
  {
    id: "family-event-manual-documents",
    title: "경조 매뉴얼 (경조금 및 물품/화환 수령 절차)",
    category: "복지",
    keywords: ["경조금 지급절차", "화환", "조화", "경조물품", "증빙서류", "부고장", "청첩장"],
    content:
      "기준에 따라 물품/화환/경조금은 HR팀에서 전달한다. HR팀 경조담당자에게 증빙(부고장, 청첩장 등) 전달이 필수이다.",
    updatedAt: "2025-04-01",
  },
];
