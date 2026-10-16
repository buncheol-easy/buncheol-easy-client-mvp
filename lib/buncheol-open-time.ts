// 운영진 분철 예약 오픈 시각 표기. 오픈 전 참여를 막는 정본은 서버이고, 화면은 같은 시각을 보여 주기만 한다.

// 서버 렌더(UTC)와 브라우저가 같은 글자를 내도록 시간대를 한국으로 고정한다.
const opensAtPartsFormatter = new Intl.DateTimeFormat("ko-KR", {
  day: "numeric",
  hour: "2-digit",
  hourCycle: "h23",
  minute: "2-digit",
  month: "numeric",
  timeZone: "Asia/Seoul",
  weekday: "short",
});

export function parseOpensAtMs(opensAt: string | null | undefined) {
  if (!opensAt) {
    return null;
  }

  const time = new Date(opensAt).getTime();

  return Number.isNaN(time) ? null : time;
}

/** "10/20 20:00", 요일을 붙이면 "10/20(화) 20:00". */
export function formatOpensAt(
  opensAtMs: number,
  { withWeekday = false }: { withWeekday?: boolean } = {},
) {
  const parts = Object.fromEntries(
    opensAtPartsFormatter
      .formatToParts(new Date(opensAtMs))
      .map((part) => [part.type, part.value]),
  );
  const date = `${parts.month}/${parts.day}`;

  return `${withWeekday ? `${date}(${parts.weekday})` : date} ${parts.hour}:${parts.minute}`;
}
