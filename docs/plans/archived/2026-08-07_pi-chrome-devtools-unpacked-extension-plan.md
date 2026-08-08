# pi-chrome-devtools unpacked extension plan

## Goal

Allow `@narumitw/pi-chrome-devtools` to launch its isolated managed browser with one or more
user-approved unpacked Chrome extensions configured in `pi-chrome-devtools.json`, without requiring
new environment variables or changing externally managed Chrome instances.

## Context

- `packages/pi-chrome-devtools/src/browser-manager.ts` already owns browser discovery, isolated temp
  profiles, process startup, dynamic CDP ports, and session-shutdown cleanup. Its managed launch argv
  is the narrow integration point for extension startup flags.
- `packages/pi-chrome-devtools/src/settings.ts` currently stores tool selection in
  `${getAgentDir()}/pi-chrome-devtools.json`, preserves unknown fields, serializes writes, and
  publishes atomically. Its validator currently requires `tools` and `updatedAt`, so it cannot yet
  load a browser-only settings document or a project override.
- Local probes established the compatibility boundary: branded Chrome 148 ignored an unpacked
  extension passed through startup flags and exposed `Extensions.getExtensions` as `Method not
  available` over the current port/WebSocket transport, while Chrome for Testing 149 loaded the same
  fixture and exposed its Manifest V3 service-worker target.
- Applicable guidance is `docs/extension-conventions.md` and `docs/extension-settings.md`. The touched
  areas are settings validation/precedence/persistence, managed-process launch and shutdown,
  command status/help, documentation, tests, package contents, and release intent.

## Architecture

Add an optional browser object to the existing canonical user settings file:

```json
{
  "browser": {
    "executablePath": "/absolute/path/to/chrome-for-testing",
    "extensionPaths": ["/absolute/path/to/unpacked-extension"]
  }
}
```

Also accept a trusted project override at `<workspace>/${CONFIG_DIR_NAME}/pi-chrome-devtools.json`:

```json
{
  "browser": {
    "extensionPaths": ["."]
  }
}
```

Resolve settings as defaults, canonical user settings, then trusted project overrides. Existing
`PI_CHROME_DEVTOOLS_*` variables remain backward-compatible explicit runtime overrides; no new
environment variable is added. User-file paths must be absolute. Project `extensionPaths` may be
absolute or relative to `ctx.cwd`, and the project array replaces the user array. A project file does
not override `browser.executablePath`; executable selection remains machine-owned user configuration.

`settings.ts` owns schema normalization, source-aware path validation, side-effect-free loading,
unknown-field preservation, read/write ordering, and global tool-selection saves. `runtime.ts` owns
the resolved effective browser configuration for the current session. `browser-manager.ts` consumes
only validated absolute paths and adds comma-joined `--disable-extensions-except` and
`--load-extension` arguments when launching an extension-owned isolated browser.

When `extensionPaths` is non-empty, the extension must not reuse an already-running external CDP
endpoint because extensions cannot be retrofitted through the current transport. It instead requires
local auto-launch, a configured Chrome for Testing or Chromium-compatible executable, and a managed
browser. Explicit remote hosts, disabled auto-launch, unsupported branded browsers, missing manifests,
and occupied explicit ports fail with actionable diagnostics. Existing external browsers are never
closed or modified.

Changing JSON during a session takes effect after `/reload` or session replacement; existing
shutdown behavior closes the prior managed browser before the next configuration is applied.
Quick-start and status output show effective sources and resolved paths without printing unrelated
settings content.

## Non-Goals

- Implement pipe-based CDP or call `Extensions.loadUnpacked` in branded Chrome.
- Download or install Chrome for Testing automatically.
- Dynamically add, reload, or uninstall an extension in an already-running browser.
- Persist browser paths through a new environment variable or a second settings filename.
- Build a path-picker/settings TUI in this phase; free-form paths remain documented JSON settings.
- Change the existing page, navigation, evaluation, or screenshot tool schemas.

## Risks

- A trusted unpacked extension executes privileged browser code. Honor only canonical user settings
  and trusted project overrides, validate directory identity and `manifest.json`, and document the
  trust boundary prominently.
- The current attach-first behavior could silently connect to a browser without configured
  extensions. Extension-configured sessions must force a managed launch or fail before exposing a
  misleading page list.
- Branded Chrome may silently ignore startup extension flags. Classify the configured executable
  before launch and reject unsupported products rather than claiming success.
- Settings saves could erase browser fields or project reads could race pending user writes. Keep one
  ordered settings protocol, preserve unknown and recognized sibling fields, and await pending saves
  before reload/shutdown-dependent reads.
- Process startup may be cancelled or the session may be replaced between validation and endpoint
  readiness. Revalidate generation/cancellation after each await and retain idempotent process and
  temp-profile cleanup.

## Rollback / Recovery

- The browser object is additive. Older releases treat it as unknown data and preserve it during tool
  selection saves.
- Omitting or removing `browser.extensionPaths` restores the current attach-first behavior after
  `/reload`; no browser-profile migration is required because managed profiles are temporary.
- Invalid global or project JSON remains unchanged and is ignored with a warning. Launch failure
  leaves external browsers untouched and managed-process cleanup removes only extension-owned
  resources.

## Plan

- [x] Add failing settings cases under `packages/pi-chrome-devtools/test/` for browser-only user
      documents, omitted defaults, absolute user paths, trusted project relative paths, untrusted
      project suppression, project-array replacement, invalid browser shapes and manifests, global
      tool-save preservation, malformed-file protection, unknown fields, and pending-save/read
      ordering. Evidence: the initial focused compile failed on the absent browser/project contract;
      the final focused suite passes.
- [x] Refactor `packages/pi-chrome-devtools/src/settings.ts` to normalize independent tool and browser
      sections, load canonical user plus trusted project settings without creating missing files,
      resolve paths by scope, preserve recognized and unknown siblings during atomic global saves,
      and expose effective values with source metadata. Evidence: `settings.test.ts` plus all legacy
      settings cases pass.
- [x] Add failing managed-launch cases for extension attach bypass, launch requirements, executable
      classification, ordered argv, multiple paths, occupied ports, partial failure, cancellation,
      repeated shutdown, and unchanged attach-first behavior. Evidence: the initial focused compile
      failed on the absent launch contract; `managed-browser.test.ts` now passes with test-owned fakes.
- [x] Update `runtime.ts` and `browser-manager.ts` to force an owned isolated launch, use shell-free
      argv, reject unsupported modes/products before spawn, and clean every partial or cancelled
      launch. Evidence: focused launch/lifecycle tests and the real-browser smoke pass.
- [x] Extend session lifecycle and status handling to use `ctx.cwd`, `ctx.isProjectTrusted()`,
      generation checks, ordered shutdown, source-aware status, restart semantics, and Chrome for
      Testing guidance. Evidence: TUI/RPC, replacement, shutdown, and display-sanitization tests pass.
- [x] Update the package README and add a minor Changeset for
      `@narumitw/pi-chrome-devtools`. Evidence: `.changeset/bright-chrome-extensions.md` resolves to a
      `0.50.0` minor bump and the package dry run contains the documented README and source files.
- [x] Run a bounded real-browser smoke with a temporary Manifest V3 fixture and explicit Chrome for
      Testing binary. Evidence: the non-interactive compiled-source equivalent was used instead of
      the TUI-opening `just try` command; Chrome for Testing `149.0.7827.55` on `linux/x64` exposed the
      fixture `background.js` service-worker target, navigation/evaluation/screenshot passed,
      replacement removed the old process/profile, and a separately running external CDP browser
      remained reachable. Windows and macOS were not exercised.
- [x] Audit the final diff and run all required checks. Evidence: focused compiled tests (46), package
      check, root `npm test` (2,514 tests), root `npm run check` (Biome, boundaries, typechecks, and
      2,514 tests), package dry run (14 files), Changeset status, and `git diff --check` all pass.

## Completion Checklist

- [x] `pi-chrome-devtools.json` configures Chrome for Testing/Chromium and unpacked extension paths
      without a new environment variable.
- [x] Missing settings preserve current behavior; user/project precedence, path resolution,
      invalid-file protection, unknown-field preservation, atomic saves, and reload semantics match
      the README.
- [x] Extension-configured sessions use only an extension-owned isolated browser and never silently
      attach to, mutate, restart, or close an external browser.
- [x] Supported browsers load configured test extensions with safe startup argv; branded browsers and
      invalid paths fail before a misleading success.
- [x] Cancellation, partial startup, replacement, `/reload`, and shutdown release owned processes,
      retries, status entries, and temporary profiles idempotently.
- [x] Existing list/select/navigate/evaluate/screenshot behavior and no-extension attach-first startup
      remain backward compatible.
- [x] Focused tests, package/root checks, Changeset status, package dry run, Chrome for Testing smoke,
      final semantic audit, and plan evidence pass before archival.
