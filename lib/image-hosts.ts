// 사진을 받아 오는 저장소 호스트. 중계·수정 화면의 허용 판정에 쓴다.
// next/image 최적화 허용 목록은 next.config.ts 와 lib/optimizable-image.ts 에 따로 있다.
// ⚠️ next.config.ts 에서 이 파일을 import 하지 말 것 — Docker 실행 단계가 next.config.ts 만 복사해 `next start` 가 깨진다.
export const IMAGE_HOSTS: ReadonlySet<string> = new Set([
  "images.buncheoleasy.com",
  "buncheol-easy-bucket.s3.ap-northeast-2.amazonaws.com",
]);
