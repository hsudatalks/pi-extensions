# Pi Chrome DevTools Menu Redesign Plan

## Goal

Redesign `@narumitw/pi-chrome-devtools` around tool-access, browser-status, setup, and recovery goals:
show consequential current state before decisions, stage and preview menu-based tool changes before one
confirmed apply, keep navigation shallow, preserve every existing command/settings compatibility route,
and provide width-safe, keyboard-accessible TUI and RPC behavior with actionable failure recovery.

## Context

- `packages/pi-chrome-devtools/src/chrome-devtools.ts` currently owns command parsing and a six-row
  action menu whose informational actions close into notifications.
- `packages/pi-chrome-devtools/src/tool-selector.ts` currently combines immediate-save tool selection,
  persistence transactions, status/setup text, and command help. Its five tool rows expose raw tool
  identifiers and save every accepted toggle immediately, so Escape cannot cancel earlier changes.
- `packages/pi-chrome-devtools/src/settings.ts` already serializes in-process saves, publishes through a
  same-directory temporary file plus rename, rejects invalid recognized settings, and preserves unknown
  fields. Missing files remain side-effect free; canonical/legacy precedence and trusted project browser
  settings are established compatibility contracts.
- `packages/pi-chrome-devtools/src/runtime.ts` and `browser-manager.ts` expose configured endpoint,
  managed-browser, launch-attempt, effective-source, and project-trust state. Opening the redesigned
  menu must summarize this state without probing an endpoint or launching Chrome.
- Applicable guidance is `docs/extension-conventions.md`, `docs/extension-settings.md`, Pi's
  `docs/extensions.md` and `docs/tui.md`, and the repository's `@narumitw/pi-tui-kit` contract. Touched
  MUST areas are command routes/modes, custom TUI width and lifecycle, settings ordering/publication,
  session replacement/shutdown, deterministic tests, documentation, release intent, and the root check.
- Frequency assumptions are not backed by telemetry. The approved priority is: tool access first,
  browser status and recovery second, settings/setup and help supporting; no Basic/Advanced menu split.

## Architecture

- Keep `chrome-devtools.ts` as the thin extension registration, lifecycle, command parsing, and
  compatibility-route dispatcher.
- Add a descriptive menu module under `packages/pi-chrome-devtools/src/` that owns command-scoped menu
  state, the state-first main screen, nested detail screens, staged tool drafts, exact review content,
  loading/cancellation feedback, and TUI/RPC navigation. The command-scoped draft must not enter global
  runtime state or storage before confirmation.
- Keep stable tool identities in `tool-names.ts`; add one extension-owned presentation mapping for the
  five friendly task labels and concise descriptions. Never recover identity from rendered labels.
- Keep tool-set validation, non-Chrome-tool preservation, serialized application, status snapshots, and
  persistence coordination in `tool-selector.ts` (or extract those domain responsibilities to one
  descriptive module if the implementation would otherwise mix menu rendering with transactions).
- Keep `settings.ts` authoritative for canonical/legacy reads, invalid-file protection, unknown-field
  preservation, ordered saves, and atomic file publication. A confirmed tool change is one serialized
  extension transaction: validate generation and accepted state, apply the Chrome-only runtime delta,
  publish the settings update, roll runtime back on publication failure, and report success only when
  both accepted states agree. Wait for an idle command boundary before menu confirmation so the model
  cannot observe an intermediate active-tool set.
- Use existing `pi-tui-kit` action, multi-select, detail, and review screens. The extension owns draft,
  preview, confirmation, persistence, rollback, and browser-status semantics. Verify these APIs exist at
  the package's declared compatibility floor before editing; if a higher unpublished or unapproved floor
  is required, stop and revise this plan rather than coupling the consumer to it.

## Non-Goals

- Add a live connection test, launch Chrome from the menu, or claim an unprobed endpoint is ready.
- Add browser executable/path editors, a filesystem picker, or automatic `/reload` after JSON edits.
- Add speculative presets such as “inspection mode”; retain only unambiguous Select all/Select none
  shortcuts plus expert per-tool selection.
- Change any CDP tool name, schema, execution behavior, screenshot policy, browser launch policy, status
  key, settings field, precedence rule, environment override, or managed-browser lifecycle.
- Remove or rename `/chrome-devtools`, documented subcommands, accepted aliases, or legacy settings
  compatibility.
- Add a Basic/Advanced section or another navigation level for the five related tools.

## Risks

- Deferred selection could accidentally reuse immediate-save code and mutate runtime or disk before
  Apply. Keep the draft command-scoped and add negative assertions around every cancel/back/close path.
- Runtime and file state cannot be committed by one OS primitive. Serialize the whole extension-owned
  transaction, apply only at an idle boundary, roll runtime back on write failure, wait for the queue on
  shutdown, and never report success after a partial or stale continuation.
- Session replacement or shutdown can occur while loading, reviewing, waiting for idle, or saving.
  Cancel every owned loader/task and revalidate generation/session ownership after each await.
- Invalid settings or a failed rollback could erase a valid document or leave misleading UI. Preserve
  exact prior runtime state and file bytes, keep malformed files untouched, retain the draft for retry,
  and report both primary and rollback failures when applicable.
- Friendly labels can conceal stable tool identity. Keep raw names in descriptions/search metadata and
  use raw IDs for every action and persisted value.
- Long paths, launch errors, or narrow terminals can hide recovery text. Use Kit wrapping/adaptive
  viewports, sanitize terminal controls, and test critical state and action copy at constrained sizes.
- TUI screen-reader semantics are limited by Pi and terminal emulators. Preserve a logical plain-text
  reading order, non-color state cues, injected keybindings, and focus restoration without claiming web
  ARIA support.

## Rollback / Recovery

- The stored schema is unchanged. Reverting the redesign restores the prior immediate-save menu while
  retaining every settings document written by the new version.
- Direct `enable` and `disable` routes remain immediate compatibility/automation paths, so users retain
  a deterministic fallback if the interactive workflow cannot open.
- A cancelled or failed draft leaves no new file when settings were missing and leaves prior runtime,
  canonical/legacy files, unknown fields, and non-Chrome tools unchanged.
- Browser JSON remains manually repairable at the documented user/project paths; invalid content is
  never overwritten by the menu.

## Plan

- [x] Add focused red tests in a new `packages/pi-chrome-devtools/test/menu.test.ts` for the approved
      state-first main screen: all/none/partial/unsaved tool state, configured-versus-observed browser
      state, endpoint, relevant settings/launch warnings, five-or-fewer actions, dynamic bulk action,
      and no browser probe or launch. Evidence: the focused test initially failed on the old six-row
      stateless menu and now passes.
- [x] Add the command-scoped menu-state and presentation module, then replace the notification-closing
      main menu in `chrome-devtools.ts` with a Kit menu whose default row is `Choose browser tools…`,
      whose supporting rows are the dynamic all/none preview, Browser status, Settings & setup, and
      Help. Evidence: the focused 40-column main-menu test passes and observes no launch state.
- [x] Add focused interaction tests for friendly stable-ID tool rows, Select all, Select none, staged
      toggles, unapplied-change counts, exact review content, review Back, Apply, Cancel, Escape, Ctrl+C,
      focus restoration, and main-menu quick bulk previews; assert every pre-Apply exit makes zero
      `setActiveTools` calls and zero settings writes. Evidence: the focused menu suite passes. TDD
      deviation: the first deferred-flow red harness stalled before reaching its assertion, so the
      corrected deterministic interaction tests were completed with the implementation; the main-menu
      slice retains direct red/green evidence and the full gate mitigates the remaining sequencing risk.
- [x] Implement the extension-owned deferred tool workflow with five flat friendly rows, raw tool names
      retained in descriptions/search identity, command-scoped accepted/draft selections, an exact
      before/after review screen, explicit `Apply tool changes`, and draft disposal on cancellation.
      Evidence: TUI and RPC stage/cancel/review/apply tests pass.
- [x] Add focused transaction coverage for idle-boundary application, non-Chrome-tool preservation,
      invalid settings, write/rename failure, runtime rollback, retryable drafts, rapid direct updates,
      stale generation, session replacement, and shutdown. Evidence: the 63-test package suite plus the
      new failed-confirmation and replacement tests pass.
- [x] Refactor `tool-selector.ts` and the narrow settings integration so one serialized confirmed
      transaction preserves existing settings/unknown fields and other active tools, rolls runtime back
      when publication fails, keeps the draft for retry, waits at shutdown, and publishes success only
      after runtime and disk agree. Evidence: existing settings/transaction/lifecycle suites and the
      explicit wait-for-idle ordering assertion pass.
- [x] Add focused navigation/content tests for Browser status, Settings & setup, and Help as nested
      Back-capable screens, including unobserved/running/failed status and no-probe behavior. Evidence:
      TUI navigation, direct-route, and actual RPC smoke evidence pass.
- [x] Implement the three adaptive read-only review screens and consolidate duplicated
      status/setup/help formatting into width-safe sanitized builders with adjacent failure recovery.
      Evidence: Back restores main-menu navigation and constrained-height/width tests pass.
- [x] Add and pass loading, disposal, mode, responsive, and accessibility-focused tests for cancellable
      loading, Escape/Ctrl+C/replacement cleanup, 20/40/80-column and constrained-height rendering,
      control-safe text, non-color state, focus restoration, RPC parity, direct mutations, and explicit
      unsupported-mode rejection. Evidence: focused menu tests and Kit coverage in `npm run check` pass.
- [x] Re-audit command parsing/completions and compatibility tests so documented routes plus `toggle`,
      `select`, `on`, and `off` remain exact aliases, direct mutations remain deterministic, and all
      settings/default/precedence/environment/migration behavior stays unchanged. Evidence: aliases are
      documented/completed and the Chrome DevTools compatibility suites pass.
- [x] Update `packages/pi-chrome-devtools/README.md` and add a minor Changeset. Evidence:
      `.changeset/calm-browsers-review.md` appears under the package's `0.50.0` minor release intent in
      `npm run changeset:status`.
- [x] Run focused package typecheck and compiled Chrome DevTools tests, then a non-interactive declared
      entrypoint/RPC smoke. Evidence: package typecheck and 63 tests pass; Pi 0.84.1 RPC opened every
      detail, cancelled the main menu, staged/reviewed/applied 4/5 tools in a temporary agent directory,
      and emitted status without invoking a browser tool or creating a managed browser.
- [x] Audit the final diff against `docs/extension-conventions.md` and `docs/extension-settings.md`, then
      run required checks. Evidence: `git diff --check`, `npm run check` (2,535 tests),
      `just pack chrome-devtools` (15 expected files), Changeset status, lazy menu-import review, and the
      source-size audit pass; Windows and macOS runtime rendering were not exercised.

## Completion Checklist

- [x] The no-argument TUI/RPC menu shows accurate consequential state before a decision and keeps five
      or fewer goal-oriented actions on one shallow level.
- [x] The five related tools use friendly labels in one flat group, retain raw stable identities, and
      support Select all/Select none plus exact expert customization without invented presets.
- [x] Menu toggles and bulk previews have no runtime, file, browser, or notification side effect until
      `Apply tool changes`; Back, Cancel, Escape, Ctrl+C, disposal, and replacement discard drafts.
- [x] Confirmed application is serialized and generation-safe, preserves every non-Chrome tool and
      unknown settings field, reports immediate success, and restores the previous valid state with an
      actionable error on failure.
- [x] Browser status distinguishes configured, unobserved, running, and failed state without launching
      or probing Chrome; setup and recovery expose effective sources, trust, security, paths, and reload
      requirements without critical truncation.
- [x] TUI and RPC navigation, focus, keyboard operation, loading, errors, constrained widths/heights,
      long text, plain-text accessibility cues, and supported/unsupported mode behavior have
      deterministic evidence.
- [x] Every existing command/alias, tool contract, settings/default/precedence/migration behavior,
      environment override, external-browser guarantee, and managed-browser lifecycle remains covered
      by compatibility tests and documentation.
- [x] README, minor Changeset, focused tests, runtime/RPC smoke, package dry run, final semantic audits,
      `git diff --check`, and `npm run check` pass with recorded evidence before this plan is archived.
