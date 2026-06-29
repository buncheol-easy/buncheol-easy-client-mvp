"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { BackIcon, CloseIcon } from "@/components/icons";
import { lastAddedDeliveryAddressIdKey } from "@/lib/address-return-state";
import {
  createShippingAddress,
  deleteShippingAddress,
  requestShippingAddresses,
  updateShippingAddress,
} from "@/lib/auth-api";
import {
  getInitialAuthState,
  readAuthState,
  subscribeAuthState,
} from "@/lib/auth-store";
import {
  clearDeliveryAddressState,
  getDeliveryAddressStateFromSyncedAddresses,
  getDeliveryAddressStateWithDefaultAddress,
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
  onBack?: () => void;
  openFormOnEntry?: boolean;
  returnHref?: string | null;
};

function getHistoryIndex() {
  const historyState = window.history.state as { idx?: unknown } | null;

  return typeof historyState?.idx === "number" ? historyState.idx : null;
}

export function AddressManagementContent({
  onBack,
  openFormOnEntry = false,
  returnHref = null,
}: AddressManagementContentProps) {
  const router = useRouter();
  const addressState = useSyncExternalStore(
    subscribeDeliveryAddressState,
    readDeliveryAddressState,
    getInitialDeliveryAddressState,
  );
  const authState = useSyncExternalStore(
    subscribeAuthState,
    readAuthState,
    getInitialAuthState,
  );
  const addressSyncRequestIdRef = useRef(0);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isAddressListLoading, setIsAddressListLoading] = useState(false);
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [deletingAddressIds, setDeletingAddressIds] = useState<string[]>([]);
  const [addressMessage, setAddressMessage] = useState("");
  const [newAddressStoreType, setNewAddressStoreType] =
    useState<ConvenienceStoreType>("gs25");
  const [newAddressAlias, setNewAddressAlias] = useState("");
  const [newAddressBranchName, setNewAddressBranchName] = useState("");
  const { addresses: deliveryAddresses, defaultAddressIds } = addressState;
  const canManageAddresses =
    authState.isLoggedIn && Boolean(authState.accessToken);
  const visibleAddresses = useMemo(
    () =>
      canManageAddresses
        ? getPrioritizedDeliveryAddresses(deliveryAddresses, defaultAddressIds)
        : [],
    [canManageAddresses, defaultAddressIds, deliveryAddresses],
  );
  const syncDeliveryAddresses = useCallback(async (
    accessToken: string,
    options: { clearBeforeSync?: boolean } = {},
  ) => {
    const requestId = addressSyncRequestIdRef.current + 1;

    addressSyncRequestIdRef.current = requestId;

    if (options.clearBeforeSync) {
      clearDeliveryAddressState();
    }

    try {
      const addresses = await requestShippingAddresses(accessToken);
      const nextState = getDeliveryAddressStateFromSyncedAddresses(addresses);
      const isLatest = requestId === addressSyncRequestIdRef.current;

      if (isLatest) {
        writeDeliveryAddressState(nextState);
      }

      return { isLatest, nextState };
    } catch (error) {
      if (
        options.clearBeforeSync &&
        requestId === addressSyncRequestIdRef.current
      ) {
        clearDeliveryAddressState();
      }

      throw error;
    }
  }, []);
  const invalidateAddressSyncRequests = useCallback(() => {
    addressSyncRequestIdRef.current += 1;
  }, []);

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

  useEffect(() => {
    const accessToken = authState.accessToken;

    if (!canManageAddresses || !accessToken) {
      invalidateAddressSyncRequests();
      clearDeliveryAddressState();
      setIsAddressListLoading(false);
      setAddressMessage("");
      return;
    }

    let isActive = true;

    setIsAddressListLoading(true);
    setAddressMessage("");

    syncDeliveryAddresses(accessToken, { clearBeforeSync: true })
      .then(() => {
        // The sync helper commits only if this is still the newest request.
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return;
        }

        setAddressMessage(
          error instanceof Error
            ? error.message
            : "배송지 목록을 불러오지 못했어요.",
        );
      })
      .finally(() => {
        if (isActive) {
          setIsAddressListLoading(false);
        }
      });

    return () => {
      isActive = false;
      invalidateAddressSyncRequests();
    };
  }, [
    authState.accessToken,
    canManageAddresses,
    invalidateAddressSyncRequests,
    syncDeliveryAddresses,
  ]);

  function scrollToAddressListBottom() {
    scrollContainerRef.current?.scrollTo({
      top: scrollContainerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }

  function commitAddressState(nextState: StoredDeliveryAddressState) {
    writeDeliveryAddressState(nextState);
  }

  function rememberLastAddedAddress(addressId: string) {
    if (returnHref) {
      window.sessionStorage.setItem(lastAddedDeliveryAddressIdKey, addressId);
    }
  }

  function scrollAddressListAfterChange() {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        scrollToAddressListBottom();
        window.setTimeout(scrollToAddressListBottom, 420);
      });
    });
  }

  async function addDeliveryAddress() {
    const trimmedBranchName = newAddressBranchName.trim();

    if (!trimmedBranchName || isSavingAddress) {
      return;
    }

    const addressDraft = {
      storeType: newAddressStoreType,
      alias: newAddressAlias.trim() || undefined,
      branchName: trimmedBranchName,
      address: "",
    };
    const accessToken = authState.accessToken;

    setAddressMessage("");

    if (!canManageAddresses || !accessToken) {
      setAddressMessage("배송지는 로그인 후 이용할 수 있어요.");
      return;
    }

    setIsSavingAddress(true);

    try {
      const previousAddressIds = new Set(
        deliveryAddresses.map((address) => address.id),
      );

      await createShippingAddress(accessToken, {
        ...addressDraft,
        isDefault: !defaultAddressIds[newAddressStoreType],
      });

      const { nextState } = await syncDeliveryAddresses(accessToken);
      const addedAddress =
        nextState.addresses.find(
          (address) => !previousAddressIds.has(address.id),
        ) ?? null;

      closeForm();

      if (addedAddress) {
        rememberLastAddedAddress(addedAddress.id);
      }

      scrollAddressListAfterChange();
    } catch (error) {
      setAddressMessage(
        error instanceof Error ? error.message : "배송지를 등록하지 못했어요.",
      );
    } finally {
      setIsSavingAddress(false);
    }
  }

  async function setAsDefaultAddress(addressId: string) {
    const selectedAddress = deliveryAddresses.find(
      (address) => address.id === addressId,
    );

    if (!selectedAddress) {
      return;
    }

    const accessToken = authState.accessToken;

    setAddressMessage("");

    if (authState.isLoggedIn && accessToken) {
      try {
        await updateShippingAddress(accessToken, selectedAddress.id, {
          alias: selectedAddress.alias,
          branchName: selectedAddress.branchName,
          isDefault: true,
          storeType: selectedAddress.storeType,
        });
        const { isLatest, nextState } = await syncDeliveryAddresses(accessToken);

        if (isLatest) {
          commitAddressState(
            getDeliveryAddressStateWithDefaultAddress(nextState, addressId),
          );
        }
      } catch (error) {
        setAddressMessage(
          error instanceof Error
            ? error.message
            : "기본 배송지를 변경하지 못했어요.",
        );
      }

      return;
    }

    commitAddressState(
      getDeliveryAddressStateWithDefaultAddress(addressState, addressId),
    );
  }

  async function deleteDeliveryAddress(addressId: string) {
    if (deliveryAddresses.length <= 1) {
      return;
    }

    const targetAddress = deliveryAddresses.find(
      (address) => address.id === addressId,
    );

    if (!targetAddress) {
      return;
    }

    const accessToken = authState.accessToken;

    setAddressMessage("");

    if (authState.isLoggedIn && accessToken) {
      setDeletingAddressIds((current) => [...current, addressId]);

      try {
        await deleteShippingAddress(accessToken, addressId);
        await syncDeliveryAddresses(accessToken);
      } catch (error) {
        setAddressMessage(
          error instanceof Error
            ? error.message
            : "배송지를 삭제하지 못했어요.",
        );
      } finally {
        setDeletingAddressIds((current) =>
          current.filter((currentAddressId) => currentAddressId !== addressId),
        );
      }

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
    if (onBack) {
      onBack();
      return;
    }

    const historyIndex = getHistoryIndex();

    if (historyIndex !== null && historyIndex > 0) {
      router.back();
      return;
    }

    router.replace(returnHref ?? "/profile");
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#f7f7f7]">
      <header className="profile-header shrink-0 bg-white px-4 py-3">
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
        className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-4"
        ref={scrollContainerRef}
      >
        <section className="rounded-[1.2rem] border border-black/10 bg-white p-4 shadow-[0_14px_34px_rgba(0,0,0,0.04)]">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-[19px] font-semibold tracking-[-0.05em]">
                등록된 배송지
              </h2>
              <p className="mt-1 text-[13px] font-medium text-black/45">
                상품 배송 방식에 맞는 지점을 저장해요.
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-[#f4f4f4] px-3 py-2 text-[12px] font-semibold text-black/45">
              {visibleAddresses.length}개
            </span>
          </div>
          {isAddressListLoading || addressMessage ? (
            <p className="mb-3 rounded-full bg-[#f7f7f7] px-3 py-2 text-[13px] font-semibold text-black/45">
              {addressMessage || "배송지를 불러오는 중이에요."}
            </p>
          ) : null}
          <div className="grid gap-3">
            {!canManageAddresses ? (
              <div className="rounded-[0.95rem] bg-[#f7f7f7] px-4 py-6">
                <p className="text-[14px] font-medium text-black/45">
                  배송지는 로그인 후 이용할 수 있어요.
                </p>
              </div>
            ) : null}
            {visibleAddresses.map((address) => {
              const isDefault =
                address.id === defaultAddressIds[address.storeType];

              return (
                <div
                  className={`w-full rounded-[1rem] border px-4 py-4 text-left transition-colors ${
                    isDefault
                      ? "border-[#C8D4A5] bg-[#F3F5EA]"
                      : "border-black/10 bg-[#f7f7f7]"
                  }`}
                  key={address.id}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1 pr-1">
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                            isDefault
                              ? "bg-[#DDE7B8] text-black"
                              : "bg-white text-black/55"
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
                        <p className="mt-3 truncate text-[15px] font-semibold tracking-[-0.04em]">
                          {address.branchName}
                        </p>
                      </div>
                    {isDefault ? (
                      <div className="flex w-[8.3rem] shrink-0 items-center justify-end gap-2">
                        <span className="inline-flex h-8 items-center rounded-full bg-[#DDE7B8] px-2.5 text-[12px] font-semibold text-black">
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
                          disabled={deletingAddressIds.includes(address.id)}
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

            {canManageAddresses ? (
              isFormOpen ? (
              <div
                className="idol-selection-enter rounded-[1rem] bg-[#f7f7f7] px-3 pb-3 pt-4"
                key="address-form"
              >
                  <div className="flex items-start justify-between gap-3 px-1">
                    <div>
                    <p className="text-[15px] font-semibold tracking-[-0.04em]">
                      새 배송지 추가
                    </p>
                    <p className="mt-1 text-[12px] font-medium text-black/40">
                      결제할 때 선택할 편의점 지점을 등록해요.
                    </p>
                    </div>
                    <button
                      className="shrink-0 rounded-full bg-white px-3 py-2 text-[12px] font-semibold text-black/45 ring-1 ring-black/10"
                      disabled={!isFormOpen}
                      onClick={closeForm}
                      type="button"
                    >
                      닫기
                    </button>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 rounded-[0.85rem] bg-white p-1 ring-1 ring-black/10">
                    {convenienceStoreTypes.map((storeType) => (
                      <button
                        className={`h-10 rounded-[0.7rem] text-[13px] font-semibold transition-colors duration-300 ease-out ${
                          newAddressStoreType === storeType
                            ? "bg-[#DDE7B8] text-black"
                            : "text-black/45"
                        }`}
                        key={storeType}
                        onMouseDown={(event) => {
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
                  <label className="mt-3 block rounded-[0.9rem] bg-white px-3 py-3 ring-1 ring-black/10 transition focus-within:ring-black/35">
                    <span className="text-[12px] font-semibold text-black/45">
                      별칭
                    </span>
                    <input
                      className="mt-1 h-8 w-full bg-transparent text-[14px] font-semibold outline-none placeholder:text-black/25"
                      disabled={!isFormOpen}
                      onChange={(event) => setNewAddressAlias(event.target.value)}
                      placeholder="집, 회사"
                      value={newAddressAlias}
                    />
                  </label>
                  <label className="mt-2 block rounded-[0.9rem] bg-white px-3 py-3 ring-1 ring-black/10 transition focus-within:ring-black/35">
                    <span className="text-[12px] font-semibold text-black/45">
                      지점명
                    </span>
                    <input
                      className="mt-1 h-8 w-full bg-transparent text-[14px] font-semibold outline-none placeholder:text-black/25"
                      disabled={!isFormOpen}
                      onChange={(event) =>
                        setNewAddressBranchName(event.target.value)
                      }
                      placeholder="GS25 강남점"
                      value={newAddressBranchName}
                    />
                  </label>
                  <button
                    className="mt-3 h-11 w-full rounded-full bg-[#D7FF5F] text-[14px] font-semibold text-black shadow-[0_10px_24px_rgba(215,255,95,0.24)] disabled:bg-black/20 disabled:text-white"
                    disabled={
                      !isFormOpen ||
                      !newAddressBranchName.trim() ||
                      isSavingAddress
                    }
                    onClick={addDeliveryAddress}
                    type="button"
                  >
                    {isSavingAddress ? "저장 중" : "배송지 추가"}
                  </button>
                </div>
              ) : (
              <div
                className="idol-selection-enter"
                key="address-add-button"
              >
                <button
                  className="flex h-[4.25rem] w-full items-center justify-center rounded-[1rem] border border-dashed border-black/15 bg-white text-[14px] font-semibold text-black/45"
                  onClick={openForm}
                  type="button"
                >
                  + 새 배송지 추가
                </button>
              </div>
              )
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
