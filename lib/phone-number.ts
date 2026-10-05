// 휴대폰 번호는 01X 로 시작하는 11자리만 받는다(서버 PhoneNumber 와 맞춰야 하는 규칙). 10자리를 받으면 010 번호의 한 자리
// 누락 오타가 통과해 알림톡이 안 가는 번호가 배송 연락처로 고정된다. 011·016~019 11자리 번호도 쓰여 010 으로 좁히지 않는다.
const phoneNumberPattern = /^01\d{9}$/;

export function sanitizePhoneNumber(value: string) {
  return value.replace(/\D/g, "").slice(0, 11);
}

export function isValidPhoneNumber(value: string) {
  return phoneNumberPattern.test(value);
}
