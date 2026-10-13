import { useEffect, useRef, useState } from 'react';

export function useCoastCountdown(
  status: string | undefined,
  heldSeconds: number,
  holdSeconds: number,
  onZero: () => void,
): number | null {
  const onZeroRef = useRef(onZero);
  onZeroRef.current = onZero;
  const fired = useRef(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (status !== 'recording' || heldSeconds < holdSeconds) {
      setCountdown(null);
      fired.current = false;
      return;
    }
    setCountdown((current) => current ?? 3);
  }, [status, heldSeconds, holdSeconds]);

  useEffect(() => {
    if (countdown === null) {
      return;
    }
    if (countdown === 0) {
      if (!fired.current) {
        fired.current = true;
        onZeroRef.current();
      }
      return;
    }
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  return countdown;
}
