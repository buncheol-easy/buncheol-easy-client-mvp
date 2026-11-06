import Image from "next/image";
import type { TestAccountRole } from "@/lib/test-account-store";

type TestAccountAvatarProps = {
  role: TestAccountRole | null;
  size: number;
};

// 참여자는 웃는 송니, 개최자는 머리띠를 맨 응원 송니다.
export function TestAccountAvatar({ role, size }: TestAccountAvatarProps) {
  const isHost = role === "host";

  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 overflow-hidden rounded-full shadow-[inset_0_0_0_1px_rgba(17,17,17,0.06)] ${
        isHost ? "bg-[#1c1c1c]" : "bg-[#eef6d2]"
      }`}
      style={{ height: size, width: size }}
    >
      <Image
        alt=""
        className="h-full w-full"
        height={size}
        src={isHost ? "/mascot/songni-cheer.png" : "/mascot/songni-face.png"}
        width={size}
      />
    </span>
  );
}
