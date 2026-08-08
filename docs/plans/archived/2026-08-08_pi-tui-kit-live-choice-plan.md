# Pi TUI Kit live choice plan

## Goal

Add a reusable standalone live-choice interaction, a shared internal selection controller, and a
public interaction-hint formatter to `@narumitw/pi-tui-kit`, while keeping preview state,
persistence, confirmation, rollback, and session ownership in consuming extensions.

## Architecture

- `runLiveChoice()` owns TUI/RPC adaptation, injected-key navigation, typed interaction outcomes,
  custom shortcut dispatch, disposal, and pending preview-callback draining.
- A package-internal selection controller owns stable-ID selection, wrapping single-step movement,
  clamped paging, Home/End behavior, and empty-list safety for both declarative choice screens and
  standalone live choices.
- `formatInteractionHints()` owns keybinding lookup, key-name normalization, terminal sanitization,
  exclusions, and de-duplication. It does not own product wording.
- Existing declarative `choice` screens remain side-effect-free. `pi-starship` and `pi-statusline`
  migrations are deferred until the new Kit API is published, as required by the repository release
  boundary.

## Non-Goals

- Move extension-owned preview snapshots, save/apply logic, rollback, collectors, or session
  generations into the Kit.
- Change existing declarative `ChoiceScreen` cursor semantics or public menu behavior.
- Publish the package or migrate a consumer in this branch.

## Plan

- [x] Record the existing Pi TUI Kit focused-test baseline and map the touched custom-interaction,
      TUI, RPC, public-API, documentation, and package verification rules; the compiled package suite
      passed 147 tests before implementation. Applicable MUST rules: TUI-only `custom()`, bounded and
      sanitized rendering, injected keybindings, cancellation/disposal/draining, stale-context
      revalidation, deterministic tests, CI gate, Changeset release intent, package smoke, and no
      consumer adoption before the Kit API is published.
- [x] Add failing public-contract tests for `formatInteractionHints()` covering injected bindings,
      aliases, control sanitization, exclusions, and de-duplication; TypeScript initially failed on
      the missing export, then the focused test passed 2 tests.
- [x] Add selection characterization coverage, extract the internal stable-ID selection controller,
      and make the existing choice component use it without behavior changes; existing code already
      satisfied the corrected wrap/page/Home/End/empty-list contract, and all 38 focused screen
      component tests passed after extraction.
- [x] Add failing `runLiveChoice()` TUI tests for initial/cursor preview, wrap/page/Home/End movement,
      current and disabled rows, confirmation, custom shortcuts, Back/Close, bounded sanitized
      rendering, callback draining, cancellation, disposal, stale ownership, and errors; the initial
      compile failed on the missing API and the completed focused live-choice suite passed.
- [x] Add failing `runLiveChoice()` RPC and unsupported-mode tests proving deterministic ordinary
      selection without live preview or shortcut execution, disabled-row handling, stale ownership,
      and typed unsupported/error outcomes; all 9 focused live-choice tests passed across TUI, RPC,
      unsupported, stale, disposal, callback-draining, and error paths.
- [x] Export and document all three APIs, update API compatibility metadata and package release
      intent, and verify README type examples with package typechecking and build; API version 9,
      public root export smoke, package check/build, context type tests, README usage types, and the
      Kit-only minor Changeset all passed.
- [x] Audit the final diff against `docs/extension-conventions.md`: `runLiveChoice()` guards TUI
      custom UI by mode, uses injected navigation, inherits width-safe sanitized choice rendering,
      aborts and drains previews on every exit, blocks stale cursor callbacks, and revalidates after
      awaited previews; RPC is signal-aware and deterministic; graph evidence found no production
      consumer adoption; boundary checks and the Kit-only Changeset passed. No deviation accepted.

## Completion Checklist

- [x] The final root suite passed all 2,562 tests, including the complete compiled Pi TUI Kit suite.
- [x] `npm run check` passed after temporarily moving the pre-existing untracked `dev/` directory
      outside the worktree so Biome would not inspect those unrelated local runtime files; `dev/` was
      restored unchanged immediately afterward.
- [x] `just pack tui-kit` succeeds; the final dry-run contained 57 declared files (48.8 kB packed,
      222.2 kB unpacked), including built JavaScript/declarations, README, license, and manifest.
- [x] The completed plan is archived at
      `docs/plans/archived/2026-08-08_pi-tui-kit-live-choice-plan.md` with all evidence recorded.
- [x] Final status/diff inspection found only the Kit implementation, tests, README, roadmap
      alignment, Changeset, and this plan; the pre-existing untracked `dev/` directory remains
      present and untouched.
