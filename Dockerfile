FROM node:24-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci


FROM node:24-alpine AS build

WORKDIR /app

# NEXT_PUBLIC_* 는 next build 시점에 번들에 박힌다. 박스 빌드 시절에는 배포 디렉터리의
# .env.production 이 빌드 컨텍스트에 포함돼 주입됐지만, GitHub 호스팅 러너 빌드에는 그 파일이
# 없으므로 build-arg 로 받는다(값은 워크플로의 GitHub Variables — 전부 브라우저 노출 공개값).
# 빈 값이면 해당 기능이 비활성된다(GA/PostHog 는 코드에서 키 없으면 init 스킵).
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_GA_ID
ARG NEXT_PUBLIC_POSTHOG_KEY
ARG NEXT_PUBLIC_POSTHOG_HOST
ARG NEXT_PUBLIC_KAKAO_MAP_APP_KEY
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL \
    NEXT_PUBLIC_GA_ID=$NEXT_PUBLIC_GA_ID \
    NEXT_PUBLIC_POSTHOG_KEY=$NEXT_PUBLIC_POSTHOG_KEY \
    NEXT_PUBLIC_POSTHOG_HOST=$NEXT_PUBLIC_POSTHOG_HOST \
    NEXT_PUBLIC_KAKAO_MAP_APP_KEY=$NEXT_PUBLIC_KAKAO_MAP_APP_KEY

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build


FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/next.config.ts ./next.config.ts

EXPOSE 3000

CMD ["npm", "run", "start"]
