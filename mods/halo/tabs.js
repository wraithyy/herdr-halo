// Top bar: the shown space's tabs (agent tabs can be hidden; they stay in the tree),
// dock toggles. Keeps the agent dock in step with agent focus and the dev dock with its toggle.

import { div, svg, image } from "gpui-kit";
import { h_flex } from "gpui-base";
import { spaces, panes, agents, run, shared, layout, openOverlay, window, settings } from "herdr";
import { MONO, HUE, clean, prefs, setPrefs } from "./lib.js";
import { collieChip } from "./collie.js";
import { visibleGroups } from "./dock.js";
import { dot } from "./tree.js";
import { lightsPadding } from "./parse.js";

const stop = (_e, cx) => cx.stop_propagation();

function lead(tabId, all) {
  const mine = all.filter((p) => p.tab === tabId);
  return mine.find((p) => p.focused) ?? mine[0];
}

function icon(t, program, active) {
  if (!program?.icon) return svg("mods/workspace-chrome/terminal.svg").size(13).text_color(active ? t.foreground : t.dim);
  return program.tint ? svg(program.icon).size(13).text_color(active ? t.foreground : t.muted) : image(program.icon).w(13).h(13);
}

function pill(t, tab, all, agentTab, spaceId) {
  const p = lead(tab.id, all);
  const name = agentTab ? clean(p?.title) || "agent" : tab.named ? tab.name : p?.program?.name ?? `term ${tab.index}`;
  return h_flex().id(`tab-${tab.id}`).h(26).px(10).gap(7).items_center().rounded(6).cursor_pointer().max_w(220)
    .border(1).border_color(tab.active ? t.input : "#00000000")
    .when(tab.active, (el) => el.bg(t.selected))
    .hover((s) => s.bg(t.hover))
    .on_mouse_down("left", stop)
    .on_click(() => run("tab.select", { id: tab.id }))
    // Herdr's own tab menu (rename, new tab, close), as the shipped tab bar opens it.
    .on_mouse_down("right", (_e, cx) => { cx.stop_propagation(); openOverlay({ mod: "menu", kind: "popup", width: 200, height: 100, props: { tab: "tab", target: { id: tab.id, space: spaceId } } }); })
    .child(agentTab ? dot(t, agents().find((a) => a.tab === tab.id)?.status ?? "idle", 6) : icon(t, p?.program, tab.active))
    .child(div().min_w(0).truncate().text_size(12).text_color(tab.active ? t.foreground : t.muted).child(name));
}

// glyph: a workspace-chrome icon name, or a full "mods/…svg" path.
function button(t, id, glyph, tip, onClick, on = false) {
  return div().id(id).size(26).rounded(6).flex().items_center().justify_center().cursor_pointer()
    .text_color(on ? t.foreground : t.dim).when(on, (el) => el.bg(t.hover))
    .hover((s) => s.bg(t.hover).text_color(t.foreground)).tooltip(tip)
    .on_mouse_down("left", stop).on_click(onClick)
    .child(svg(glyph.startsWith("mods/") ? glyph : `mods/workspace-chrome/${glyph}.svg`).size(14));
}

function findNode(node, id) {
  if (!node || typeof node !== "object") return null;
  if (node.id === id) return node;
  for (const child of node.children ?? []) {
    const hit = findNode(child, id);
    if (hit) return hit;
  }
  return null;
}

// The side column holds Files and Changes in one stack: a click on the shown one
// closes it, on the other one switches to it.
const sideToggle = (child, on) => () => {
  if (on) return run("layout.hide", { id: "side" });
  run("layout.select", { stack: "side-body", child });
  run("layout.show", { id: "side" });
};

// One segmented control for every panel, each item tinted with its domain hue when on.
function segment(t, items) {
  return h_flex().id("panels").h(28).p(2).gap(2).items_center().rounded(7).border(1).border_color(t.border)
    .children(items.map(([id, text, hue, on, tip, onClick]) => h_flex().id(`seg-${id}`).h(22).px(9).gap(6).items_center()
      .rounded(5).cursor_pointer().tooltip(tip)
      .when(on, (el) => el.bg(`${hue}1f`))
      .hover((s) => s.bg(on ? `${hue}2e` : t.hover))
      .on_mouse_down("left", stop).on_click(onClick)
      .child(div().size(5).rounded(3).bg(on ? hue : t.border))
      .child(div().text_size(11.5).text_color(on ? t.foreground : t.dim).child(text))));
}
const sep = (t) => div().w(1).h(14).bg(t.border).mx(2);

// Compared against the live layout, not a remembered state: a layout reload resets
// nodes to their JSON "hidden" while this mod keeps running.
function syncDock(root, id, want) {
  const node = findNode(root, id);
  if (node && Boolean(node.hidden) === want) run(want ? "layout.show" : "layout.hide", { id });
}

// Both docks share one "docks" row so the boundary between them trades width
// between the two; the row's own width follows how many are open.
const DOCK_PX = { dock: 700, devdock: 380 };
function syncDocks(view, wants) {
  const root = shared("layout") === "halo" ? layout() : null;
  if (!root) return;
  const open = Object.keys(wants).filter((id) => wants[id]);
  for (const id of Object.keys(wants)) syncDock(root, id, wants[id]);
  syncDock(root, "docks", open.length > 0);
  // Resize only when the set changes, so a width the user dragged survives.
  const key = open.join(",");
  if (key === view.docksKey || open.length === 0) return;
  view.docksKey = key;
  run("layout.resize", { id: "docks", px: open.reduce((sum, id) => sum + DOCK_PX[id], 0) + 8 * (open.length - 1) });
}

export function renderTabs(view, t) {
  const p = prefs();
  syncDocks(view, { dock: Boolean(p.panel && visibleGroups(t, view, "agent").length > 0), devdock: Boolean(p.devdock) });

  const space = spaces().find((s) => s.active);
  const all = panes();
  const isAgent = (tab) => all.some((x) => x.tab === tab.id && x.program?.agent);
  const tabs = (space?.tabs ?? []).filter((tab) => !tab.settled && (p.agents || !isAgent(tab) || tab.active));
  const root = shared("layout") === "halo" ? layout() : null;
  const sidebar = findNode(root, "sidebar");
  const sidebarHidden = Boolean(sidebar?.hidden);
  const padLeft = lightsPadding({ w: window(), root, sidebar, zoom: settings()?.zoom });
  const sideOn = Boolean(root) && !findNode(root, "side")?.hidden;
  const sideChild = findNode(root, "side-body")?.active;

  const waiting = agents().filter((a) => a.status === "blocked").length;
  return h_flex().size_full().px(10).pl(padLeft).gap(6).items_center()
    .when(waiting > 0, (el) => el.child(div().id("waiting-chip").h(22).px(8).rounded(5).flex().items_center().cursor_pointer()
      .bg(`${t.blocked}26`).border(1).border_color(t.blocked).font_family(MONO).text_size(10).text_color(t.blocked)
      .tooltip("Reply to waiting agents (cmd-shift-j)")
      .on_mouse_down("left", stop).on_click(() => run("mod.open", { name: "halo-reply" }))
      .child(`${waiting} waiting`)))
    .child(div().text_size(12).font_semibold().text_color(t.foreground).flex_none().child(space?.name ?? "—"))
    .child(div().w(1).h(14).bg(t.border).mx(4))
    .child(h_flex().id("halo-tabs").flex_1().min_w(0).gap(4).overflow_x_scroll()
      .children(tabs.map((tab) => pill(t, tab, all, isAgent(tab), space?.id))))
    .child(button(t, "new-term", "plus", "New terminal", () => run("tab.new", {})))
    .child(button(t, "new-agent", "square-pen", "New Claude", () => run("tab.new", { argv: ["claude"], name: "claude", focus: true })))
    .child(button(t, "new-task", "git-branch", "New task: worktree + Claude (cmd-shift-t)", () => run("mod.open", { name: "halo-task" })))
    .child(sep(t))
    .child(segment(t, [
      ["agent", "Agent", t[HUE.agent], p.panel, "Agent dock: context, activity, cache (follows the focused agent)", () => setPrefs({ panel: !p.panel })],
      ["dev", "Dev", t[HUE.dev], p.devdock, "Dev dock: git, MRs, dev servers, ports", () => setPrefs({ devdock: !p.devdock })],
      ["files", "Files", t.ansi6, sideOn && sideChild === "files", "File browser", sideToggle("files", sideOn && sideChild === "files")],
      ["changes", "Diff", t[HUE.git], sideOn && sideChild === "changes", "Changes in this repo", sideToggle("changes", sideOn && sideChild === "changes")],
    ]))
    .when(Boolean(collieChip(t, stop)), (el) => el.child(collieChip(t, stop)))
    .child(sep(t))
    .child(button(t, "agents-toggle", "layers", p.agents ? "Hide agent tabs" : "Show agent tabs",
      () => setPrefs({ agents: !p.agents }), p.agents))
    .child(button(t, "sidebar-toggle", "panel-left", "Toggle sidebar", () => run("layout.toggle", { id: "sidebar" }), !sidebarHidden));
}
