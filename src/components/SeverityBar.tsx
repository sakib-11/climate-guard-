import { useEffect, useState } from "react";

interface SeverityBarProps {
  level: number; // 0-10
}

export const SeverityBar = ({ level }: SeverityBarProps) => {
  const [animatedLevel, setAnimatedLevel] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedLevel(level);
    }, 400);
    return () => clearTimeout(timer);
  }, [level]);

  const getColor = (value: number) => {
    if (value < 4) return "var(--gradient-risk-low)";
    if (value < 7) return "var(--gradient-risk-medium)";
    return "var(--gradient-risk-high)";
  };

  const percentage = (animatedLevel / 10) * 100;

  return (
    <div className="w-full">
      <div className="flex justify-between mb-2">
        <span className="text-sm font-medium text-foreground">Severity Scale</span>
        <span className="text-sm font-bold text-foreground">{animatedLevel}/10</span>
      </div>
      <div className="h-4 bg-muted rounded-full overflow-hidden relative">
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{
            width: `${percentage}%`,
            background: getColor(animatedLevel),
          }}
        />
      </div>
      <div className="flex justify-between mt-1 text-xs text-muted-foreground">
        <span>Minimal</span>
        <span>Severe</span>
      </div>
    </div>
  );
};
