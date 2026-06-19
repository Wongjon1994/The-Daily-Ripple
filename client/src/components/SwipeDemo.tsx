/**
 * Swipe Navigation Demo
 * Shows how users can swipe left/right to navigate between stories
 * and tap to expand/collapse for more details
 */

import { useState, useRef, useEffect } from "react";
import type { DailyBrief } from "@/lib/briefParser";
import BriefCard from "./BriefCard";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface SwipeDemoProps {
  brief: DailyBrief;
  currentIndex?: number;
  onPrevious?: () => void;
  onNext?: () => void;
  briefUrl?: string | null;
}

export default function SwipeDemo({ brief, currentIndex: externalIndex, onPrevious, onNext, briefUrl }: SwipeDemoProps) {
  const [internalIndex, setInternalIndex] = useState(0);
  const currentIndex = externalIndex !== undefined ? externalIndex : internalIndex;
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const mouseStartX = useRef(0);
  const isMouseDown = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isProcessing = useRef(false); // Prevent double-firing

  const currentSection = brief.sections[currentIndex];

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].screenX;
    isProcessing.current = false;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (isProcessing.current) return; // Prevent double-firing
    isProcessing.current = true;

    touchEndX.current = e.changedTouches[0].screenX;
    const diff = touchStartX.current - touchEndX.current;

    // Prevent browser back gesture (Telegram, Safari) on right swipes
    if (Math.abs(diff) > 30) {
      e.preventDefault();
    }

    handleSwipe();

    // Reset after a longer delay to ensure state updates complete
    setTimeout(() => {
      isProcessing.current = false;
    }, 300);
  };

  const handleSwipe = () => {
    const swipeThreshold = 80; // Increased threshold to prevent accidental swipes
    const diff = touchStartX.current - touchEndX.current;

    if (Math.abs(diff) > swipeThreshold) {
      if (diff > 0) {
        // Swiped left - next story
        goToNext();
      } else {
        // Swiped right - previous story
        goToPrevious();
      }
    }
  };

  const goToPrevious = () => {
    if (onPrevious) {
      onPrevious();
    } else {
      setInternalIndex((prev) => (prev - 1 + brief.sections.length) % brief.sections.length);
    }
  };

  const goToNext = () => {
    if (onNext) {
      onNext();
    } else {
      setInternalIndex((prev) => (prev + 1) % brief.sections.length);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isProcessing.current) return;
    isMouseDown.current = true;
    mouseStartX.current = e.clientX;
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isMouseDown.current || isProcessing.current) return;
    isMouseDown.current = false;
    isProcessing.current = true;

    const diff = mouseStartX.current - e.clientX;
    const dragThreshold = 50;

    if (Math.abs(diff) > dragThreshold) {
      if (diff > 0) {
        goToNext();
      } else {
        goToPrevious();
      }
    }

    // Reset after a short delay
    setTimeout(() => {
      isProcessing.current = false;
    }, 150);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isProcessing.current) return;
      if (e.key === 'ArrowLeft') {
        isProcessing.current = true;
        goToPrevious();
        setTimeout(() => {
          isProcessing.current = false;
        }, 150);
      } else if (e.key === 'ArrowRight') {
        isProcessing.current = true;
        goToNext();
        setTimeout(() => {
          isProcessing.current = false;
        }, 150);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onPrevious, onNext]);

  const handleDotClick = (idx: number) => {
    if (isProcessing.current) return;
    isProcessing.current = true;

    if (externalIndex !== undefined && onNext && onPrevious) {
      // External state management - navigate step by step with delays
      const navigateSteps = async () => {
        if (idx > currentIndex) {
          for (let i = currentIndex; i < idx; i++) {
            onNext();
            await new Promise(resolve => setTimeout(resolve, 150));
          }
        } else if (idx < currentIndex) {
          for (let i = currentIndex; i > idx; i--) {
            onPrevious();
            await new Promise(resolve => setTimeout(resolve, 150));
          }
        }
        isProcessing.current = false;
      };
      navigateSteps();
    } else {
      // Internal state management - jump directly
      setInternalIndex(idx);
      setTimeout(() => {
        isProcessing.current = false;
      }, 300);
    }
  };

  const total = brief.sections.length;
  const prevIndex = (currentIndex - 1 + total) % total;
  const nextIndex = (currentIndex + 1) % total;

  const arrowClass =
    "hidden lg:flex absolute top-1/2 -translate-y-1/2 z-20 items-center justify-center rounded-full w-11 h-11 " +
    "border border-border/70 bg-background/70 backdrop-blur-sm transition-colors " +
    "text-mist-dim hover:text-[var(--color-cyan)] hover:border-[var(--color-cyan)]/50 " +
    "disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <div className="brief-spotlight w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10">
      {/* Story counter — large current number, BT-style */}
      <div className="text-center mb-6 sm:mb-7">
        <span className="text-2xl sm:text-3xl font-bold leading-none" style={{ color: "var(--color-mist)" }}>
          {currentIndex + 1}
        </span>
        <span className="text-base sm:text-lg ml-2" style={{ color: "var(--color-mist-faint)" }}>
          of {total}
        </span>
      </div>

      {/* Carousel: peeks flank a centered focal card, arrows float in the margins */}
      <div className="relative">
        <div className="relative mx-auto overflow-hidden px-0" style={{ maxWidth: "min(100%, 760px)" }}>
          <div className="relative w-full max-w-[600px] mx-auto">
            {/* Left peek (previous story) */}
            {total > 1 && (
              <div
                onClick={goToPrevious}
                aria-hidden="true"
                className="hidden lg:block absolute top-0 bottom-0 right-full mr-4 w-[300px] origin-right scale-[0.94] opacity-30 overflow-hidden cursor-pointer hover:opacity-50 transition-opacity"
              >
                <div className="pointer-events-none">
                  <BriefCard section={brief.sections[prevIndex]} briefUrl={briefUrl} />
                </div>
              </div>
            )}

            {/* Focal card */}
            <div
              ref={containerRef}
              className="relative z-10 rounded-xl cursor-grab active:cursor-grabbing touch-none select-none"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              onTouchMove={(e) => {
                const touch = e.touches[0];
                const diff = Math.abs(touchStartX.current - touch.screenX);
                if (diff > 10) e.preventDefault();
              }}
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
              onMouseLeave={() => {
                isMouseDown.current = false;
              }}
            >
              <BriefCard section={currentSection} briefUrl={briefUrl} elevated />
            </div>

            {/* Right peek (next story) */}
            {total > 1 && (
              <div
                onClick={goToNext}
                aria-hidden="true"
                className="hidden lg:block absolute top-0 bottom-0 left-full ml-4 w-[300px] origin-left scale-[0.94] opacity-30 overflow-hidden cursor-pointer hover:opacity-50 transition-opacity"
              >
                <div className="pointer-events-none">
                  <BriefCard section={brief.sections[nextIndex]} briefUrl={briefUrl} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Floating circular arrows — at the focal card's edges on desktop */}
        <button
          onClick={goToPrevious}
          disabled={isProcessing.current}
          className={cn(arrowClass, "left-1 sm:left-2 lg:left-[calc(50%-372px)]")}
          aria-label="Previous story"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          onClick={goToNext}
          disabled={isProcessing.current}
          className={cn(arrowClass, "right-1 sm:right-2 lg:right-[calc(50%-372px)]")}
          aria-label="Next story"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Progress dots, flanked by prev/next arrows on mobile so the swipe
          gesture is discoverable (desktop uses the floating side arrows). */}
      <div className="flex items-center justify-center gap-3 sm:gap-4 mt-7 sm:mt-8">
        <button
          onClick={goToPrevious}
          disabled={isProcessing.current}
          aria-label="Previous story"
          className="lg:hidden flex items-center justify-center rounded-full w-9 h-9 shrink-0 border border-border/70 bg-background/70 text-mist-dim transition-colors active:scale-95 hover:text-[var(--color-cyan)] hover:border-[var(--color-cyan)]/50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-center">
          {brief.sections.map((_, idx) => (
            <button
              key={idx}
              onClick={() => handleDotClick(idx)}
              disabled={isProcessing.current}
              className={cn(
                "rounded-full transition-all duration-200",
                idx === currentIndex
                  ? "w-2 sm:w-2.5 h-2 sm:h-2.5 bg-[var(--color-cyan)]"
                  : "w-1.5 sm:w-2 h-1.5 sm:h-2 bg-[var(--border)] hover:bg-[var(--muted-foreground)]",
                "disabled:cursor-not-allowed"
              )}
              aria-label={`Go to story ${idx + 1}`}
            />
          ))}
        </div>

        <button
          onClick={goToNext}
          disabled={isProcessing.current}
          aria-label="Next story"
          className="lg:hidden flex items-center justify-center rounded-full w-9 h-9 shrink-0 border border-border/70 bg-background/70 text-mist-dim transition-colors active:scale-95 hover:text-[var(--color-cyan)] hover:border-[var(--color-cyan)]/50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Mobile swipe hint */}
      <p className="lg:hidden text-center text-[11px] mt-2.5" style={{ color: "var(--color-mist-faint)" }}>
        Swipe or tap the arrows to move between stories
      </p>
    </div>
  );
}
