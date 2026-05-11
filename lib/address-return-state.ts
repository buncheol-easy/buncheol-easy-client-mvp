export const addressReturnStateKey = "buncheol-address-return-state";
export const lastAddedDeliveryAddressIdKey =
  "buncheol-last-added-delivery-address-id";

export type AddressReturnSource = "profile" | "bids";

export type AddressReturnState = {
  source: AddressReturnSource;
  bidId: string | null;
  addressId: string | null;
};
