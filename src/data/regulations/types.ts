// 사내 규정 한 조항을 나타내는 형태. 문서별 파일에서 공통으로 사용한다.

export type Regulation = {
  id: string;
  // 답변에 근거로 표시할 문서명 (예: "취업규칙 제25조 (연차유급휴가)")
  title: string;
  category: "인사" | "복지" | "오피스 환경" | "근무지원";
  // 검색 정확도를 높이기 위한 키워드 목록
  keywords: string[];
  content: string;
  updatedAt: string;
  // 공지사항처럼 기간이 정해진 항목에만 지정. 이 날짜가 지나면 검색·답변에서 제외된다.
  // 정식 규정처럼 상시 유효한 항목은 생략한다.
  validUntil?: string;
  // 공지사항의 출처 채널 (예: "Microsoft Teams > 전사공지"). 정식 규정에는 없다.
  channel?: string;
  // 제메티·콘도 신청처럼 "매월/분기 신청받아 당첨자를 선정"하는 반복 제도의 특정 회차 공지인 경우 true.
  // 이런 공지는 validUntil이 지나도(이번 회차 신청은 끝났어도) 한동안 검색 대상에 남겨둬서,
  // "이번 달은 마감됐고, 이런 방식으로 매달/분기 반복되니 다음 공지를 확인하라"고 안내할 수 있게 한다.
  recurring?: boolean;
};
