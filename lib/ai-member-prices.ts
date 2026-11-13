// AI 가 읽은 정가를 멤버별 가격으로 펼친다. 분철은 멤버 한 자리가 앨범 한 장 값이라
// 합계는 정가 × 멤버 수이고, 인기 순위가 높은 멤버를 정가보다 높게·낮은 멤버를 낮게 잡는다.

const priceUnit = 100;
// 가장 인기 있는 멤버와 가장 낮은 멤버가 정가에서 벌어지는 폭(±).
const spreadRatio = 0.15;

export type AiMemberPrices = {
  basis: "rank" | "even";
  prices: Record<string, string>;
};

export function getAiMemberPrices(
  listPrice: number,
  memberIds: string[],
  rankByMemberId: Record<string, number>,
): AiMemberPrices {
  const total =
    Math.round(listPrice / priceUnit) * priceUnit * memberIds.length;
  const hasRank = memberIds.some((id) => rankByMemberId[id] !== undefined);

  if (memberIds.length < 2 || !hasRank || total <= 0) {
    const evenPrice = String(Math.round(listPrice / priceUnit) * priceUnit);

    return {
      basis: "even",
      prices: Object.fromEntries(memberIds.map((id) => [id, evenPrice])),
    };
  }

  // 순위 밖 멤버는 모두 맨 뒤 같은 자리다. 같은 순위는 자리를 평균 내 합계가 정가 × 인원에서 벗어나지 않게 한다.
  const ordered = [...memberIds].sort(
    (a, b) =>
      (rankByMemberId[a] ?? Number.POSITIVE_INFINITY) -
      (rankByMemberId[b] ?? Number.POSITIVE_INFINITY),
  );
  const positionById: Record<string, number> = {};

  for (let start = 0; start < ordered.length;) {
    let end = start;

    while (
      end + 1 < ordered.length &&
      (rankByMemberId[ordered[end + 1]] ?? Number.POSITIVE_INFINITY) ===
        (rankByMemberId[ordered[start]] ?? Number.POSITIVE_INFINITY)
    ) {
      end += 1;
    }

    for (let index = start; index <= end; index += 1) {
      positionById[ordered[index]] = (start + end) / 2;
    }

    start = end + 1;
  }

  const lastPosition = ordered.length - 1;
  const amounts = ordered.map((id) => {
    const tilt = 1 - (2 * positionById[id]) / lastPosition;

    return (
      Math.floor((listPrice * (1 + spreadRatio * tilt)) / priceUnit) * priceUnit
    );
  });
  // 내림으로 모자란 만큼은 1위 멤버에게 붙인다 — 나눠 주면 같은 순위끼리 100원씩 어긋난다.
  amounts[0] += total - amounts.reduce((sum, amount) => sum + amount, 0);

  return {
    basis: "rank",
    prices: Object.fromEntries(
      ordered.map((id, index) => [id, String(amounts[index])]),
    ),
  };
}
