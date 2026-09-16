import { attendanceManual } from "./attendance-manual";
import { compliance } from "./compliance";
import { educationSupport } from "./education-support";
import { employeeService } from "./employee-service";
import { familyEvent } from "./family-event";
import { healthInsurance } from "./health-insurance";
import { hrRules } from "./hr-rules";
import { onboardingSupport } from "./onboarding-support";
import { referralProgram } from "./referral-program";
import { rewardAndInvention } from "./reward-invention";
import { telecom } from "./telecom";
import type { Regulation } from "./types";
import { welfareBenefits } from "./welfare-benefits";
import { workRules } from "./work-rules";

export type { Regulation };

// policy 폴더의 사내 규정 PDF에서 옮겨온 조항들. 문서별 파일을 수정하면 챗봇 답변에 바로 반영된다.
export const regulations: Regulation[] = [
  ...workRules,
  ...hrRules,
  ...rewardAndInvention,
  ...telecom,
  ...compliance,
  ...welfareBenefits,
  ...familyEvent,
  ...healthInsurance,
  ...educationSupport,
  ...referralProgram,
  ...attendanceManual,
  ...employeeService,
  ...onboardingSupport,
];
