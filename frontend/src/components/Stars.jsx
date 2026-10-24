import React from "react";
import { Star } from "lucide-react";

/**
 * Star rating display or interactive picker.
 * - value: number (0-5, allows halves for display)
 * - onChange: (v)=>void — when provided, becomes interactive
 * - size: pixel size
 */
export default function Stars({ value = 0, onChange, size = 14, className = "", showEmpty = true }) {
  const stars = [1, 2, 3, 4, 5];
  return (
    <div className={`inline-flex items-center gap-0.5 ${className}`} data-testid="stars">
      {stars.map((n) => {
        const full = value >= n;
        const half = !full && value >= n - 0.5;
        const active = full || half;
        const commonStyle = { color: active ? "#C49A45" : "#D6CFB8" };
        if (onChange) {
          return (
            <button
              key={n} type="button"
              data-testid={`star-${n}`}
              onClick={() => onChange(n)}
              className="p-0.5 transition-transform hover:scale-110"
              aria-label={`${n} étoiles`}
            >
              <Star size={size} strokeWidth={1.4} style={commonStyle} fill={active ? "#C49A45" : "transparent"} />
            </button>
          );
        }
        if (!showEmpty && !active) return null;
        return (
          <Star key={n} size={size} strokeWidth={1.4} style={commonStyle}
                fill={active ? "#C49A45" : "transparent"} />
        );
      })}
    </div>
  );
}
