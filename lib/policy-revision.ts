// 회원 개최 개정의 시행일. prod 릴리스일과 같은 날이고 개정 공지일 + 7일보다 빠르면 안 된다. 약관, 취소·환불 정책, 통신판매중개자 고지가 같은 날을 쓴다.
// 날짜가 정해지면 이 세 값만 숫자로 바꾼다(앞자리 0 없이). ○가 남은 채로 머지하면 안 된다.
const revisionDate = { year: "○○○○", month: "○○", day: "○○" };

export const REVISION_EFFECTIVE_DATE = `${revisionDate.year}.${revisionDate.month}.${revisionDate.day}`;
export const REVISION_HISTORY_DATE = `${revisionDate.year}년 ${revisionDate.month}월 ${revisionDate.day}일`;
