const kstPartsFormatter = new Intl.DateTimeFormat("ko-KR", {
  day: "numeric",
  hour: "numeric",
  hourCycle: "h23",
  minute: "numeric",
  month: "numeric",
  timeZone: "Asia/Seoul",
  weekday: "short",
  year: "numeric",
});

function getKstParts(date: Date) {
  const parts = Object.fromEntries(
    kstPartsFormatter
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );

  return {
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    month: Number(parts.month),
    weekday: parts.weekday,
    year: Number(parts.year),
  };
}

/**
 * 한국 시각을 "오후 3시", "오후 7시 27분" 처럼 쓴다. 정오와 자정은 휴대폰 시계처럼 "오후 12시", "오전 12시".
 */
export function formatKoreanClock(date: Date) {
  const { hour, minute } = getKstParts(date);
  const period = hour < 12 ? "오전" : "오후";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;

  return minute === 0
    ? `${period} ${hour12}시`
    : `${period} ${hour12}시 ${minute}분`;
}

/**
 * 사용자 화면의 날짜와 시각 표기. "10월 28일 오후 3시", 올해가 아니면 "2027년 1월 3일 오전 9시".
 * withWeekday 면 "10월 30일 (금) 오후 8시".
 */
export function formatKoreanDateTime(
  date: Date,
  { withWeekday = false }: { withWeekday?: boolean } = {},
) {
  const { day, month, weekday, year } = getKstParts(date);
  const yearPrefix = year === getKstParts(new Date()).year ? "" : `${year}년 `;
  const weekdayText = withWeekday ? ` (${weekday})` : "";

  return `${yearPrefix}${month}월 ${day}일${weekdayText} ${formatKoreanClock(date)}`;
}
