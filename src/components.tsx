import { useEffect, useRef, useState } from "react";
import {
  animate,
  motion,
  useDragControls,
  useMotionValue,
  useReducedMotion,
} from "motion/react";
import { ArrowRight, ShieldCheck, X } from "lucide-react";

const spring = { type: "spring" as const, stiffness: 450, damping: 43 };

export function GamesSkeleton() {
  return (
    <div
      className="games-skeleton"
      role="status"
      aria-label="Loading NBA games"
      aria-busy="true"
    >
      <span className="skeleton" aria-hidden="true" />
      <span className="sr-only">Loading NBA games</span>
    </div>
  );
}

export function AnalysisSkeleton() {
  return (
    <div
      className="analysis-skeleton"
      role="status"
      aria-label="Loading box score"
      aria-busy="true"
    >
      <div className="skeleton-scoreboard" aria-hidden="true">
        <span className="skeleton skeleton-logo" />
        <span className="skeleton skeleton-score" />
        <span className="skeleton skeleton-logo" />
      </div>
      <div className="skeleton-answer skeleton" aria-hidden="true" />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
        <div className="skeleton-row" key={n} aria-hidden="true">
          <span className="skeleton" />
          <span className="skeleton" />
          <span className="skeleton" />
        </div>
      ))}
      <span className="sr-only">Loading the game and its point breakdown.</span>
    </div>
  );
}

export function Methodology({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const mobile = window.matchMedia("(max-width: 640px)").matches;
  const reduced = useReducedMotion();
  const controls = useDragControls();
  const y = useMotionValue(reduced ? 0 : mobile ? 40 : 12);
  const opacity = useMotionValue(0);
  const generation = useRef(0);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    ref.current?.showModal();
    const position = animate(y, 0, reduced ? { duration: 0 } : spring);
    const fade = animate(opacity, 1, { duration: 0.16 });
    return () => {
      position.stop();
      fade.stop();
    };
  }, [y, opacity, reduced]);

  async function requestClose(velocity = 0) {
    const id = ++generation.current;
    setClosing(true);
    await Promise.all([
      animate(
        y,
        reduced
          ? 0
          : mobile
            ? (ref.current?.getBoundingClientRect().height || 600) + 24
            : 12,
        reduced ? { duration: 0 } : { ...spring, velocity },
      ),
      animate(opacity, 0, { duration: reduced ? 0.1 : 0.18 }),
    ]);
    if (generation.current === id) ref.current?.close();
  }

  return (
    <dialog
      ref={ref}
      className={`method-dialog ${closing ? "closing" : ""}`}
      aria-labelledby="method-title"
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        void requestClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) void requestClose();
      }}
    >
      <motion.div
        className="dialog-surface"
        style={{ y, opacity }}
        drag={mobile && !reduced ? "y" : false}
        dragControls={controls}
        dragListener={false}
        dragConstraints={{ top: 0 }}
        dragElastic={{ top: 0.06, bottom: 0.3 }}
        dragMomentum={false}
        onDragEnd={(_event, info) => {
          const projected =
            info.offset.y + ((info.velocity.y / 1000) * 0.99) / (1 - 0.99);
          if (info.offset.y > 12 && projected > 140)
            void requestClose(info.velocity.y);
          else {
            setClosing(false);
            void animate(y, 0, { ...spring, velocity: info.velocity.y });
            void animate(opacity, 1, { duration: 0.1 });
          }
        }}
      >
        <div
          className="sheet-handle"
          aria-hidden="true"
          onPointerDown={(event) => {
            if (reduced) return;
            generation.current++;
            y.stop();
            opacity.stop();
            opacity.set(1);
            setClosing(false);
            controls.start(event);
          }}
        >
          <span />
        </div>
        <div className="dialog-heading">
          <button
            className="icon-button"
            title="Close explanation"
            aria-label="Close explanation"
            onClick={() => void requestClose()}
          >
            <X size={20} />
          </button>
        </div>
        <div className="dialog-scroll">
          <h2 id="method-title">Where the points went.</h2>
          <p>
            We turn differences in the box score into equivalent points. Costs
            hurt your team; offsets helped. Together, they add up to the score
            margin.
          </p>
          <div className="method-step">
            <span>1</span>
            <div>
              <h3>Start with the actual score</h3>
              <p>
                Field-goal points are 2 × field goals made + threes made. Add
                made free throws and you have the score.
              </p>
            </div>
          </div>
          <div className="method-step">
            <span>2</span>
            <div>
              <h3>Separate chances from accuracy</h3>
              <p>
                Shared averages split the scoring difference into shot volume,
                two- and three-point accuracy, shot mix, free-throw attempts and
                free-throw accuracy. Both teams are treated equally.
              </p>
            </div>
          </div>
          <div className="method-step">
            <span>3</span>
            <div>
              <h3>Account for extra opportunities</h3>
              <p>
                We allocate one shot opportunity to each extra offensive rebound
                or turnover, at average points per field-goal attempt. The
                remaining difference is possession balance. These are estimates,
                not individual possession measurements.
              </p>
            </div>
          </div>
          <div className="method-step">
            <span>4</span>
            <div>
              <h3>Count each point once</h3>
              <p>
                Defensive rebounds, assists, fouls and points off turnovers
                overlap with scoring already counted, so they aren’t added
                again. The eight factors sum to the margin; rounding can differ
                by 0.1 points.
              </p>
            </div>
          </div>
          <div className="method-note">
            <ShieldCheck size={20} />
            <p>
              What-if sliders remove part of a factor’s equivalent-point cost.
              They show the size of a gap, not a prediction of a replayed game.
            </p>
          </div>
          <p className="source-note">
            ESPN’s public NBA feed can be delayed. We wait for the score and
            shooting stats to agree before calculating a breakdown.
          </p>
          <button
            className="primary-button"
            onClick={() => void requestClose()}
          >
            Back to the game <ArrowRight size={16} />
          </button>
        </div>
      </motion.div>
    </dialog>
  );
}
