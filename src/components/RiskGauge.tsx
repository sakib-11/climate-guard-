import { useEffect, useState } from "react";

interface RiskGaugeProps {
  score: number; // 0-100
}

export const RiskGauge = ({ score }: RiskGaugeProps) => {
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedScore(score);
    }, 300);
    return () => clearTimeout(timer);
  }, [score]);

  const getColor = (value: number) => {
    if (value < 30) return "hsl(var(--success))";
    if (value < 70) return "hsl(var(--warning))";
    return "hsl(var(--destructive))";
  };

  const getRiskLevel = (value: number) => {
    if (value < 30) return "Low Risk";
    if (value < 70) return "Moderate Risk";
    return "High Risk";
  };

  const circumference = 2 * Math.PI * 70;
  const strokeDashoffset = circumference - (animatedScore / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-48 h-48">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 160 160">
          {/* Background circle */}
          <circle
            cx="80"
            cy="80"
            r="70"
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth="12"
          />
          {/* Progress circle */}
          <circle
            cx="80"
            cy="80"
            r="70"
            fill="none"
            stroke={getColor(animatedScore)}
            strokeWidth="12"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-5xl font-bold" style={{ color: getColor(animatedScore) }}>
            {animatedScore}
          </span>
          <span className="text-sm text-muted-foreground">out of 100</span>
        </div>
      </div>
      <p className="mt-4 text-xl font-semibold" style={{ color: getColor(animatedScore) }}>
        {getRiskLevel(animatedScore)}
      </p>
    </div>
  );
};
