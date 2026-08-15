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

      // 세로로 스크롤할 여지가 없는 요소(가로 레일 등)는 대상이 아니다.
      if (maxScrollTop <= 0) {
        return;
      }

      const nextScrollTop = Math.max(0, Math.min(scrollTop, maxScrollTop));
      const previousScrollTop = lastScrollTops.get(element) ?? 0;

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
