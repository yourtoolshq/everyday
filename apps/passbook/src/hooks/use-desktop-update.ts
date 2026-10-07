import { useEffect, useState } from "react";

import { getDesktopUpdatesBridge } from "~/lib/desktop-update.logic";
import type { DesktopUpdateState } from "~/lib/desktop-update.types";

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
