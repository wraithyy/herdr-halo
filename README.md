# herdr-halo

A sci-fi agent console layout for the [Herdr](https://herdr.dev) desktop app (macOS; Windows,
see [Windows](#windows)):
spaces as cards with their Claude Code agents, an agent dock (brief, context split,
activity, prompt cache), a dev dock (merge requests, pipeline, review queue, dev servers),
HUD pane headers, right-click menus and quick dialogs. See [RECIPE.md](RECIPE.md) for the
full tour.

## Requirements

- macOS (Apple Silicon), the Herdr app (`herdr-app`) and herdr-core (`hc`) on `PATH`
- Claude Code, `python3` (stdlib only), `git`
- JetBrainsMono Nerd Font (`brew install --cask font-jetbrains-mono-nerd-font`); Geist ships with Herdr
- Optional:
  - `glab` and/or `gh`, logged in, for the GIT group;
  - `just`;
  - `bun` (only to run the tests);
  - [herdr-waypoint](https://github.com/wraithyy/herdr-waypoint) for saved folders.

## Install

1. Clone and link the layout and mods into Herdr's home (symlinks keep it updatable with
   `git pull`; copy instead if you prefer). The palette is inline in the layout, so there is
   no theme file:

   ```sh
   git clone https://github.com/wraithyy/herdr-halo ~/Development/herdr-halo
   H=~/Development/herdr-halo; D=~/.config/herdr-app
   ln -s $H/layouts/halo.json $D/layouts/halo.json
   for m in $H/mods/*; do ln -s "$m" "$D/mods/$(basename "$m")"; done
   ```

   Never overwrite an existing layout or mod with the same name: rename instead.
   Herdr watches `~/.config/herdr-app`, not the symlink targets: after editing a file in the
   clone, touch the link so Herdr reloads it (a pull counts too):

   ```sh
   touch -h ~/.config/herdr-app/layouts/halo.json ~/.config/herdr-app/mods/halo*
   ```

2. Keys: merge the `layout:halo` section of [keys.json](keys.json) into
   `~/.config/herdr-app/keys.json`.

   | Key | Action |
   |---|---|
   | `alt-h/j/k/l` | move between panes (forwarded into nvim splits) |
   | `alt-arrows` | resize panes |
   | `cmd-shift-t` | new task: worktree + Claude |
   | `cmd-shift-j` | reply to waiting agents |
   | `cmd-shift-r` | run a repo script |

   Keep alt-arrows out of your `terminal` section: it outranks `layout:*` sections.

3. Claude Code hooks: merge into `~/.claude/settings.json`. They are async and exit at
   once outside Herdr (no `HC_TERMINAL_ID`):

   ```json
   {
     "hooks": {
       "SessionStart":     [{ "hooks": [{ "type": "command", "async": true, "timeout": 10, "command": "[ -n \"$HC_TERMINAL_ID\" ] && python3 -I \"$HOME/.config/herdr-app/mods/halo-reporter/report.py\" hook || true" }] }],
       "UserPromptSubmit": [{ "hooks": [{ "type": "command", "async": true, "timeout": 10, "command": "[ -n \"$HC_TERMINAL_ID\" ] && python3 -I \"$HOME/.config/herdr-app/mods/halo-reporter/report.py\" hook || true" }] }],
       "PostToolUse":      [{ "hooks": [{ "type": "command", "async": true, "timeout": 10, "command": "[ -n \"$HC_TERMINAL_ID\" ] && python3 -I \"$HOME/.config/herdr-app/mods/halo-reporter/report.py\" hook || true" }] }],
       "Stop":             [{ "hooks": [{ "type": "command", "async": true, "timeout": 10, "command": "[ -n \"$HC_TERMINAL_ID\" ] && python3 -I \"$HOME/.config/herdr-app/mods/halo-reporter/report.py\" hook || true" }] }],
       "SubagentStop":     [{ "hooks": [{ "type": "command", "async": true, "timeout": 10, "command": "[ -n \"$HC_TERMINAL_ID\" ] && python3 -I \"$HOME/.config/herdr-app/mods/halo-reporter/report.py\" hook || true" }] }],
       "PostCompact":      [{ "hooks": [{ "type": "command", "async": true, "timeout": 10, "command": "[ -n \"$HC_TERMINAL_ID\" ] && python3 -I \"$HOME/.config/herdr-app/mods/halo-reporter/report.py\" hook || true" }] }]
     }
   }
   ```

4. Statusline: the cache TTL, exact context total and 5h/7d usage come from Claude Code's
   statusline JSON. Hand it to the reporter. With `ccstatusline` as the visible output:

   ```json
   "statusLine": {
     "type": "command",
     "padding": 0,
     "command": "t=$(mktemp \"${TMPDIR:-/tmp}/ccsl.XXXXXX\") && tee \"$t\" | ccstatusline; [ -n \"${HC_TERMINAL_ID:-}\" ] && cp \"$t\" \"$t.halo\" && (python3 -I \"$HOME/.config/herdr-app/mods/halo-reporter/report.py\" statusline \"$t.halo\" >/dev/null 2>&1 &); rm -f \"$t\""
   }
   ```

   With your own statusline script, add the same `cp` + background `report.py statusline` part.

5. Optional, the BRIEF summary (goal / doing / waiting on you / next): the `where-am-i`
   Claude Code mod from [wraithyy/dotfiles](https://github.com/wraithyy/dotfiles)
   (`dot_claude/mods/where-am-i`) publishes it as a `halo.where` label. Without it BRIEF
   falls back to the session name and the agent's current message (marked AUTO).

6. Switch: `herdr-app do layout.switch '{"name":"halo"}'` (or `ctrl-shift-l`).

## Verify

```sh
for m in halo halo-space halo-task halo-reply halo-scripts halo-pane halo-menu; do herdr-app check ~/.config/herdr-app/mods/$m; done
herdr-app status                                   # "errors": [] expected
python3 -I ~/Development/herdr-halo/mods/halo-reporter/test_report.py
cd ~/Development/herdr-halo && bun test mods/      # optional
```

Then start Claude in a Herdr tab and send one prompt. `hc get <terminal> --json` lists
`halo.status`, `halo.context`, `halo.activity` and `halo.cache` under `labels`, and the
agent dock opens when that agent has focus.

## Troubleshooting

- **Agent dock never appears**: it shows only for a focused agent, and only when the dock
  button (rightmost in the tab bar) is on. The dev dock has its own `</>` button.
- **No TTL or usage**: the statusline step is missing or prints nothing.
  Check with `hc get <t> --json | grep halo.status`.
- **BRIEF says AUTO**: where-am-i isn't installed or loaded in that session. Mods load at
  session start.
- **GIT empty or "offline"**: GIT uses your `glab` / `gh` logins. A self-hosted GitLab may
  need VPN. The repo is found from the live folders of the space's panes.
- **No ports under a space**: servers are matched by walking the process tree to a Herdr
  terminal's shell. Ports 49152 and up are ignored. OTHER APPS lists dev ports answered by
  apps not started from Herdr.
- **Escape hatch**: `ctrl-alt-shift-escape` resets to Herdr's default layout and keys.

## Windows

The mods pick the Windows programs themselves (`window().platform`): PowerShell
(`Get-NetTCPConnection`, `Win32_Process`) for ports, `rundll32 url.dll` to open links,
`Set-Clipboard`, `taskkill /F` to stop a server. The tab bar draws the window buttons. What
differs in the install:

- **Files**: copy instead of symlinking (symlinks need Developer Mode); repeat the copy after
  `git pull`. In PowerShell:

  ```powershell
  $H = "$HOME\Development\herdr-halo"; $D = "$HOME\.config\herdr-app"
  Copy-Item "$H\layouts\halo.json" "$D\layouts\"
  Get-ChildItem "$H\mods" -Directory | ForEach-Object { Copy-Item $_.FullName "$D\mods\" -Recurse -Force }
  ```

- **Keys**: merge [keys.windows.json](keys.windows.json) instead: `ctrl-shift-t/j/r`. In this
  layout `ctrl-shift-t` opens the new task dialog instead of Herdr's new tab (the `+` button
  still makes one).
- **Python**: `python3` is often only the Microsoft Store alias; use the launcher, `py -3`.
  Claude Code runs hooks and the statusline through Git Bash, so the hook and statusline
  commands above work as written with `python3 -I` replaced by `py -3 -I`. The reporter
  finds `hc.exe` in `%LOCALAPPDATA%\Programs\herdr-core` when it isn't on `PATH`.
- **Scripts** (`ctrl-shift-r`) run in a PowerShell that stays open after the script ends.
- **Ports** are read every 10 s through one PowerShell call, which takes about 2 s.
- **New space** also scans `~/source/repos` and takes typed drive paths (`C:\work\repo`).

## Privacy

The reporter reads only the local transcript and statusline JSON, and writes terminal labels
and `~/.cache/halo/`. Usage comes from Claude Code's own statusline data. Nothing reads
credentials. GIT talks to GitLab and GitHub only through the `glab` / `gh` CLIs you are
already logged in to.

## License

MIT
