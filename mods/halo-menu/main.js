// Right-click menus for halo (popup): props { kind: "agent" | "port" | "mr" | "collie", target }.
// Items run Herdr commands or a small exec; keyboard: up/down, enter, esc.

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import { run, exec, hc, theme, props, closeOverlay, agents, panes, shared, setShared } from "herdr";
import { copy, openUrl, stopListener, stopHint, isWindows } from "./os.js";

// The accent from halo's picker (a hover preview first, then the kept one) over the
// layout's. Mods can't share imports across folders, so each halo mod has this copy.
const withAccent = (t) => {
  const a = shared("halo.accentPreview") || shared("halo.prefs")?.accent;
  return /^#[0-9a-f]{6}$/i.test(a ?? "") ? { ...t, accent: a, selected: `${a}1c` } : t;
};

const ICON = (name) => (name.startsWith("mods/") ? name : `mods/workspace-chrome/${name}.svg`);

function agentItems(tg) {
  const a = agents().find((x) => x.address === tg.terminal);
  if (!a) return [];
  const inTab = panes().some((p) => p.pane === a.pane);
  return [
    ["Show", "terminal", () => run("agent.focus", { terminal: a.address })],
    ["Peek", "search", () => run("terminal.peek", { terminal: a.address })],
    // openr reads the focused terminal, so focus the agent first.
    ...(shared("halo.hasOpenr") ? [["Open file or link…", "mods/halo/icons/openr.svg", () => { run("agent.focus", { terminal: a.address }); run("mod.open", { name: "openr" }); }]] : []),
    ...(a.status === "blocked" ? [["Reply…", "mods/halo/icons/ask.svg", () => run("mod.open", { name: "halo-reply" })]] : []),
    [a.pinned ? "Unpin" : "Pin to top", a.pinned ? "pin-off" : "pin", () => run("terminal.pin", { terminal: a.address, pinned: !a.pinned })],
    ...(inTab ? [["Rename", "square-pen", () => run("pane.rename", { pane: a.pane })]] : []),
    ...(a.status === "working" ? [["Interrupt (esc)", "square", () => hc(["interrupt", a.address]).catch(() => null)]] : []),
    ["Kill terminal", "x", () => run("terminal.kill", { terminal: a.address }), "danger"],
  ];
}

function portItems(tg) {
  const url = `http://localhost:${tg.port}`;
  return [
    ["Open in browser", "mods/halo/icons/next.svg", () => openUrl(url)],
    ["Copy URL", "file-text", () => copy(url)],
    ...(tg.terminal ? [["Show terminal", "terminal", () => run("pane.focus", { terminal: tg.terminal })]] : []),
    [`Stop ${tg.cmd ?? ""} (${stopHint()})`, "x", () => stopListener(tg), "danger"],
  ];
}

function mrItems(tg) {
  return [
    ["Open", "mods/halo/icons/next.svg", () => openUrl(tg.url)],
    ["Copy link", "file-text", () => copy(tg.url)],
    ["Review with Claude", "square-pen", () => run("tab.new", { argv: ["claude"], name: `review ${tg.id}`, task: `Review this merge request and report findings: ${tg.url}` })],
  ];
}

// Collie's status lines come first as "info" rows (not pickable), then its actions.
function collieItems(tg) {
  const sessions = `${tg.sessions} session${tg.sessions === 1 ? "" : "s"}${tg.busy ? `, ${tg.busy} working` : ""}${tg.waiting ? `, ${tg.waiting} waiting` : ""}`;
  return [
    [`Collie ${tg.version}${tg.crew ? ` · ${tg.crew}` : ""}`, "mods/halo/icons/phone.svg", null, "info"],
    [`${tg.devices} paired · ${sessions}`, "layers", null, "info"],
    // The pairing code and QR must stay on screen after `collie pair` exits.
    ["Pair a new device", "plus", () => run("pane.split", { direction: "down", argv: isWindows()
      ? ["powershell", "-NoLogo", "-NoExit", "-Command", `& '${(tg.bin ?? "collie").replace(/'/g, "''")}' pair`]
      : ["sh", "-c", '"$0" pair; printf "\\nPress enter to close"; read _', tg.bin ?? "collie"] })],
    ["Restart bridge", "mods/halo/icons/restart.svg", () => exec(tg.bin ?? "collie", ["restart"]).catch(() => null)],
  ];
}

function projectItems(tg) {
  const hide = () => {
    const p = shared("halo.prefs") ?? {};
    setShared("halo.prefs", { ...p, hiddenProjects: [...new Set([...(p.hiddenProjects ?? []), tg.key])] });
  };
  return [["Hide this project", "x", hide]];
}

export const ITEMS = { agent: agentItems, port: portItems, mr: mrItems, collie: collieItems, project: projectItems };

// Accent picker: hovering a swatch previews it everywhere halo draws (halo.accentPreview),
// a click or a valid hex + enter keeps it (halo.prefs.accent), esc or closing drops the preview.
export const SWATCHES = ["#00e8c6", "#89dceb", "#74c7ec", "#89b4fa", "#b4befe", "#cba6f7", "#f5c2e7", "#f38ba8", "#fab387", "#f9e2af", "#a6e3a1", "#cdd6f4"];
const HEX = /^#[0-9a-f]{6}$/i;
const preview = (hex) => setShared("halo.accentPreview", hex);
function keepAccent(hex) {
  setShared("halo.prefs", { ...(shared("halo.prefs") ?? {}), accent: hex });
  preview(null);
}

export default class HaloMenu extends View {
  init(_props, cx) {
    this.at = 0;
    if (props()?.kind === "accent") {
      this.hex = InputState.new({ placeholder: "#00e8c6" });
      this.hex.on("submit", () => {
        let v = this.hex.value().trim();
        if (!v.startsWith("#")) v = `#${v}`;
        if (HEX.test(v)) { keepAccent(v.toLowerCase()); closeOverlay(props().overlay); }
      });
      cx.timer.after(50, () => this.hex.focus());
    }
    this.handle = cx.focus_handle();
    this.handle.focus();
  }

  items() {
    const p = props() ?? {};
    return (ITEMS[p.kind] ?? (() => []))(p.target ?? {});
  }

  pick(item) {
    if (!item?.[2]) return;
    closeOverlay(props().overlay);
    item[2]();
  }

  close() {
    if (props()?.kind === "accent") preview(null);
  }

  renderAccent(t) {
    const current = (shared("halo.prefs") ?? {}).accent ?? null;
    const swatch = (hex) => div().id(`sw-${hex}`).size(26).rounded(13).cursor_pointer().bg(hex)
      .border(2).border_color(hex === (current ?? SWATCHES[0]) ? t.foreground : "#00000000")
      .on_hover((on) => preview(on ? hex : null))
      .on_click(() => { keepAccent(hex); closeOverlay(props().overlay); });
    return v_flex().id("halo-menu").track_focus(this.handle).w_full().p(10).gap(10).bg(t.popover)
      .on_key_down((e) => { if (e.key === "escape") { preview(null); closeOverlay(props().overlay); } })
      .child(h_flex().items_center()
        .child(div().flex_1().text_size(12.5).text_color(t.foreground).child("Accent color"))
        .when(Boolean(current), (el) => el.child(div().id("accent-reset").text_size(11).text_color(t.dim).cursor_pointer()
          .hover((s) => s.text_color(t.foreground)).tooltip("Back to the layout's accent")
          .on_click(() => { setShared("halo.prefs", { ...(shared("halo.prefs") ?? {}), accent: null }); preview(null); closeOverlay(props().overlay); })
          .child("reset"))))
      .child(h_flex().flex_wrap().gap(8).children(SWATCHES.map(swatch)))
      .child(h_flex().h(28).px(8).gap(6).items_center().rounded(6).border(1).border_color(t.border)
        .child(div().text_size(11).text_color(t.dim).child("hex"))
        .child(Input.new(this.hex).flex_1().h_full().text_size(12.5).text_color(t.foreground)));
  }

  render() {
    const t = withAccent(theme());
    if (props()?.kind === "accent") return this.renderAccent(t);
    const items = this.items();
    return v_flex().id("halo-menu").track_focus(this.handle).w_full().p(5).gap(1).bg(t.popover)
      .on_key_down((e, cx) => {
        if (e.key === "escape") return closeOverlay(props().overlay);
        if (e.key === "down") this.at = Math.min(this.at + 1, items.length - 1);
        else if (e.key === "up") this.at = Math.max(this.at - 1, 0);
        else if (e.key === "enter") return this.pick(items[this.at]);
        else return;
        cx.stop_propagation();
        cx.notify();
      })
      .children(items.map(([label, icon, , tone], i) => h_flex().id(`mi-${i}`).h(28).px(9).gap(9).items_center().rounded(5).cursor_pointer()
        .when(i === this.at, (el) => el.bg(t.selected))
        .hover((s) => s.bg(t.hover))
        .on_click(() => this.pick(items[i]))
        .child(svg(ICON(icon)).size(13).text_color(tone === "danger" ? t.blocked : tone === "info" ? t.dim : t.muted))
        .child(div().text_size(12.5).text_color(tone === "danger" ? t.blocked : tone === "info" ? t.muted : t.foreground).child(label))));
  }
}
