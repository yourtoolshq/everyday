import { useEffect, useState } from "react";

import type { DesktopUpdateState } from "~/lib/desktop-update.types";
import { getDesktopUpdatesBridge } from "~/lib/desktop-update.logic";

export function useDesktopUpdate() {
  const bridge = getDesktopUpdatesBridge();
  const [state, setState] = useState<DesktopUpdateState | null>(null);

  useEffect(() => {
    if (!bridge) return;

    let active = true;
    void bridge.getState().then((next) => {
      if (active) setState(next);
    });

    const unsubscribe = bridge.subscribe((next) => {
      setState(next);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [bridge]);

  return { bridge, state };
}
