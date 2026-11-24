// Collie (phone remote for agent sessions) in the tab bar: shown only while its bridge
// runs. Read through Collie's own CLI (`status --json`, `devices list`), nothing else.

import { div, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { exec, shared, setShared, appHome } from "herdr";
import { MONO, openMenu, dur } from "./lib.js";

export const COLLIE_POLL_MS = 20000;
const TIMEOUT = { timeout: 5000 };

// Herdr may start without the login shell's PATH, where ~/.local/bin lives. The binary
// that answered is kept, so the menu runs the same one.
let bin = null;
async function collie(args) {
  const home = appHome().replace(/[\\/]\.config[\\/]herdr-app[\\/]?$/, "");
  for (const candidate of bin ? [bin] : ["collie", `${home}/.local/bin/collie`]) {
    const r = await exec(candidate, args, TIMEOUT).catch(() => null);
    if (r && r.code === 0) { bin = candidate; return r.stdout; }
  }
  bin = null;
  return null;
}

// "Phone  created <iso>  last seen <iso>  no expiry" per paired device.
export function lastSeen(text) {
  let best = 0;
  for (const m of String(text ?? "").matchAll(/last seen (\S+)/g)) {
    const at = Date.parse(m[1]);
    if (at > best) best = at;
  }
  return best || null;
}

let polling = false;
export async function pollCollie() {
  if (polling) return;
  polling = true;
  try {
    const raw = await collie(["status", "--json"]);
    let s = null;
    try { s = raw ? JSON.parse(raw) : null; } catch { s = null; }
    const next = s?.running
      ? {
        bin,
        version: String(s.version ?? "").split("+")[0],
        crew: s.crew ?? "",
        devices: s.pairedDevices ?? 0,
        sessions: s.census?.sessions?.total ?? 0,
        busy: s.census?.sessions?.byState?.working ?? 0,
        waiting: s.census?.sessions?.byState?.blocked ?? 0,
        seen: lastSeen(await collie(["devices", "list"])),
      }
      : null;
    if (JSON.stringify(next) !== JSON.stringify(shared("halo.collie") ?? null)) setShared("halo.collie", next);
  } finally {
    polling = false;
  }
}

export function collieChip(t, stop) {
  const c = shared("halo.collie");
  if (!c) return null;
  const ago = c.seen ? Date.now() - c.seen : null;
  // The phone counts as "with you" for a few minutes after its last request.
  const live = ago != null && ago < 5 * 60 * 1000;
  return h_flex().id("collie-chip").h(26).px(8).gap(6).items_center().rounded(6).cursor_pointer()
    .border(1).border_color(live ? `${t.ansi5}55` : t.border)
    .when(live, (el) => el.bg(`${t.ansi5}14`))
    .hover((s) => s.bg(t.hover))
    .tooltip("Collie: status, pair a device, restart")
    .on_mouse_down("left", stop)
    .on_click(() => openMenu("collie", c))
    .child(svg("mods/halo/icons/phone.svg").size(13).text_color(live ? t.ansi5 : t.dim))
    .child(div().font_family(MONO).text_size(10.5).text_color(live ? t.foreground : t.muted)
      .child(ago == null ? "collie" : live ? "phone live" : `phone ${dur(ago)}`))
    .when(c.waiting > 0, (el) => el.child(div().size(6).rounded(3).bg(t.blocked)));
}
