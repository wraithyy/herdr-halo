// Halo layout views. One mod, several roles (props.role) so the views share helpers:
// brand, tree, tabs, dock (agent), devdock (git, servers, ports).

import { View } from "gpui-kit";
import { theme, nextCommand, props, checking, readTextFile, appHome, shared, setShared } from "herdr";
import { prefs, setPrefs } from "./lib.js";
import { renderTree, renderBrand } from "./tree.js";
import { renderTabs } from "./tabs.js";
import { renderDock } from "./dock.js";
import { handle as nav } from "./nav.js";
import { pollServers, POLL_MS } from "./servers.js";
import { pollGit, GIT_POLL_MS } from "./git.js";
import { pollCollie, COLLIE_POLL_MS } from "./collie.js";

// The accent from halo's picker (a hover preview first, then the kept one) over the
// layout's. Mods can't share imports across folders, so each halo mod has this copy.
const withAccent = (t) => {
  const a = shared("halo.accentPreview") || shared("halo.prefs")?.accent;
  return /^#[0-9a-f]{6}$/i.test(a ?? "") ? { ...t, accent: a, selected: `${a}1c` } : t;
};

const COMMANDS = {
  "toggle-panel": () => setPrefs({ panel: !prefs().panel }),
  "toggle-agents": () => setPrefs({ agents: !prefs().agents }),
};

export default class Halo extends View {
  init(_p, cx) {
    this.role = props()?.role ?? "tree";
    // Countdowns are shown in minutes; this is data refresh, not animation.
    if (["tree", "dock", "devdock"].includes(this.role)) cx.timer.every(30000, (cx) => cx.notify());
    // The waypoint button in the tree shows only when the (separate) waypoint mod is installed.
    if (this.role === "tree" && !checking()) {
      cx.spawn(async () => {
        // Optional companion mods: their buttons show only when they are installed.
        for (const [mod, key] of [["waypoint", "halo.hasWaypoint"], ["openr", "halo.hasOpenr"]]) {
          const has = Boolean(await readTextFile(`${appHome()}/mods/${mod}/mod.json`).catch(() => null));
          if (shared(key) !== has) setShared(key, has);
        }
      });
    }
    // Only the tab bar takes key commands and polls, so each runs once, not once per copy.
    if (this.role === "tabs" && !checking()) {
      cx.spawn(async () => pollServers());
      cx.timer.every(POLL_MS, (cx) => cx.spawn(async () => pollServers()));
      cx.spawn(async () => pollGit().catch(() => null));
      cx.timer.every(GIT_POLL_MS, (cx) => cx.spawn(async () => pollGit().catch(() => null)));
      cx.spawn(async () => pollCollie().catch(() => null));
      cx.timer.every(COLLIE_POLL_MS, (cx) => cx.spawn(async () => pollCollie().catch(() => null)));
    }
    if (this.role === "tabs") {
      cx.spawn(async (cx) => {
        for (;;) {
          // A failing command must not end the loop, or every later key is lost.
          try {
            const c = await nextCommand();
            await (COMMANDS[c] ?? (() => nav(c)))(this);
          } catch {
            // ignored: the next key still works
          }
          cx.notify();
        }
      });
    }
  }

  render(cx) {
    const t = withAccent(theme());
    if (this.role === "brand") return renderBrand(t);
    if (this.role === "tabs") return renderTabs(this, t);
    if (this.role === "dock") return renderDock(this, t, cx, "agent");
    if (this.role === "devdock") return renderDock(this, t, cx, "dev");
    return renderTree(t);
  }
}
