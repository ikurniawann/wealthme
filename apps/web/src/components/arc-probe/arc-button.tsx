"use client";

// Adapted from Arc's free Button: https://uiarc.dev/r/button.json
import {
  forwardRef,
  isValidElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
} from "react";
import type { ButtonHTMLAttributes, ReactNode, Ref, RefObject } from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useIsPresent,
  useMotionValue,
  useReducedMotion,
} from "motion/react";
import type { TargetAndTransition, Variants } from "motion/react";

import { motionTokens } from "./motion-tokens";
import styles from "./arc-button.module.css";

export interface ArcButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "onDrag" | "onDragEnd" | "onDragStart" | "onAnimationStart"
> {
  loading?: boolean;
}

const pressVariants: Variants = {
  pressed: (button: RefObject<HTMLButtonElement | null>) => {
    const width = button.current?.offsetWidth ?? 0;
    return {
      scale: width > 220 ? 0.985 : width && width <= 48 ? 0.96 : 0.97,
      transition: {
        duration: motionTokens.duration.instant,
        ease: [...motionTokens.ease.standard],
      },
    };
  },
};

const rest: TargetAndTransition = {
  opacity: 1,
  y: 0,
  scale: 1,
  filter: "blur(0px)",
};
const textIn: TargetAndTransition = {
  opacity: 0,
  y: 4,
  filter: `blur(${motionTokens.blur.soft}px)`,
};
const textOut: TargetAndTransition = {
  opacity: 0,
  y: -3,
  filter: `blur(${motionTokens.blur.soft}px)`,
  transition: {
    duration: motionTokens.duration.fast,
    ease: [...motionTokens.ease.standard],
  },
};
const fadeIn: TargetAndTransition = { ...rest, opacity: 0 };
const fadeOut: TargetAndTransition = {
  opacity: 0,
  transition: { duration: motionTokens.duration.instant },
};

function labelKey(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (
    typeof node === "string" ||
    typeof node === "number" ||
    typeof node === "bigint"
  )
    return String(node);
  if (Array.isArray(node)) return node.map(labelKey).join("");
  if (!isValidElement(node)) return "";
  const type = node.type as string | { displayName?: string; name?: string };
  const name =
    typeof type === "string" ? type : (type?.displayName ?? type?.name ?? "");
  return `<${name}>${labelKey((node.props as { children?: ReactNode }).children)}`;
}

function useMorphWidth(
  content: RefObject<HTMLElement | null>,
  key: string,
  reduced: boolean,
) {
  const width = useMotionValue<number | "auto">("auto");
  const lastKey = useRef(key);
  const armedUntil = useRef(0);
  useLayoutEffect(() => {
    if (lastKey.current === key) return;
    lastKey.current = key;
    armedUntil.current = performance.now() + 700;
  }, [key]);
  useEffect(() => {
    const node = content.current;
    const slot = node?.parentElement;
    if (!node || !slot || typeof ResizeObserver === "undefined") return;
    let measured = false;
    const observer = new ResizeObserver(([entry]) => {
      const next = entry.contentRect.width;
      if (
        !next ||
        !measured ||
        reduced ||
        performance.now() > armedUntil.current
      ) {
        measured = next > 0;
        width.jump(next || "auto");
        delete slot.dataset.morphing;
        return;
      }
      slot.dataset.morphing = "";
      animate(width, next, {
        ...motionTokens.spring.morph,
        onComplete: () => {
          delete slot.dataset.morphing;
        },
      });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [content, reduced, width]);
  return width;
}

function LabelPhase({
  children,
  reduced,
  ref,
}: {
  children: ReactNode;
  reduced: boolean;
  ref?: Ref<HTMLSpanElement>;
}) {
  const present = useIsPresent();
  return (
    <motion.span
      ref={ref}
      className={styles.labelPhase}
      aria-hidden={present ? undefined : true}
      initial={reduced ? fadeIn : textIn}
      animate={rest}
      exit={reduced ? fadeOut : textOut}
      transition={
        reduced
          ? { duration: motionTokens.duration.instant }
          : {
              duration: motionTokens.duration.standard,
              ease: [...motionTokens.ease.enter],
            }
      }
    >
      {children}
    </motion.span>
  );
}

export const ArcButton = forwardRef<HTMLButtonElement, ArcButtonProps>(
  function ArcButton(
    { className, loading = false, disabled, children, onClick, ...props },
    ref,
  ) {
    const reduced = useReducedMotion() ?? false;
    const buttonRef = useRef<HTMLButtonElement | null>(null);
    const contentRef = useRef<HTMLSpanElement>(null);
    const key = labelKey(children);
    const width = useMorphWidth(contentRef, key, reduced);
    const setRefs = useCallback(
      (node: HTMLButtonElement | null) => {
        buttonRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      },
      [ref],
    );
    const inert = disabled || loading;

    return (
      <motion.button
        ref={setRefs}
        type="button"
        className={[styles.button, className].filter(Boolean).join(" ")}
        disabled={disabled}
        aria-busy={loading || undefined}
        aria-disabled={loading || undefined}
        custom={buttonRef}
        variants={pressVariants}
        whileTap={reduced || inert ? undefined : "pressed"}
        transition={motionTokens.spring.snappy}
        {...props}
        onClick={loading ? (event) => event.preventDefault() : onClick}
      >
        <AnimatePresence initial={false}>
          {loading ? (
            <motion.span
              key="loader"
              className={styles.loader}
              aria-hidden="true"
              initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduced ? fadeOut : { opacity: 0, scale: 0.8 }}
              transition={{ duration: motionTokens.duration.instant }}
            >
              <span className={styles.spinner} />
            </motion.span>
          ) : null}
        </AnimatePresence>
        <motion.span
          className={[
            styles.labelSlot,
            loading ? styles.loadingLabel : "",
          ].join(" ")}
          style={{ width }}
        >
          <span ref={contentRef} className={styles.labelContent}>
            <AnimatePresence mode="popLayout" initial={false}>
              <LabelPhase key={key} reduced={reduced}>
                {children}
              </LabelPhase>
            </AnimatePresence>
          </span>
        </motion.span>
      </motion.button>
    );
  },
);
