import { useEffect, useState } from "react";

export function ComparisonLoading({ text }: { text: string }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const start = performance.now();
    setSeconds(0);
    const timer = window.setInterval(() => setSeconds(Math.floor((performance.now() - start) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [text]);
  return <div className="comparison-load-progress" aria-busy="true">
    <strong role="status">{text}</strong>
    <progress aria-label={text} />
    <small>{seconds}s elapsed{seconds >= 10 ? " — Still working. Large files or network storage can take longer." : ""}</small>
  </div>;
}
