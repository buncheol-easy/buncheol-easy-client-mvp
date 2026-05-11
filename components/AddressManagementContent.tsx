"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { BackIcon, CloseIcon } from "@/components/icons";
import { lastAddedDeliveryAddressIdKey } from "@/lib/address-return-state";
import {
  getInitialDeliveryAddressState,
  readDeliveryAddressState,
  subscribeDeliveryAddressState,
  type StoredDeliveryAddressState,
  writeDeliveryAddressState,
} from "@/lib/delivery-address-store";
import {
  convenienceStoreTypes,
  convenienceStoreTypeLabels,
  getConvenienceStoreLabel,
  getPrioritizedDeliveryAddresses,
  type ConvenienceStoreType,
} from "@/lib/mock-delivery-addresses";

type AddressManagementContentProps = {
  openFormOnEntry?: boolean;
  returnHref?: string | null;
};

function getHistoryIndex() {
  const historyState = window.history.state as { idx?: unknown } | null;

  return typeof historyState?.idx === "number" ? historyState.idx : null;
}

export function AddressManagementContent({
  openFormOnEntry = false,
  returnHref = null,
}: AddressManagementContentProps) {
  const router = useRouter();
  const addressState = useSyncExternalStore(
    subscribeDeliveryAddressState,
    readDeliveryAddressState,
    getInitialDeliveryAddressState,
  );
  const addressIdSeedRef = useRef(0);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [newAddressStoreType, setNewAddressStoreType] =
    useState<ConvenienceStoreType>("gs25");
  const [newAddressAlias, setNewAddressAlias] = useState("");
  const [newAddressBranchName, setNewAddressBranchName] = useState("");
  const { addresses: deliveryAddresses, defaultAddressIds } = addressState;
  const visibleAddresses = useMemo(
    () => getPrioritizedDeliveryAddresses(deliveryAddresses, defaultAddressIds),
    [defaultAddressIds, deliveryAddresses],
  );

  function resetDraft() {
    setNewAddressStoreType("gs25");
    setNewAddressAlias("");
    setNewAddressBranchName("");
  }

  function closeForm() {
    setIsFormOpen(false);
    resetDraft();
  }

  function openForm() {
    setIsFormOpen(true);

    function scrollToBottom() {
      scrollContainerRef.current?.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        scrollToBottom();
        window.setTimeout(scrollToBottom, 420);
      });
    });
  }

  useEffect(() => {
    if (!openFormOnEntry) {
      return;
    }

    const openFrame = window.requestAnimationFrame(() => {
      openForm();
    });

    return () => {
      window.cancelAnimationFrame(openFrame);
    };
  }, [openFormOnEntry]);

  function scrollToAddressListBottom() {
    scrollContainerRef.current?.scrollTo({
      top: scrollContainerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }

  function commitAddressState(nextState: StoredDeliveryAddressState) {
    writeDeliveryAddressState(nextState);
  }

  function createAddressId() {
    const usedIds = new Set(deliveryAddresses.map((address) => address.id));

    while (usedIds.has(`address-${addressIdSeedRef.current}`)) {
      addressIdSeedRef.current += 1;
    }

    const nextId = `address-${addressIdSeedRef.current}`;
    addressIdSeedRef.current += 1;

    return nextId;
  }

  function addDeliveryAddress() {
    const trimmedBranchName = newAddressBranchName.trim();

    if (!trimmedBranchName) {
      return;
    }

    const nextAddress = {
      id: createAddressId(),
      storeType: newAddressStoreType,
      alias: newAddressAlias.trim() || undefined,
      branchName: trimmedBranchName,
      address: "",
    };

    const nextAddresses = [...deliveryAddresses, nextAddress];

    commitAddressState({
      addresses: nextAddresses,
      defaultAddressIds: defaultAddressIds[newAddressStoreType]
        ? defaultAddressIds
        : {
            ...defaultAddressIds,
            [newAddressStoreType]: nextAddress.id,
          },
    });
    closeForm();

    if (returnHref) {
      window.sessionStorage.setItem(
        lastAddedDeliveryAddressIdKey,
        nextAddress.id,
      );
    }

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        scrollToAddressListBottom();
        window.setTimeout(scrollToAddressListBottom, 420);
      });
    });
  }

  function setAsDefaultAddress(addressId: string) {
    const selectedAddress = deliveryAddresses.find(
      (address) => address.id === addressId,
    );

    if (!selectedAddress) {
      return;
    }

    commitAddressState({
      addresses: deliveryAddresses,
      defaultAddressIds: {
        ...defaultAddressIds,
        [selectedAddress.storeType]: addressId,
      },
    });
  }

  function deleteDeliveryAddress(addressId: string) {
    if (deliveryAddresses.length <= 1) {
      return;
    }

    const targetAddress = deliveryAddresses.find(
      (address) => address.id === addressId,
    );

    if (!targetAddress) {
      return;
    }

    const nextAddresses = deliveryAddresses.filter(
      (address) => address.id !== addressId,
    );
    const sameTypeAddresses = nextAddresses.filter(
      (address) => address.storeType === targetAddress.storeType,
    );

    commitAddressState({
      addresses: nextAddresses,
      defaultAddressIds:
        defaultAddressIds[targetAddress.storeType] === addressId
          ? {
              ...defaultAddressIds,
              [targetAddress.storeType]: sameTypeAddresses[0]?.id ?? null,
            }
          : defaultAddressIds,
    });
  }

  function handleBack() {
    const historyIndex = getHistoryIndex();

    if (historyIndex !== null && historyIndex > 0) {
      router.back();
      return;
    }

    router.replace(returnHref ?? "/profile");
  }

  return (
    <div className="tab-content-enter flex min-h-0 flex-1 flex-col bg-white">
      <header className="profile-header shrink-0 px-4 py-3">
        <div className="flex h-10 items-center gap-3">
          <button
            aria-label="이전 화면"
            className="product-detail-action inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black text-white"
            onClick={handleBack}
            type="button"
          >
            <BackIcon />
          </button>
          <div className="min-w-0 flex-1 text-right">
            <p className="text-[10px] font-semibold uppercase leading-none tracking-[0.18em] text-black/35">
              My Page
            </p>
            <h1 className="mt-1 text-[22px] font-semibold leading-none tracking-[-0.06em]">
              배송지 관리
            </h1>
          </div>
        </div>
      </header>

      <div
        className="min-h-0 flex-1 overflow-y-auto px-4 pb-6"
        ref={scrollContainerRef}
      >
        <section className="border-t border-black/10 pt-5">
          <div className="grid gap-2">
            {visibleAddresses.map((address) => {
              const isDefault =
                address.id === defaultAddressIds[address.storeType];

              return (
                <div
                  className={`w-full rounded-[0.95rem] border-[1.5px] px-4 py-3 text-left transition-colors ${
                    isDefault
                      ? "border-[#d8d8d8] bg-[#ececec]"
                      : "border-[#ededed] bg-white"
                  }`}
                  key={address.id}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1 pr-1">
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                            isDefault
                              ? "bg-black text-white"
                              : "bg-white text-black/45"
                          }`}
                        >
                          {getConvenienceStoreLabel(address.storeType)}
                        </span>
                        {address.alias ? (
                          <span className="rounded-full bg-black/10 px-2.5 py-1 text-[11px] font-semibold text-black/60">
                            {address.alias}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 truncate text-[14px] font-semibold tracking-[-0.04em]">
                        {address.branchName}
                      </p>
                    </div>
                    {isDefault ? (
                      <div className="flex w-[8.3rem] shrink-0 items-center justify-end gap-2">
                        <span className="inline-flex h-8 items-center rounded-full bg-black px-2.5 text-[12px] font-semibold text-white">
                          기본
                        </span>
                      </div>
                    ) : (
                      <div className="flex w-[8.3rem] shrink-0 items-center justify-end gap-2">
                        <button
                          className="h-8 rounded-full bg-white px-2.5 text-[12px] font-semibold text-black/55 ring-1 ring-black/10"
                          onClick={() => setAsDefaultAddress(address.id)}
                          type="button"
                        >
                          기본 설정
                        </button>
                        <button
                          aria-label={`${getConvenienceStoreLabel(address.storeType)} ${address.branchName} 배송지 삭제`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-black/35 ring-1 ring-black/10"
                          onClick={() => deleteDeliveryAddress(address.id)}
                          type="button"
                        >
                          <CloseIcon />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {isFormOpen ? (
              <div
                className="idol-selection-enter rounded-[0.95rem] border-[1.5px] border-[#ededed] bg-[#f7f7f7] px-5 pb-4 pt-5"
                key="address-form"
              >
                  <div className="flex items-center justify-between">
                    <p className="text-[13px] font-semibold tracking-[-0.04em]">
                      새 배송지 추가
                    </p>
                    <button
                      className="text-[12px] font-semibold text-black/35"
                      disabled={!isFormOpen}
                      onClick={closeForm}
                      type="button"
                    >
                      닫기
                    </button>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 rounded-[0.8rem] bg-white/80 p-1">
                    {convenienceStoreTypes.map((storeType) => (
                      <button
                        className={`h-9 rounded-[0.65rem] text-[13px] font-semibold transition-colors duration-300 ease-out ${
                          newAddressStoreType === storeType
                            ? "bg-black text-white"
                            : "text-black/45"
                        }`}
                        key={storeType}
                        onMouseDown={(event) => {
                          event.preventDefault();
                        }}
                        onTouchStart={(event) => {
                          event.preventDefault();
                        }}
                        disabled={!isFormOpen}
                        onClick={() => setNewAddressStoreType(storeType)}
                        type="button"
                      >
                        {convenienceStoreTypeLabels[storeType]}
                      </button>
                    ))}
                  </div>
                  <input
                    className="mt-2 h-9 w-full rounded-[0.65rem] bg-white px-3 text-[13px] font-medium outline-none placeholder:text-black/30"
                    disabled={!isFormOpen}
                    onChange={(event) => setNewAddressAlias(event.target.value)}
                    placeholder="별칭 (예: 집, 회사)"
                    value={newAddressAlias}
                  />
                  <input
                    className="mt-2 h-9 w-full rounded-[0.65rem] bg-white px-3 text-[13px] font-medium outline-none placeholder:text-black/30"
                    disabled={!isFormOpen}
                    onChange={(event) =>
                      setNewAddressBranchName(event.target.value)
                    }
                    placeholder="편의점 지점명"
                    value={newAddressBranchName}
                  />
                  <button
                    className="mt-3 h-9 w-full rounded-full bg-black text-[13px] font-semibold text-white disabled:bg-black/20"
                    disabled={!isFormOpen || !newAddressBranchName.trim()}
                    onClick={addDeliveryAddress}
                    type="button"
                  >
                    배송지 추가
                  </button>
                </div>
            ) : (
              <div
                className="idol-selection-enter"
                key="address-add-button"
              >
                <button
                  className="flex h-[4.25rem] w-full items-center justify-center rounded-[0.95rem] border border-dashed border-black/15 bg-[#f7f7f7] text-[14px] font-semibold text-black/45"
                  onClick={openForm}
                  type="button"
                >
                  + 새 배송지 추가
                </button>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
