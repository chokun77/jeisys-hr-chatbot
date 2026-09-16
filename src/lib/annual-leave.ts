// 연차휴가 일수 계산기 — 취업규칙 제29조 / 인사규정 제24조를 코드로 직접 계산한다.
// LLM에게 근속연수 가산 계산(매 2년마다 1일, 25일 한도)을 맡기면 산수 실수가 나서
// (예: 6년차를 16일/18일로 서로 다르게 답함, 정답은 17일) 이 부분만 결정적으로 계산한다.
//
// 근거: "1년간 80% 이상 출근한 근로자에 대하여 15일로 한다. ... 3년 이상 계속 근로한 근로자에
// 대하여는 최초 1년을 초과하는 계속 근로연수 매2년에 대하여 1일을 가산한다. 가산휴가를 포함한
// 총 휴가일수는 25일을 한도로 한다." (취업규칙 제29조 1·3항)
// "계속 근로연수가 1년 미만인 근로자에게는 1월간 개근 시 1일의 유급휴가를 준다." (동조 2항)

export type AnnualLeaveResult = {
  days: number;
  breakdown: string;
};

const BASE_DAYS = 15;
const MAX_DAYS = 25;

// 1년 이상 근속: 기본 15일 + (근속연수-1년을 초과하는 만�2년마다) 1일 가산, 25일 한도.
export function calculateAnnualLeaveByYears(tenureYears: number): AnnualLeaveResult {
  if (tenureYears < 1) {
    throw new Error("tenureYears는 1 이상이어야 합니다. 1년 미만은 calculateAnnualLeaveByMonths를 사용하세요.");
  }

  if (tenureYears < 3) {
    return {
      days: BASE_DAYS,
      breakdown: `근속 ${tenureYears}년 차는 3년 미만이라 가산 없이 기본 ${BASE_DAYS}일입니다.`,
    };
  }

  const bonus = Math.floor((tenureYears - 1) / 2);
  const days = Math.min(BASE_DAYS + bonus, MAX_DAYS);
  const capped = BASE_DAYS + bonus > MAX_DAYS;

  return {
    days,
    breakdown: capped
      ? `근속 ${tenureYears}년 차: 기본 ${BASE_DAYS}일 + 가산 ${bonus}일 = ${BASE_DAYS + bonus}일이지만, 25일 한도가 적용되어 ${days}일입니다.`
      : `근속 ${tenureYears}년 차: 기본 ${BASE_DAYS}일 + 가산 ${bonus}일(최초 1년 초과분 ${tenureYears - 1}년 ÷ 2년, 소수점 버림) = ${days}일입니다.`,
  };
}

// 1년 미만 근속: 1개월 개근마다 1일.
export function calculateAnnualLeaveByMonths(tenureMonths: number): AnnualLeaveResult {
  if (tenureMonths < 0 || tenureMonths >= 12) {
    throw new Error("tenureMonths는 0 이상 12 미만이어야 합니다.");
  }

  const days = Math.floor(tenureMonths);
  return {
    days,
    breakdown: `근속 ${tenureMonths}개월(1년 미만)이라 매월 개근 기준 1일씩, 총 ${days}일입니다.`,
  };
}

// "6년차", "근속 6년", "입사한지 6년" 형태에서 정수 근속연수를 뽑는다.
function parseTenureYearsPhrase(question: string): number | null {
  const patterns = [
    /(\d{1,2})\s*년\s*차/,
    /근속\s*(\d{1,2})\s*년/,
    /입사\s*(?:한지|한\s*지|한지가)\s*(\d{1,2})\s*년/,
    /(\d{1,2})\s*년\s*(?:째|동안|간)?\s*(?:근무|재직|다녔|일했)/,
  ];
  for (const pattern of patterns) {
    const match = question.match(pattern);
    if (match) return Number(match[1]);
  }
  return null;
}

// "입사한지 3개월", "3개월 다녔어요" 형태에서 근속 개월수를 뽑는다.
function parseTenureMonthsPhrase(question: string): number | null {
  const patterns = [/입사\s*(?:한지|한\s*지|한지가)\s*(\d{1,2})\s*개월/, /(\d{1,2})\s*개월\s*(?:째|동안)?\s*(?:근무|재직|다녔|일했)/];
  for (const pattern of patterns) {
    const match = question.match(pattern);
    if (match) return Number(match[1]);
  }
  return null;
}

// "2024년 4월 22일에 입사" 형태의 입사일과, 있다면 "2026년 기준" 같은 별도 기준연도를 뽑아
// 근속연수를 계산한다. 기준연도가 없으면 오늘 날짜를 기준으로 한다.
function parseTenureFromHireDate(question: string, today: Date): number | null {
  const hireDateMatch = question.match(/(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일[^.]{0,10}입사/);
  if (!hireDateMatch) return null;

  const hireYear = Number(hireDateMatch[1]);
  const hireMonth = Number(hireDateMatch[2]);
  const hireDay = Number(hireDateMatch[3]);

  // 입사일 문장에 쓰인 연도를 제외한 다른 4자리 연도가 있으면 "그 해 기준"으로 본다.
  const yearMatches = [...question.matchAll(/(\d{4})\s*년/g)].map((m) => Number(m[1]));
  const targetYear = yearMatches.find((year) => year !== hireYear);

  if (targetYear !== undefined) {
    // 기준연도의 입사일 해당월일(=그 해 연차가 부여되는 시점) 기준 근속연수.
    return targetYear - hireYear;
  }

  // 별도 기준연도가 없으면 오늘 날짜 기준으로 만 근속연수를 계산한다.
  let years = today.getFullYear() - hireYear;
  const hadAnniversaryThisYear =
    today.getMonth() + 1 > hireMonth || (today.getMonth() + 1 === hireMonth && today.getDate() >= hireDay);
  if (!hadAnniversaryThisYear) years -= 1;
  return years;
}

// 질문에서 근속 기간을 최대한 읽어내 연차 일수를 계산한다. 못 읽어내면 null.
export function tryCalculateAnnualLeaveFromQuestion(question: string, today: Date = new Date()): AnnualLeaveResult | null {
  const months = parseTenureMonthsPhrase(question);
  if (months !== null) return calculateAnnualLeaveByMonths(months);

  const yearsFromPhrase = parseTenureYearsPhrase(question);
  const yearsFromDate = parseTenureFromHireDate(question, today);
  const years = yearsFromPhrase ?? yearsFromDate;

  if (years === null || years === undefined) return null;
  if (years < 0) return null;
  if (years < 1) return calculateAnnualLeaveByMonths(Math.round(years * 12));

  return calculateAnnualLeaveByYears(years);
}
