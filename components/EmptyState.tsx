import Link from "next/link";

/*
 * 비어 있는 화면 공통 틀.
 *
 * 지금까지는 화면마다 "로그인 후 이용할 수 있어요." 한 문장만 박스에 넣어 뒀는데,
 * 거기서 할 수 있는 게 아무것도 없어 막다른 길이었다 (로그인하려면 하단 탭을 다시 눌러야 했다).
 * 빈 화면은 항상 세 가지를 말한다 — 왜 비었는지 / 여기서 무엇을 얻는지 / 다음에 뭘 누르면 되는지.
 */
// 필터를 되돌리는 버튼처럼 이동이 아닌 동작도 있어 href/onClick 둘 다 받는다.
type EmptyStateAction = {
  href?: string;
  label: string;
  onClick?: () => void;
};

const actionClassName =
  "mx-auto mt-5 flex h-12 w-full max-w-[240px] items-center justify-center rounded-full bg-[#CFE86B] text-[14px] font-semibold tracking-[-0.04em] text-black shadow-[0_10px_24px_rgba(120,132,82,0.2)]";
const secondaryActionClassName =
  "mx-auto mt-2 flex w-fit items-center justify-center px-3 py-2 text-[13px] font-semibold tracking-[-0.04em] text-black/45";

type EmptyStateProps = {
  action?: EmptyStateAction;
  description?: string;
  secondaryAction?: EmptyStateAction;
  title: string;
};

export function EmptyState({
  action,
  description,
  secondaryAction,
  title,
}: EmptyStateProps) {
  return (
    <div className="content-reveal rounded-[0.95rem] border border-[#E4F6A5]/80 bg-[#F7FAEE] px-4 py-8 text-center">
      <p className="text-[15px] font-semibold tracking-[-0.04em] text-black/70">
        {title}
      </p>
      {description ? (
        <p className="mt-1.5 break-keep text-[13px] font-medium leading-5 text-black/40">
          {description}
        </p>
      ) : null}
      {action ? (
        action.href ? (
          <Link className={actionClassName} href={action.href}>
            {action.label}
          </Link>
        ) : (
          <button
            className={actionClassName}
            onClick={action.onClick}
            type="button"
          >
            {action.label}
          </button>
        )
      ) : null}
      {secondaryAction ? (
        secondaryAction.href ? (
          <Link className={secondaryActionClassName} href={secondaryAction.href}>
            {secondaryAction.label} ›
          </Link>
        ) : (
          <button
            className={secondaryActionClassName}
            onClick={secondaryAction.onClick}
            type="button"
          >
            {secondaryAction.label} ›
          </button>
        )
      ) : null}
    </div>
  );
}
