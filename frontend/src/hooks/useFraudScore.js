import { useEffect, useState } from "react";
import useFraudStore from "../store/fraudStore";

export default function useFraudScore() {
  const selected = useFraudStore((state) => state.selectedTransaction);
  const [score, setScore] = useState(0);

  useEffect(() => {
    setScore(selected?.fraudScore || 0);
  }, [selected]);

  return {
    score,
    riskLevel: score >= 70 ? "HIGH" : score >= 30 ? "MEDIUM" : "LOW",
    decision: selected?.decision || "approve",
  };
}
