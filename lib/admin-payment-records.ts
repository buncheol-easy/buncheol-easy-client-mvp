export type AdminPaymentStatus = "AWAITING_CONFIRMATION" | "CONFIRMED";

export type AdminPaymentRecord = {
  bidAmount: number;
  buncheolId: string;
  buncheolTitle: string;
  confirmedAt?: string;
  depositorName: string;
  memberName: string;
  orderId: string;
  participantNickname: string;
  paymentDueAt: string;
  paymentRequestedAt: string;
  shippingFee: number;
  status: AdminPaymentStatus;
};

export const adminPaymentRecords: AdminPaymentRecord[] = [
  {
    bidAmount: 3100,
    buncheolId: "333",
    buncheolTitle: "호두 자랑 333",
    depositorName: "김슬기",
    memberName: "슬기",
    orderId: "PAY-20260602-001",
    participantNickname: "슬기럽다",
    paymentDueAt: "2026-06-03T09:00:00+09:00",
    paymentRequestedAt: "2026-06-02T10:14:00+09:00",
    shippingFee: 3200,
    status: "AWAITING_CONFIRMATION",
  },
  {
    bidAmount: 3100,
    buncheolId: "333",
    buncheolTitle: "호두 자랑 333",
    depositorName: "조이",
    memberName: "조이",
    orderId: "PAY-20260602-002",
    participantNickname: "조이포카",
    paymentDueAt: "2026-06-03T09:00:00+09:00",
    paymentRequestedAt: "2026-06-02T10:18:00+09:00",
    shippingFee: 3200,
    status: "AWAITING_CONFIRMATION",
  },
  {
    bidAmount: 42000,
    buncheolId: "287",
    buncheolTitle: "IVE 시즌그리팅 분철",
    depositorName: "장원영",
    memberName: "원영",
    orderId: "PAY-20260601-014",
    participantNickname: "원영만",
    paymentDueAt: "2026-06-03T12:00:00+09:00",
    paymentRequestedAt: "2026-06-01T23:42:00+09:00",
    shippingFee: 1800,
    status: "AWAITING_CONFIRMATION",
  },
  {
    bidAmount: 18500,
    buncheolId: "291",
    buncheolTitle: "aespa 앨범 포카",
    confirmedAt: "2026-06-02T09:40:00+09:00",
    depositorName: "김민정",
    memberName: "윈터",
    orderId: "PAY-20260601-009",
    participantNickname: "겨울이",
    paymentDueAt: "2026-06-02T23:59:00+09:00",
    paymentRequestedAt: "2026-06-01T21:08:00+09:00",
    shippingFee: 3200,
    status: "CONFIRMED",
  },
  {
    bidAmount: 27000,
    buncheolId: "255",
    buncheolTitle: "NCT DREAM 럭드",
    confirmedAt: "2026-06-01T18:12:00+09:00",
    depositorName: "이해찬",
    memberName: "해찬",
    orderId: "PAY-20260531-021",
    participantNickname: "해차니",
    paymentDueAt: "2026-06-02T18:00:00+09:00",
    paymentRequestedAt: "2026-05-31T19:25:00+09:00",
    shippingFee: 1800,
    status: "CONFIRMED",
  },
];
