"use client";

import { useEffect, useState } from "react";

/*
 * 스크롤을 내리면 화면 크롬(하단 탭)을 숨기고, 올리면 다시 보여준다.
 *
 * 이 앱의 스크롤 컨테이너는 문서가 아니라 화면마다 다른 overflow-y 요소다
 * (main 은 h-[100dvh] overflow-hidden, 그 안의 div 가 스크롤을 갖는다).
 * 화면별로 onScroll 을 하나하나 연결하면 새 화면을 만들 때마다 빠뜨리게 되므로,
 * document 에 캡처 단계 리스너를 하나만 달아 어떤 요소에서 스크롤이 나든 받는다.
 * (scroll 이벤트는 버블링하지 않지만 캡처 단계에서는 document 까지 내려온다.)
 *
 * 가로 스크롤러(배너 캐러셀·칩 레일)는 scrollTop 이 그대로라 자연히 걸러진다.
 */

const REVEAL_THRESHOLD = 8;
const HIDE_START = 24;
/*
 * 바닥에서 이만큼 안쪽이면 숨기지 않는다.
 * 두 가지를 동시에 막는다.
 *  1) 목록 끝에서 탭이 사라진 채로 갇히는 것.
 *  2) 스크롤 위치 튐 — 탭이 비켜나면 스크롤 뷰포트가 탭 높이만큼 커지고
 *     그만큼 maxScrollTop 이 줄어든다. 바닥 가까이에서 그런 일이 생기면 브라우저가
 *     scrollTop 을 clamp 하면서 화면이 덜컥 움직인다. 가드를 탭 높이(약 64px)보다
 *     넉넉히 잡아 그 구간에서는 아예 숨기지 않는다.
 */
const BOTTOM_EDGE_GUARD = 120;

function getScrollMetrics(target: EventTarget | null) {
  if (target instanceof HTMLElement) {
    return {
      clientHeight: target.clientHeight,
      element: target as Element,
      scrollHeight: target.scrollHeight,
      scrollTop: target.scrollTop,
    };
  }

  if (target === document || target === window) {
    const scrollingElement = document.scrollingElement;

    if (!scrollingElement) {
      return null;
    }

    return {
      clientHeight: scrollingElement.clientHeight,
      element: scrollingElement,
      scrollHeight: scrollingElement.scrollHeight,
      scrollTop: scrollingElement.scrollTop,
    };
  }

  return null;
}

// 시트 안쪽 스크롤은 무시한다 — 시트가 덮고 있는 동안의 크롬 상태는 시트가 결정한다.
function isInsideOverlay(element: Element) {
  return Boolean(element.closest('[role="dialog"], .bid-sheet-panel'));
}

export function useScrollDirectionHidden() {
  const [isHidden, setIsHidden] = useState(false);

  useEffect(() => {
    // 요소별 직전 scrollTop. WeakMap 이라 언마운트된 컨테이너는 알아서 정리된다.
    const lastScrollTops = new WeakMap<Element, number>();

    function handleScroll(event: Event) {
      const metrics = getScrollMetrics(event.target);

      if (!metrics || isInsideOverlay(metrics.element)) {
        return;
      }

      const { clientHeight, element, scrollHeight, scrollTop } = metrics;
      const maxScrollTop = scrollHeight - clientHeight;

      /*
       * 세로로 스크롤할 여지가 없는 요소.
       *
       * 가로 레일(배너 캐러셀·칩 레일)이 여기로 들어오는데, 이들은 아래
       * lastScrollTops.set 까지 도달한 적이 없으므로 map 에 없다 — 그냥 흘려보낸다.
       *
       * 반대로 map 에 있다면 "세로 스크롤 컨테이너였는데 콘텐츠가 줄어 더 이상
       * 스크롤되지 않게 된" 경우다. 예: 참여 내역에서 아래로 스크롤해 탭을 숨긴 뒤
       * "입금 필요" 필터를 눌러 목록이 한 장으로 줄어드는 흐름.
       * 이때 되살리지 않으면 이 요소에서는 다시 스크롤 이벤트가 날 수 없어 탭이
       * 영영 숨은 채로 남는다 — 설치형 PWA 는 브라우저 뒤로가기도 없어 화면에 갇힌다.
       */
      if (maxScrollTop <= 0) {
        if (lastScrollTops.has(element)) {
          lastScrollTops.delete(element);
          setIsHidden(false);
        }

        return;
      }

      const nextScrollTop = Math.max(0, Math.min(scrollTop, maxScrollTop));
      const hasPreviousScrollTop = lastScrollTops.has(element);
      const previousScrollTop = lastScrollTops.get(element) ?? nextScrollTop;

      lastScrollTops.set(element, nextScrollTop);

      // 맨 위에서는 항상 보인다.
      if (nextScrollTop <= REVEAL_THRESHOLD) {
        setIsHidden(false);
        return;
      }

      // 바닥 근처에서도 되살린다 — 목록 끝(푸터·마지막 카드)에서 탭이 사라진 채로
      // 갇히면 다른 화면으로 이동할 방법이 없어진다.
      if (maxScrollTop - nextScrollTop <= BOTTOM_EDGE_GUARD) {
        setIsHidden(false);
        return;
      }

      /*
       * 처음 보는 컨테이너는 방향을 판단할 기준이 없다 — 위치만 기록하고 넘어간다.
       * 직전 값을 0 으로 가정하면, 스크롤 위치가 복원된 화면(목록 → 상세 → 뒤로가기)에서
       * 사용자가 위로 올리는 첫 제스처가 "아래로 많이 내렸다"로 읽혀 탭이 잘못 숨었다.
       */
      if (!hasPreviousScrollTop) {
        return;
      }

      // 미세한 흔들림(스크롤 바운스·관성 잔여)으로 토글되지 않게 한다.
      if (Math.abs(nextScrollTop - previousScrollTop) <= REVEAL_THRESHOLD) {
        return;
      }

      const shouldHide =
        nextScrollTop > previousScrollTop && nextScrollTop > HIDE_START;

      setIsHidden((current) => (current === shouldHide ? current : shouldHide));
    }

    document.addEventListener("scroll", handleScroll, {
      capture: true,
      passive: true,
    });

    return () => {
      document.removeEventListener("scroll", handleScroll, { capture: true });
    };
  }, []);

  return isHidden;
}
