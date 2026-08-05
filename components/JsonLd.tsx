type JsonLdProps = {
  data: Record<string, unknown>;
};

export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        // "</script>" 조기 종료 방지 — JSON 안의 "<" 를 유니코드 이스케이프로 치환한다.
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
