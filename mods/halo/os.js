// Platform-specific programs, macOS first, Windows second. Mods can't import across
// folders, so mods/halo-menu/os.js is a copy of this file: keep the two in sync.

import { exec, window } from "herdr";

export const isWindows = () => window()?.platform === "windows";

// PowerShell single-quoted literal: only quotes need doubling (curly ones count too).
const psQuote = (text) => `'${String(text).replace(/['‘’‚‛]/g, "$&$&")}'`;
const ps = (script, timeout = 8000) => exec("powershell", ["-NoProfile", "-NonInteractive", "-Command", script], { timeout });

export const openUrl = (url) => (isWindows()
  ? exec("rundll32", ["url.dll,FileProtocolHandler", url])
  : exec("open", [url])).catch(() => null);

export const copy = (text) => (isWindows()
  ? ps(`Set-Clipboard -Value ${psQuote(text)}`)
  : exec("osascript", ["-e", `set the clipboard to ${JSON.stringify(text)}`])).catch(() => null);

// How a listener is stopped, for labels.
export const stopHint = () => (isWindows() ? "taskkill /F" : "SIGTERM");

// Listening TCP sockets and the process tree, as text in `lsof -Fpcn` and `ps -Ao pid=,ppid=`
// shapes so one parser serves both platforms. null when either can't be read.
export async function listenerSnapshot() {
  if (isWindows()) {
    const r = await ps([
      "$ErrorActionPreference = 'SilentlyContinue'; $names = @{}",
      "Get-CimInstance Win32_Process | ForEach-Object { $names[[int]$_.ProcessId] = $_.Name -replace '\\.exe$', ''; \"$($_.ProcessId) $($_.ParentProcessId)\" }",
      "'---'",
      "Get-NetTCPConnection -State Listen | ForEach-Object { \"p$($_.OwningProcess)\"; \"c$($names[[int]$_.OwningProcess])\"; \"n$($_.LocalAddress):$($_.LocalPort)\" }",
    ].join("; "), 10000).catch(() => null);
    if (r?.code !== 0) return null;
    const [parents, listeners] = r.stdout.replace(/\r/g, "").split("\n---\n");
    return listeners == null ? null : { listeners, parents };
  }
  const [lsof, psOut] = await Promise.all([
    exec("lsof", ["-nP", "-iTCP", "-sTCP:LISTEN", "-Fpcn"], { timeout: 5000 }).catch(() => null),
    exec("ps", ["-Ao", "pid=,ppid="], { timeout: 5000 }).catch(() => null),
  ]);
  return lsof && psOut ? { listeners: lsof.stdout, parents: psOut.stdout } : null;
}

async function processName(pid) {
  const r = await (isWindows()
    ? ps(`(Get-Process -Id ${Number(pid)}).ProcessName`)
    : exec("ps", ["-p", String(pid), "-o", "comm="])).catch(() => null);
  return (r?.stdout.trim().split("/").pop() ?? "").toLowerCase();
}

// The pid comes from a snapshot up to a poll old: kill only if it is still the same program.
// lsof truncates names to 9 chars and case can differ from ps (python3.1 vs Python3.14).
export async function stopListener(l) {
  const comm = await processName(l.pid);
  const cmd = String(l.cmd ?? "").toLowerCase();
  if (!comm || !cmd || !(comm.startsWith(cmd) || cmd.startsWith(comm))) return;
  // Console programs ignore taskkill without /F (it only asks windows to close).
  await (isWindows() ? exec("taskkill", ["/PID", String(l.pid), "/F"]) : exec("kill", [String(l.pid)])).catch(() => null);
}
