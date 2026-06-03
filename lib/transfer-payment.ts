const transferRequestedStatuses = new Set([
  "PAYMENT_CONFIRMING",
  "PAYMENT_REPORTED",
  "CONFIRMATION_REQUESTED",
  "TRANSFER_REQUESTED",
]);

export function isTransferPaymentRequestedStatus(status: string | undefined) {
  return Boolean(status && transferRequestedStatuses.has(status));
}
