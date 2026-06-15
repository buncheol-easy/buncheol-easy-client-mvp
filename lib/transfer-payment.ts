const transferRequestedStatuses = new Set([
  "PAYMENT_CONFIRMING",
  "PAYMENT_REPORTED",
  "REPORTED",
  "PAID_REPORTED",
  "PAYMENT_REPORT",
  "CONFIRMATION_REQUESTED",
  "TRANSFER_REQUESTED",
]);

export function isTransferPaymentRequestedStatus(status: string | undefined) {
  return Boolean(status && transferRequestedStatuses.has(status));
}
