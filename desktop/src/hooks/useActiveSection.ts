import { useEffect, useState } from 'react';

/** Highlights whichever section is nearest the top of the viewport. */
export function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    const update = () => {
      // The section whose top edge is nearest above the threshold wins. Ties go to the earlier id.
      let current = '', best = -Infinity;
      for (const id of ids) {
        const top = document.getElementById(id)?.getBoundingClientRect().top;
        if (top !== undefined && top <= window.innerHeight * .35 && top > best) { best = top; current = id; }
      }
      setActive(current);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => { window.removeEventListener('scroll', update); window.removeEventListener('resize', update); };
  }, [ids]);
  return active;
}
