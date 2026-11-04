// 애플 연결 파일. 여기 적힌 앱만 이 도메인의 https 주소(/login/app)로 카카오 앱 로그인 결과를 받을 수 있다 —
// 앱을 추가하는 것은 그 앱에 로그인 코드를 받을 자격을 주는 일이다. 형식: <애플 팀 ID>.<번들 ID>.
// staging·운영 두 앱을 양쪽 도메인에 다 적는다(앱이 실제로 쓰는 도메인은 앱 빌드 설정의 associatedDomains 가 정한다).
const APPLE_APP_IDS = [
  "MUKV4GW7AU.com.buncheoleasy.app",
  "MUKV4GW7AU.com.buncheoleasy.app.staging",
];

export function GET() {
  return Response.json(
    { webcredentials: { apps: APPLE_APP_IDS } },
    { headers: { "Cache-Control": "public, max-age=3600" } },
  );
}
