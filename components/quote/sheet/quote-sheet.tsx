"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { useBrand } from "@/components/brand/brand-provider";
import { MilimlabSheet } from "@/components/quote/sheet/milimlab-sheet";
import { OptosenseSheet } from "@/components/quote/sheet/optosense-sheet";
import { TeknotipSheet } from "@/components/quote/sheet/teknotip-sheet";
import type { QuoteSheetProps } from "@/components/quote/sheet/sheet-types";

const PAGE_WIDTH = 794;
/** Üst ve yanlarda aynı sabit pay. Safari yüzde genişliği dolgu kutusundan ölçtüğü için pay margin ile verilir. */
const STAGE_INSET = 20;

export function QuoteSheet(props: QuoteSheetProps) {
  const { brand } = useBrand();
  const fitRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const [frameWidth, setFrameWidth] = useState(PAGE_WIDTH);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState(0);

  useLayoutEffect(() => {
    const fit = fitRef.current;
    const paper = paperRef.current;
    if (!fit || !paper) return;

    const update = () => {
      const scroller = fit.closest(".overflow-y-auto");
      const viewport =
        scroller instanceof HTMLElement
          ? scroller.clientWidth
          : (fit.parentElement?.clientWidth ?? PAGE_WIDTH + STAGE_INSET * 2);
      const nextWidth = Math.max(Math.floor(viewport - STAGE_INSET * 2), 1);
      setFrameWidth((current) => (current === nextWidth ? current : nextWidth));
      const nextScale = nextWidth / PAGE_WIDTH;
      setScale((current) => (Math.abs(current - nextScale) < 0.002 ? current : nextScale));
      const nextHeight = paper.offsetHeight;
      setHeight((current) => (current === nextHeight ? current : nextHeight));
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(paper);
    const scroller = fit.closest(".overflow-y-auto");
    if (scroller instanceof HTMLElement) observer.observe(scroller);
    return () => observer.disconnect();
  }, [brand, props.quote, props.showImages]);

  const sheet =
    brand === "OPTOSENSE" ? (
      <OptosenseSheet {...props} />
    ) : brand === "MILIMLAB" ? (
      <MilimlabSheet {...props} />
    ) : (
      <TeknotipSheet {...props} />
    );

  return (
    <div className="quote-stage">
      <div
        ref={fitRef}
        className="quote-fit"
        style={{ width: frameWidth, margin: STAGE_INSET }}
      >
        <div
          style={{
            height: height ? Math.ceil(height * scale) : undefined,
            width: "100%",
          }}
        >
          <div
            ref={paperRef}
            className="quote-sheet"
            style={{
              width: PAGE_WIDTH,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          >
            {sheet}
          </div>
        </div>
      </div>
    </div>
  );
}
