# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

## API 호출

백엔드 호출·응답 파싱은 전부 `lib/auth-api.ts` 한 곳에 있다. 호출 경로가 실행 위치에 따라 갈린다:

- **브라우저** → `/api/backend/v1/...` (`app/api/backend/[...path]/route.ts` 프록시가 백엔드로 중계)
- **서버 렌더링** → `NEXT_PUBLIC_API_BASE_URL` 로 직접

파서는 서버 필드명이 달라져도 별칭 키 목록으로 조용히 폴백한다. 응답 필드를 다룰 땐
필드명 grep 만으로 판단하지 말고 실제 응답을 확인한다.

## 주석 규칙

주석은 **읽는 사람이 그걸 봐야만 컨텍스트를 잡을 수 있을 때만** 쓴다. 코드가 이미 말하는 동작의 재서술,
작업 경위, 자명한 한 줄 해설은 쓰지 않는다 — 코드만 지저분해진다.

쓸 만한 경우: 비자명한 정책 결정, 서버 응답/외부 계약의 제약, "이건 이렇게 하면 안 된다"는 함정.
쓰더라도 한두 줄로 끝낸다.

## Git / PR Rules

### Branch Name Format

브랜치명은 작업 범위가 드러나는 짧은 이름을 사용한다.

```text
FE-QA-반영
상품등록-UI-개선
```

### Commit Message Format

커밋 메시지는 제목과 본문 bullet 으로 작성한다.

```text
feat: 작업 제목

- 주요 변경 사항 1
- 주요 변경 사항 2
```

예시:

```text
fix: 상품 상세 내 입찰 현황 복구

- 상세 응답 myParticipation 입찰 정보를 옵션에 매핑
- 상품 상세 옵션 변경 시 내 입찰 상태 동기화
- 참여 목록 응답의 분철/멤버 슬롯 fallback 파싱 보정
```

리뷰 대응 커밋도 제목에 실제 수정 내용을 쓴다. `fix: 리뷰 지적 반영`, `fix: 리뷰 수정`, `fix: 코드 리뷰 반영`처럼 내용이 보이지 않는 제목은 사용하지 않는다.

나쁜 예시:

```text
fix: 리뷰 지적 반영
```

좋은 예시:

```text
fix: 결제 기한 ISO 파싱 보정

- paymentDueAt ISO 타임스탬프를 offset-aware Date로 파싱
- 결제 상세의 배송비 0원 응답을 보존
```

커밋할 때 bullet마다 `git commit -m`을 나누어 쓰지 않는다. `-m`을 여러 번 쓰면 문단 사이에 불필요한 공백이 생기기 쉽다. 대신 커밋 메시지를 UTF-8 파일로 작성한 뒤 `git commit -F <message-file>`을 사용한다.

### PR Title Format

PR 제목은 아래 형식을 사용한다.

```text
[FEAT] 작업 제목
```

예시:

```text
[FEAT] 최종 API 연결
```

### PR Body Format

PR 본문은 아래 형식을 사용한다.

```md
## 📌 작업 내용
- 작업 내용 1
- 작업 내용 2

## 💡 리뷰 포인트
- 리뷰 포인트 1
- 리뷰 포인트 2
```

예시:

```md
## 📌 작업 내용
- 분철 목록/상세/내 개최 분철/개최자 관리 화면을 실제 API 응답 기준으로 연결
- 상품 상세의 `myParticipation.bids`를 옵션별 내 입찰 현황에 매핑
- 입금 신고, 개최자 입금 확인, 미입금 만료 및 차순위 승계 API 연결
- 운송장 번호 등록 및 배송 수령 확인 API 연결

## 💡 리뷰 포인트
- API 응답 필드명이 화면별로 다를 수 있어 fallback 파싱 범위가 적절한지 확인
- 입금 기한 만료, 다음 낙찰자 없음, 입금 신고 전/후 상태별 버튼 노출 조건이 의도와 맞는지 확인
- 배송 수령 확인 버튼 노출 조건이 실제 배송 상태 전이와 맞는지 확인
```
