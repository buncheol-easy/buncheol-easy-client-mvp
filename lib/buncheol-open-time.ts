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

// 서버 ISO 시각(opensAt·serverTime)을 ms 로. 비었거나 읽을 수 없으면 null.
export function parseIsoTimeMs(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const time = new Date(value).getTime();

  return Number.isNaN(time) ? null : time;
}

const dayMs = 86_400_000;
const kstOffsetMs = 9 * 3_600_000;

function getKstDayNumber(timeMs: number) {
  return Math.floor((timeMs + kstOffsetMs) / dayMs);
}

/**
 * 오픈 시각 표기. 한국 날짜로 오늘·내일이면 "오늘 20:00"·"내일 20:00", 그 뒤는 "10/20(화) 20:00".
 * 카드 띠·상세 띠·참여 버튼("…에 열려요")이 함께 쓴다.
 */
export function formatOpensAt(opensAtMs: number, nowMs: number) {
  const parts = Object.fromEntries(
    opensAtPartsFormatter
      .formatToParts(new Date(opensAtMs))
      .map((part) => [part.type, part.value]),
  );
  const time = `${parts.hour}:${parts.minute}`;
  const dayGap = getKstDayNumber(opensAtMs) - getKstDayNumber(nowMs);

  if (dayGap === 0) {
    return `오늘 ${time}`;
  }

  if (dayGap === 1) {
    return `내일 ${time}`;
  }

  return `${parts.month}/${parts.day}(${parts.weekday}) ${time}`;
}

/** 하루 안쪽 남은 시간을 "HH:MM:SS" 로. 날 수는 호출부가 붙인다. */
export function formatCountdownClock(totalSeconds: number) {
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  return [
    hours.toString().padStart(2, "0"),
    minutes.toString().padStart(2, "0"),
    seconds.toString().padStart(2, "0"),
  ].join(":");
}

/**
 * 오픈까지 남은 시간. 24시간 안은 "HH:MM:SS", 넘으면 매초 바뀌지 않게 "N일 N시간"(시간이 0이면 "N일").
 * 상세 띠와 오픈 전 참여 버튼이 함께 쓴다.
 */
export function formatOpenCountdown(opensAtMs: number, nowMs: number) {
  // 올림 — 내림이면 오픈 직전 1초 동안 00:00:00 이 떠 있다.
  const totalSeconds = Math.max(0, Math.ceil((opensAtMs - nowMs) / 1000));
  const days = Math.floor(totalSeconds / 86_400);

  if (days > 0) {
    const hours = Math.floor((totalSeconds % 86_400) / 3_600);

    return hours > 0 ? `${days}일 ${hours}시간` : `${days}일`;
  }

  return formatCountdownClock(totalSeconds);
}
