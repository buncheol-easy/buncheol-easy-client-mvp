export function formatKoreaDateTime(value: string | undefined) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  /*
   * 참여 내역·개최 기록과 같은 "8월 12일 17:30" 모양으로 맞춘다.
   * 같은 정보가 화면마다 "8.12 17시" / "2026년 07월 05일 14시" / "2026. 12. 22. 20:00"
   * 세 가지로 보이고 있었다. 연도는 올해가 아닐 때만 붙인다.
   */
  const parts = new Intl.DateTimeFormat("ko-KR", {
    day: "numeric",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "numeric",
    timeZone: "Asia/Seoul",
    year: "numeric",
  }).formatToParts(date);
  const partMap = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  const currentYear = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
  }).format(new Date());
  const yearPrefix = currentYear.includes(partMap.year)
    ? ""
    : `${partMap.year}년 `;

  return `${yearPrefix}${partMap.month}월 ${partMap.day}일 ${partMap.hour}:${partMap.minute}`;
}
