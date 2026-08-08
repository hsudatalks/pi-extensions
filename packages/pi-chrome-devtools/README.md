# 🌐 pi-chrome-devtools — Chrome DevTools Tools for Pi Agents

[![npm](https://img.shields.io/npm/v/@narumitw/pi-chrome-devtools)](https://www.npmjs.com/package/@narumitw/pi-chrome-devtools) [![Pi extension](https://img.shields.io/badge/Pi-extension-blue)](https://pi.dev) [![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)

`@narumitw/pi-chrome-devtools` is a native [Pi coding agent](https://pi.dev) extension that exposes Chrome DevTools Protocol (CDP) automation as Pi tools.

Use it to let the Pi agent inspect browser tabs, navigate pages, evaluate JavaScript, and capture screenshots while debugging web apps or validating UI behavior.

This package is inspired by [`chrome-devtools-mcp`](https://github.com/ChromeDevTools/chrome-devtools-mcp), but it is implemented as native Pi tools instead of an MCP server.

## ✨ Features

- Lists inspectable Chrome tabs and pages.
- Selects an active Chrome page for later tool calls.
- Navigates Chrome to a target URL, creating an inspectable page when none exists.
- Recovers from stale active page selections by falling back to an available page.
- Evaluates JavaScript in the selected page.
- Captures PNG screenshots, including optional full-page screenshots, and saves them to disk.
- Renders compact tool results that expand/collapse with Pi's default output toggle (`Ctrl+O`).
- Reuses an existing Chrome DevTools Protocol endpoint when one is already available.
- Lazily auto-launches a Chromium-family browser for missing local endpoints, with Chrome,
  Chromium, Brave, and Edge fallbacks.
- Loads one or more user-approved unpacked extensions into an isolated managed Chrome for Testing
  or Chromium browser.
- Uses a dynamic managed DevTools port by default to avoid port conflicts, while preserving
  explicit endpoint overrides.
- Retries briefly while Chrome is starting and reports actionable endpoint errors.
- Shows statusline activity only while Chrome DevTools tools are running.
- Provides a state-first `/chrome-devtools` menu for tool access, browser status, setup, and help.
- Stages menu-based tool changes for exact review before one confirmed apply.
- Uses `@narumitw/pi-tui-kit` for width-safe TUI menus and equivalent RPC dialogs.
- Persists the selected Chrome DevTools tools across Pi restarts.

## 📦 Install

```bash
pi install npm:@narumitw/pi-chrome-devtools
```

Try without installing permanently:

```bash
pi -e npm:@narumitw/pi-chrome-devtools
```

Try this package locally from the repository root:

```bash
pi -e ./packages/pi-chrome-devtools
```

## 🚀 Browser startup

Without unpacked extensions, the extension first tries the configured endpoint, defaulting to
`127.0.0.1:9222`. If that local endpoint is unavailable, it lazily launches an extension-owned
Chromium-family browser with an isolated temp profile and retries the CDP request. Existing endpoints
are reused and are never terminated by the extension.

When `PI_CHROME_DEVTOOLS_PORT` is not set, auto-launch uses Chrome's dynamic DevTools port mode
(`--remote-debugging-port=0`) and reads `DevToolsActivePort` from the temp profile. If you set a valid
`PI_CHROME_DEVTOOLS_PORT` (`1`-`65535`), the extension uses that explicit port. Empty or invalid values
fall back to the default attach-first behavior.

### Unpacked extensions

> [!WARNING]
> An unpacked extension executes privileged browser code. Load only code you trust. Project settings
> are honored only when Pi reports the project as trusted.

Configure the canonical user file at
`${PI_CODING_AGENT_DIR:-~/.pi/agent}/pi-chrome-devtools.json`:

```json
{
  "browser": {
    "executablePath": "/absolute/path/to/chrome-for-testing",
    "extensionPaths": [
      "/absolute/path/to/unpacked-extension-one",
      "/absolute/path/to/unpacked-extension-two"
    ]
  }
}
```

Every user-file path must be absolute. Each extension path must resolve to a directory containing a
valid `manifest.json` and cannot contain a comma because Chrome uses commas to separate multiple
startup paths. For extension-configured sessions, `executablePath` must identify Chrome for
Testing or Chromium. Branded Google Chrome is rejected because tested releases can silently ignore
unpacked-extension startup flags.

A trusted project can replace the user extension list in
`<workspace>/.pi/pi-chrome-devtools.json`. Relative paths resolve from the workspace (`ctx.cwd`):

```json
{
  "browser": {
    "extensionPaths": ["./extension"]
  }
}
```

Project `extensionPaths` replace, rather than append to, the user array. A project file cannot
override `browser.executablePath`; browser selection remains machine-owned user configuration.
Effective precedence is defaults, user settings, trusted project override, then existing explicit
runtime environment overrides. No new environment variable is required.

When `extensionPaths` is non-empty, the extension skips attach-first behavior and starts an isolated,
extension-owned managed browser with `--disable-extensions-except` and `--load-extension`. It fails
before spawning when the endpoint is remote, auto-launch is disabled, an explicit port is occupied,
the executable is missing, or the browser product is unsupported. It never adds extensions to,
modifies, restarts, or closes an external browser.

Settings are loaded on session start. After editing JSON, use `/reload` or replace the session; the
old managed browser is closed before the new configuration is applied. Missing files preserve the
existing no-extension behavior. Invalid JSON, invalid browser values, and missing manifests are left
unchanged and ignored with an actionable warning.

### Environment overrides and manual endpoints

`PI_CHROME_DEVTOOLS_BROWSER` remains the explicit runtime executable override. Without unpacked
extensions, browser discovery still checks platform-specific Chrome, Chromium, Brave, and Microsoft
Edge candidates. Disable auto-launch to keep the manual flow:

```bash
PI_CHROME_DEVTOOLS_AUTO_LAUNCH=0 pi -e ./packages/pi-chrome-devtools
```

Force an executable or endpoint if needed:

```bash
PI_CHROME_DEVTOOLS_BROWSER=/usr/bin/chromium pi -e ./packages/pi-chrome-devtools
PI_CHROME_DEVTOOLS_HOST=127.0.0.1 PI_CHROME_DEVTOOLS_PORT=9223 pi -e ./packages/pi-chrome-devtools
```

Manual launch remains available when no unpacked extensions are configured:

```bash
google-chrome --remote-debugging-port=9222 --user-data-dir=/tmp/pi-chrome-devtools
```

On session shutdown, the extension terminates only browser processes it started and best-effort
removes their temporary profiles. It never closes user-started browsers or remote endpoints.

## 🛠️ Pi tools

- `chrome_devtools_list_pages` — list inspectable Chrome tabs/pages.
- `chrome_devtools_select_page` — select the active page for later tool calls.
- `chrome_devtools_navigate` — navigate a page to a URL; if no page exists, create one first.
- `chrome_devtools_evaluate` — evaluate JavaScript in the selected page.
- `chrome_devtools_screenshot` — capture a PNG screenshot and save it as a PNG file.

### Screenshot files

`chrome_devtools_screenshot` always saves the captured PNG to disk. If `savePath` is omitted,
the extension writes a unique temp file such as:

```text
/tmp/pi-chrome-devtools-screenshot-<uuid>.png
```

Pass `savePath` to choose the output path:

```js
chrome_devtools_screenshot({
  fullPage: true,
  savePath: "artifacts/homepage.png",
});
```

Relative `savePath` values resolve from Pi's current working directory. A single leading `@`
is stripped to match Pi file-mention paths. Absolute paths are accepted only when they stay
inside the current working directory or the OS temp directory. Paths containing `..` segments,
NUL bytes, symlinked parent directories, directories as targets, final symbolic-link targets, or
other non-regular file targets are rejected. Existing regular files at the target path are
replaced. The tool result includes the resolved path, byte count, and an inline image block when
the active model/provider can consume images. If the model cannot inspect the inline image, ask it
to read the saved path, for example `read({ path: "artifacts/homepage.png" })`.

## 💬 Command

```text
/chrome-devtools
```

Opens a menu that shows the current browser-tool count, whether that selection is saved, the
configured endpoint, the observed managed-browser state, and any settings or launch warning before
you choose an action. The five actions stay on one level:

- **Choose browser tools…** — stage any combination of the five capabilities, then review the exact
  enabled/disabled result before selecting **Apply tool changes**.
- **Enable all browser tools…** or **Disable all browser tools…** — preview the context-appropriate
  bulk change before applying it.
- **Browser status** — inspect runtime, endpoint, launch mode, and the last launch attempt without
  probing the endpoint or starting Chrome.
- **Settings & setup** — inspect effective files, sources, trust, reload steps, and recovery guidance.
- **Help** — view command usage and return to the menu.

In the tool screen, **Select all** and **Select none** are unambiguous shortcuts; individual rows use
friendly task labels while retaining their raw `chrome_devtools_*` identity in the description.
Toggles remain a command-local draft. **Review changes** previews the exact effect, **Apply tool
changes** saves it, and Cancel, Escape, Ctrl+C, disposal, or session replacement discards an
unconfirmed draft without changing runtime tools or settings. A failed apply restores the previous
active-tool state, preserves the settings file, retains the draft for retry, and reports how to
recover.

Direct subcommands are also available:

```text
/chrome-devtools help
/chrome-devtools quickstart
/chrome-devtools status
/chrome-devtools tools
/chrome-devtools toggle
/chrome-devtools enable
/chrome-devtools disable
```

Compatibility aliases remain available: `toggle` and `select` mean `tools`, `on` means `enable`, and
`off` means `disable`.

- `help` shows command usage.
- `quickstart` shows the configured CDP endpoint, endpoint source, auto-launch mode, browser
  candidates, last launch attempt, and launch hints.
- `status` shows runtime tool state, persisted selection, settings file path, endpoint source,
  launch mode, last launch attempt, and active non-Chrome tool count.
- `tools` opens the same staged, width-safe selection and review flow used by the menu.
- `toggle` and `select` are compatibility aliases for `tools`.
- `enable` immediately enables and saves all `chrome_devtools_*` tools for future turns; `on` is a
  compatibility alias.
- `disable` immediately disables and saves all `chrome_devtools_*` tools for future turns; `off` is a
  compatibility alias. The slash command remains available.

The menu, `tools`, `help`, `quickstart`, and `status` require TUI or RPC mode so their result is
observable. TUI uses keyboard navigation and injected Pi keybindings; RPC receives equivalent
standard dialogs. In print and JSON modes, interactive and informational routes reject explicitly
instead of silently opening unavailable UI. The immediate `enable`/`disable` routes remain available
for deterministic non-interactive use.

The selected tool names are saved to:

```text
${PI_CODING_AGENT_DIR:-~/.pi/agent}/pi-chrome-devtools.json
```

When the file is missing or invalid, the extension preserves Pi's current active-tool policy
instead of enabling tools by itself. A valid saved selection is restored on Pi startup and
`/reload`. A missing file is created by the first confirmed menu apply or successful direct
selection change. Within one Pi process, selection saves run in invocation order, reread the latest
valid document, and preserve unknown fields. Malformed JSON or invalid recognized fields make menu
mutation unavailable and block direct saves without replacement; a failed save restores the prior
Chrome DevTools tool selection while preserving other extensions' current tools.

Compatibility: older versions used `pi-chrome-devtools-settings.json`. A legacy-only file remains
readable with a warning and is never modified automatically; rename it to
`pi-chrome-devtools.json`. The first subsequent settings save writes the canonical file. If both
files exist, `pi-chrome-devtools.json` wins and the legacy file is ignored. The legacy
filename is deprecated and will be removed in a future major release.

## 🧠 Use cases

- Debug front-end applications with an AI coding agent.
- Verify DOM state after code changes.
- Capture screenshots for visual inspection.
- Drive local browser workflows without a separate MCP server.
- Combine with Pi coding tools for end-to-end web app fixes.

## 🗂️ Package layout

```txt
packages/pi-chrome-devtools/
├── src/
│   ├── index.ts            # Pi package entrypoint
│   ├── chrome-devtools.ts  # Extension registration and command orchestration
│   └── *.ts                # Package-local browser, CDP, tool, and storage modules
├── README.md
├── LICENSE
├── tsconfig.json
└── package.json
```

`index.ts` is the Pi entrypoint and forwards to `chrome-devtools.ts`; the other source modules are internal. The package exposes its Pi extension through `package.json`:

```json
{
  "pi": {
    "extensions": ["./src/index.ts"]
  }
}
```

## 🔎 Keywords

Pi extension, Pi coding agent, Chrome DevTools Protocol, CDP, browser automation, web debugging, JavaScript evaluation, screenshot automation, AI coding agent tools.

## 📄 License

MIT. See [`LICENSE`](./LICENSE).
