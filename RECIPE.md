# Halo

A dark, sci-fi agent console for Herdr on macOS: a blurred translucent window, a tree of
spaces as cards with their Claude Code agents (goal, status, context, prompt-cache TTL),
an agent dock with the session's brief, context split, activity and cache, and a dev dock
with the branch's merge request, review queue and the space's dev servers. Each pane wears a
HUD strip that shows when its agent is processing, waiting on you, or idle.

![Halo](preview.png)

## What you see

Left to right, 8 px padding and gaps, translucent `chrome` (`#11111bc4`) panels with 1 px
teal-tinted borders (`#00e8c624`), radius 10-12, accent `#00e8c6`, built-in theme `ink`
with the Catppuccin Mocha palette inline in the layout's `colors` (no theme file), window
blur on, own title bar with macOS traffic lights at 18,16.

- **Sidebar** (280 px): brand row `HALO // AGENT CONSOLE` (46 px, drags the window). Below,
  `SPACES` with a waypoint button (only when the waypoint mod is installed) and `+`.
  - Each space is a card: folder icon and name in 13.5 px semibold, branch, and a status mark.
  - Under each space:
    - its agents: the where-am-i goal or task, a "waiting on you" or "doing" line, then
      `ACTIVE / WAITING / IDLE · CTX 23% · TTL 42m` in mono;
    - a git line (`!23 ● failed`);
    - a ports line (`:5173 vite`).
  - Footer: `USAGE` with 5h and 7d segmented bars, their reset countdowns and session cost.
- **Tab bar** (40 px, drags the window), from left:
  - an amber `! N WAITING` chip when agents wait;
  - the space name;
  - tab pills (agent tabs marked `◆ AGENT`, hideable);
  - buttons: new terminal, new Claude, new task, Files, Changes, agent tabs, sidebar,
    dev dock (`</>`), agent dock.
- **Panes**: each with a 26 px HUD header (see below), radius 10, teal focus border.
- **Agent dock** (400 px, right), the AGENT group with foldable sections in one or two
  columns (switch AUTO / 1 / 2):
  - BRIEF: goal, doing, waiting on you in amber, next step.
  - CONTEXT: big %, a segmented bar by category, and rows for messages, tools, MCP,
    skills, subagents, memory & hooks and system, each with its top entries.
  - ACTIVITY: newest first, prompts as dividers, tags READ / EDIT / RUN / FIND / AGENT.
  - CACHE: TTL countdown, hit %, read / written / uncached, last misses.
  - CHANGES: one line, `N files +a −d`.
- **Dev dock** (380 px):
  - GIT: this branch with its MR/PR, pipeline, OPEN and REVIEW WITH CLAUDE buttons; the
    review queue and your MRs, grouped by project.
  - DEV: this space's SERVERS, and OTHER APPS on dev ports with a warning.

## How it behaves

- **working**:
  - Tree: a satellite orbiting a faint ring (one SVG, `.spin(2400)`).
  - Pane header: `PROCESSING`, a slow scanner beam sweeping the strip (6 s, stepped alpha
    slices), a breathing core, the agent's current message and a mm:ss clock.
- **blocked**:
  - Tree: the satellite parked on a solid amber ring with a pulsing halo.
  - Pane header: a solid amber `AWAITING INPUT` label, an amber edge bar, a slower amber
    sweep and the question, which is clickable and opens the reply dialog.
- **done**: green `COMPLETE`.
- **idle**: `STANDBY` with cache TTL (amber under 5 minutes).
- **Clicks**:
  - A space switches to it. Its chevron folds the card.
  - An agent focuses it.
  - Right-click opens a menu:
    - agent: show, peek, reply, pin, rename, interrupt, kill;
    - port: open, copy URL, stop;
    - MR: open, copy, review with Claude;
    - tab: Herdr's tab menu;
    - space: Herdr's space menu.
- **Docks**: the agent dock shows by itself for a focused agent. The dev dock is toggled by
  hand and works without Claude.
- **Dialogs** (popups):
  - new space: waypoints, repos under the usual code folders, or a typed path;
  - new task (`cmd-shift-t`): a git worktree `task/<slug>` and a new space with Claude
    given the prompt;
  - quick reply (`cmd-shift-j`): every waiting agent, its screen tail and an input;
  - repo scripts (`cmd-shift-r`): package.json, Makefile and justfile.
- A toast fires when a branch pipeline finishes.

## Built from

- `layouts/halo.json`, a row:
  - `sidebar` column: `brand` and `tree` blocks (halo, roles `brand` and `tree`);
  - `work` column:
    - `tabs` block (role `tabs`);
    - `work-body` row: `main` (`{tab:"active"}` with pane header mod `halo-pane`, reveal
      always), `dock` (role `dock`, hidden), `devdock` (role `devdock`, hidden), `side`
      stack with the shipped `files` and `changes`.
- `mods/halo`: one mod, roles chosen by `props.role`.
  - `tree.js`, `tabs.js`, `dock.js`, `agent.js`, `changes.js`, `servers.js`, `git.js`.
  - `parse.js` holds the pure helpers and has bun tests.
  - The tab bar copy polls ports (`lsof`, `ps`, every 10 s) and git (`glab` / `gh`, every
    60 s) and publishes `shared("halo.servers")` and `shared("halo.git")`.
  - Docks show and hide with edge-triggered `layout.show` / `layout.hide`.
  - Prefs and folds live in `shared("halo.prefs")` and `shared("halo.fold")`.
- `mods/halo-reporter/report.py` (Python stdlib):
  - Claude Code hooks parse the transcript incrementally.
  - The statusline publishes its JSON.
  - Both land as terminal labels `halo.status`, `halo.context`, `halo.activity` and
    `halo.cache` via `hc label`.
- `mods/halo-pane` (pane header), `halo-menu` (right-click menus), `halo-reply`,
  `halo-task`, `halo-space`, `halo-scripts` (overlays with `mod.json` overlay specs, opened
  with `mod.open`).
- Herdr functions: `agents`, `terminals` (labels, report, records), `panes`, `spaces`,
  `focused`, `shared` / `setShared`, `openOverlay`, `run`, `exec`, `hc`, `notify`,
  `setAgentOrder`.
- Programs run: `git`, `lsof`, `ps`, `glab`, `gh`, `hc`, `open`, `osascript` (clipboard), `kill`.
  On Windows (`window().platform`), `mods/halo/os.js` swaps them for `powershell`
  (`Get-NetTCPConnection`, `Win32_Process`, `Set-Clipboard`), `rundll32 url.dll` and
  `taskkill /F`; `mods/halo-menu/os.js` is a copy (mods can't import across folders).
  The tab bar draws minimize / maximize / close where `window().buttons`.

## Watch out

- Network: GIT calls GitLab and GitHub only through the user's logged-in `glab` / `gh`.
  Nothing reads tokens.
- Files: the reporter reads only the local transcript and statusline JSON, and writes
  labels and `~/.cache/halo/`.
- `hc run --bg` called from a mod never resolves (the child keeps the pipe). Don't spawn
  long-lived programs from a mod with `exec`.
- `hc send` won't type into a blocked agent without `--force`.
- `bg()` takes flat colours only, so the beam is built from alpha-stepped slices.
- Children must be elements; filter out nulls.
- A space's `folder` is where its first terminal started (often `~`). The repo comes from
  its panes' live folders.
- `glab`'s default host may not be the logged-in one; it is read from `glab auth status`.
- `keys.json`: keep alt-arrows out of the `terminal` section. It outranks `layout:*`.
- A symlinked `themes/*.json` is not picked up, which is why the palette lives in the
  layout. Herdr also doesn't watch symlink targets: `touch -h` the layout and mod links after edits.
- The goal / doing / waiting / next summary needs the where-am-i Claude Code mod (optional).
  Without it BRIEF falls back to the session name and the agent's message (marked AUTO).

## Done when

- `herdr-app check` passes for every mod.
- `herdr-app do layout.switch '{"name":"halo"}'` shows the layout and `herdr-app status`
  reports no errors.
- After one Claude prompt in a Herdr tab:
  - `hc get <t> --json` lists the `halo.*` labels;
  - focusing it opens the agent dock with CONTEXT and ACTIVITY filled;
  - the pane header shows PROCESSING while it works and AWAITING INPUT while it asks.
- A dev server started in a tab shows up as a port under its space.
- `python3 -I mods/halo-reporter/test_report.py` and `bun test mods/` pass.
