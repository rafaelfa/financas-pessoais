import { useEffect, useState } from 'react';

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const check = () => window.innerWidth < 768;
    setIsMobile(check());
    window.addEventListener('resize', () => setIsMobile(check()));
    return () => window.removeEventListener('resize', () => setIsMobile(check()));
  }, []);

  return isMobile;
}
