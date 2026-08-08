# pi-starship presets plan

## Goal

Add Pi-native adaptations of every style listed by Starship 1.26.0's `preset --list`, plus a Minimal
preset, to `@narumitw/pi-starship`. Let TUI users browse, preview, optionally customize, confirm, and
atomically apply one from the existing `/starship` menu without weakening custom TOML, recovery,
lifecycle, or non-TUI behavior.

## Context

- `packages/pi-starship/src/commands.ts` currently exposes a six-item, current-state main menu and one
  transactional edit/preview/confirm pipeline. Presets should reuse that pipeline rather than add a
  second persistence protocol.
- `packages/pi-starship/src/config.ts` owns side-effect-free missing-file loading, TOML normalization,
  draft validation, atomic publication, concurrent-file protection, and runtime-apply rollback.
- The existing **Restore built-in…** action is documented recovery behavior and remains visible. The
  preset list therefore contains only non-default alternatives.
- Starship 1.26.0 publishes 12 presets: Bracketed Segments, Catppuccin Powerline, Gruvbox Rainbow,
  Jetpack, Nerd Font Symbols, No Empty Icons, No Nerd Font, No Runtime Versions, Pastel Powerline,
  Plain Text Symbols, Pure, and Tokyo Night. pi-starship supports its own modules and format semantics,
  so the bundled documents are Pi-specific adaptations of their colors and layouts rather than module
  compatibility copies.
- Applicable guidance already reviewed: `docs/extension-conventions.md`,
  `docs/extension-settings.md`, Pi TUI/menu lifecycle requirements, and the repository TDD boundary.
  Touched MUST areas are command/menu behavior, custom TUI width and cancellation, settings
  publication and rollback, session replacement/shutdown, deterministic tests, documentation,
  release intent, package inspection, and the root check.

## Architecture

- Add a lazy command-side preset catalog under `packages/pi-starship/src/presets/`. Each entry owns a
  stable ID, English label, concise description, Nerd Font requirement, and complete raw TOML
  document. Keep each substantial declarative document in its own module so no source file crosses the
  repository's 1,000-line limit.
- Keep `BUILT_IN_CONFIG` and `BUILT_IN_EXAMPLE` authoritative for missing-file defaults and recovery;
  presets must not alter startup defaults or config normalization.
- Import the preset catalog only through the already lazy `commands.ts` path. Opening ordinary Pi
  sessions must not eagerly load preset documents or Pi TUI Kit UI beyond current behavior.
- Add a seventh **Presets** row to the main menu and one shallow, extension-owned live picker using
  Kit's published custom-interaction lifecycle. Stable IDs drive selection; labels are presentation
  only. Exact raw-document equality identifies a currently applied preset, which is shown textually
  and disabled from redundant application. Any manual byte change is treated as custom configuration.
- Keep an independent in-memory preview slot in the runtime footer. Cursor changes synchronously
  replace only that render input and never alter the authoritative loaded settings or collector
  requirements. Enter reuses the named destructive confirmation and atomic apply path; `e` opens the
  existing editor with the selected document and returns to its standard review flow.
- Applying a preset is a complete-document replacement, not a TOML overlay. The confirmation must name
  the selected preset and state that custom settings, unknown fields, and comments will be removed and
  that no post-success backup is kept. Save, apply, concurrent-file protection, and rollback continue
  through the existing config APIs.
- Catalog: the Pi-specific `minimal` option plus stable IDs matching all 12 names emitted by
  `starship preset --list`. Bracketed, semantic modifier, Jetpack, and Pure adaptations are font-safe;
  Catppuccin, Gruvbox, Pastel, Tokyo Night, and Nerd Font Symbols explicitly require a Nerd Font.
  Every document chooses only local Pi and Git snapshot modules while preserving the source preset's
  color, separator, typography, and layout treatment.
- None of the initial presets enables GitHub PR queries, cloud/deployment readers, or optional
  command-backed workspace collectors. Preset previews remain synchronous consumers of the current
  immutable runtime snapshot.

## Non-Goals

- Read or execute Starship's preset command, binary, schema, or `starship.toml` at extension runtime.
- Claim complete compatibility with upstream preset TOML or copy unsupported Starship modules.
- Add a `/starship preset` textual route, project scope, environment override, automatic migration,
  remote/community preset download, preset composition, or TOML merge engine.
- Remove **Customize footer**, **Restore built-in…**, or any established `settings`, `status`, and
  `help` route.
- Detect whether the terminal actually has a Nerd Font; requirements remain explicit text and preview
  evidence.
- Introduce a Basic/Advanced submenu or more than the one preset-list navigation level.

## Assumptions

- The development reference is the local Starship 1.26.0 output from `starship preset --list` and
  `starship preset <name>`; runtime behavior remains independent of the Starship binary.
- Presets are complete starting points. Expert preservation is provided by **Customize before
  applying**, not by silently merging a preset into an existing document.

## Risks

- **Destructive replacement:** a preset could erase hand-written TOML or forward-compatible fields.
  Mitigation: preview first, use explicit replacement copy, require confirmation, and retain existing
  atomic rollback behavior.
- **Misleading active state:** normalized configs may be equivalent while source documents differ.
  Mitigation: claim `Currently applied` only for exact raw-document equality; otherwise show custom.
- **Font failure:** private-use glyphs render as boxes without a Nerd Font. Mitigation: mark affected
  rows and preview screens with `Requires Nerd Font`; keep two font-safe choices and non-color labels.
- **Narrow-terminal overflow:** Powerline glyphs and long confirmation text can become unusable.
  Mitigation: reuse adaptive preview and Kit wrapping, and test constrained widths/heights and resize.
- **Lifecycle race:** session replacement or shutdown can occur while a preset preview, editor, or
  confirmation is open. Mitigation: retain the command owner signal, dispose every custom component,
  and revalidate ownership after each await before save/apply/UI continuation.
- **Startup regression:** large bundled documents could enter the eager extension graph. Mitigation:
  keep the catalog under the lazy command implementation and retain source-entry/import tests.
- **Upstream resemblance and attribution:** themed documents may derive colors or ideas from Starship
  presets. Mitigation: adapt to Pi semantics, describe them as inspired, and retain/update `NOTICES.md`
  where source material is reused.

## Rollback / Recovery

- The on-disk schema and path remain unchanged. Reverting the feature leaves any applied preset as
  ordinary valid `pi-starship.toml`, still editable through `/starship settings`.
- **Restore built-in…** remains the deterministic recovery path for every preset.
- Cancel, Back, Escape, Ctrl+C, disposal, replacement, validation failure, confirmation rejection, and
  save failure leave the previous file and runtime unchanged.
- Runtime-apply failure restores the previous file/effective config through the current identity-aware
  rollback path; a concurrent newer file is preserved and reported instead of overwritten.

## Plan

- [x] Add focused red tests in `packages/pi-starship/test/config.test.ts` for the public preset catalog:
      every stable ID is unique, every complete document validates without diagnostics, font
      requirements are explicit, exact raw matching recognizes only unchanged preset documents, and
      no preset reaches network or optional command-backed modules; verify the focused tests execute
      and fail for missing preset behavior before implementation.
- [x] Add `packages/pi-starship/src/presets/` catalog and bounded document modules implementing the
      approved module/layout contracts; verify the focused catalog/config tests pass and source files
      remain below 1,000 lines.
- [x] Add focused red menu tests in `packages/pi-starship/test/command-ux.test.ts` and
      `packages/pi-starship/test/commands.test.ts` for the seventh **Presets** row, one-level preset
      list, descriptions and Nerd Font warnings, exact `Currently applied` disabled state, active
      preset configuration presentation, Back/focus restoration, and no startup/file/runtime side
      effects; verify they fail on the existing six-row menu for the intended reason.
- [x] Extend the declarative `defineMenu` flow in `packages/pi-starship/src/commands.ts` with stable
      catalog-driven preset actions and current-state presentation while preserving all existing menu
      items and direct routes; verify the focused main/preset menu tests pass at 20, 40, and 80 columns.
- [x] Add focused red interaction tests for selection preview, **Choose another preset**, preview
      Escape, **Customize before applying**, editor cancellation, final confirmation copy, successful
      first save, replacement of a custom/malformed document, and immediate runtime application;
      assert every pre-confirmation exit performs zero saves and zero applies.
- [x] Generalize the existing preview/apply workflow and connect preset selection to validation,
      preview, optional editing, confirmation, atomic save, and immediate apply; verify the interaction
      tests pass without duplicating persistence or rollback code.
- [x] Add failure and lifecycle regressions covering preset validation/render failure, warning display,
      write/rename failure, runtime-apply rollback, concurrent replacement, retry, external disposal,
      session replacement, and shutdown after each await boundary; verify the previous valid file and
      effective footer survive every unsuccessful path and no stale continuation publishes UI/state.
- [x] Re-audit non-TUI and compatibility behavior so no new textual subcommand is accepted, RPC no-arg
      help remains observable without opening custom TUI, print/JSON stay protocol-safe, existing
      completions remain `settings|status|help`, and lazy source-entry behavior is unchanged; verify
      existing route, lifecycle, and source-entry tests plus focused regressions pass.
- [x] Update `packages/pi-starship/README.md` with the preset catalog, font prerequisites, exact
      replacement/customize/recovery semantics, menu navigation, package layout, and Starship-inspired
      wording; update `NOTICES.md` only if implementation reuses upstream preset material, and add a
      minor Changeset for `@narumitw/pi-starship`; verify Biome and `npm run changeset:status` accept the
      documentation and release intent.
- [x] Run `npm run typecheck --workspace @narumitw/pi-starship`, the compiled pi-starship test set,
      `npm run check`, `just pack starship`, and a local Pi TUI/RPC smoke that previews, cancels, applies,
      and restores a preset from a temporary agent directory; record exact evidence and any unverified
      platform/font path before completion.
- [x] Audit the final diff against `docs/extension-conventions.md` and
      `docs/extension-settings.md`, including command modes, width, cancellation, disposal, session
      ownership, settings ordering/failure recovery, invalid-file protection, atomic publication,
      documentation, and release gates; verify every applicable MUST has test/review/smoke evidence and
      record any accepted deviation.

## Starship 1.26 catalog expansion

- [x] Capture `starship preset --list` and each `starship preset <name>` development output; verified
      the 12 upstream names and reviewed every emitted palette, format, separator, symbol policy, and
      typography treatment.
- [x] Extend the public catalog test to require all 12 upstream IDs plus Minimal; verified the red
      state reported the nine missing IDs and the former `bracketed` ID.
- [x] Add bounded Pi-native preset documents and action handlers for the complete catalog; verified
      every document parses without diagnostics, renders Pi-native information, uses only local Pi/Git
      modules, and declares its Nerd Font requirement.
- [x] Exercise the 13-item menu viewport and final-item navigation at 20, 40, and 80 columns; verified
      stable selection, active-item disabling, scrolling, and font-warning presentation.
- [x] Update README catalog and Starship attribution to explain the 1.26.0 color/layout reference and
      Pi-owned module selection.
- [x] Re-run package and repository checks, packaging, RPC smoke, and semantic convention audit; final
      evidence is recorded below.

## Live cursor preview follow-up

The approved follow-up replaces the static preset action screen with a specialized, lifecycle-owned
picker. Its cursor is the temporary footer state: opening the picker and every Up/Down/Page/Home/End
move previews the selected complete preset in memory against the current immutable runtime snapshot.
Enter starts the existing destructive confirmation and atomic save/apply protocol; `e` preserves
**Customize before applying**. Escape/Back, Ctrl+C, external disposal, session replacement, shutdown,
confirmation cancellation, validation failure, and apply failure clear the temporary preview and leave
the previous document/effective footer intact. Preview updates are synchronous latest-selection-wins
assignments, so no debounce or asynchronous generation race is introduced.

- [x] Add focused red TUI tests for initial and cursor live preview, zero writes during browsing,
      Enter-to-confirm/apply, `e` customization, active-row disabling, and preview restoration across
      Back, Ctrl+C, disposal, replacement, and shutdown; the initial run failed on absent preview calls
      and the old multi-step preview interaction, then the focused set passed with 2,544 root tests.
- [x] Add an extension-owned picker through the already-published Kit custom-interaction API and a
      separate runtime preview slot; focused runtime coverage proves selection changes only the footer
      render input, creates no settings file, and Back restores the built-in footer.
- [x] Reuse the existing confirmation/save/apply/rollback protocol for direct Enter and preserve the
      editor/recovery path on `e`; focused confirmation cancellation, apply, customization, invalid
      draft, width, disposal, and shutdown tests pass.
- [x] Update README/help/plan evidence, run package/root checks, pack and RPC smoke, repeat the semantic
      convention audit, archive this plan, commit, and push the PR update; final root verification passed
      2,547 tests, packaging included 79 files, and RPC help advertised live preset preview without
      creating settings.

## Completion Checklist

- [x] `/starship` presents seven shallow, goal-oriented actions and a 13-item preset screen with
      visible current state, font requirements, Back, Escape, and Ctrl+C behavior.
- [x] Font-safe and Nerd Font-dependent choices are clearly marked; all 13 documents validate cleanly
      and render within supported widths without enabling undocumented collectors or network work.
- [x] Browsing presets never mutates disk or authoritative runtime state; users can live-preview,
      confirm apply, customize first, choose another, or cancel without ambiguous side effects.
- [x] Complete-document replacement is disclosed, confirmed, serialized, atomic, generation-safe, and
      rollback-capable; malformed/current/concurrent documents follow the documented recovery rules.
- [x] Built-in defaults, Restore, custom TOML, menu/direct command routes, non-TUI protocol behavior,
      lazy command loading, lifecycle cleanup, and unknown-field behavior remain compatible and tested.
- [x] README, attribution review, minor Changeset, focused tests, package typecheck, local TUI/RPC smoke,
      `npm run check`, and `just pack starship` pass with recorded evidence.

## Execution Evidence

- Initial four-preset implementation completed 2026-08-08 on `feat/pi-starship-presets` after
  rebasing onto `origin/main` at `1156ee7`; the later Starship 1.26 catalog expansion retains the same
  lazy command import boundary.
- TDD evidence: the catalog test first failed with an empty preset list, and the menu test first failed
  on the existing six-row menu and `Custom configuration` state. Focused config, menu, interaction,
  rendering, failure-recovery, and lifecycle tests then passed.
- `npm run check --workspace @narumitw/pi-starship` passed. The compiled package test set passed before
  the final root gate; `npm run check` passed with 2,542 tests after the final rebase and help-text
  update.
- Initial `just pack starship` passed with 69 files and Changeset status reported the intended
  independent minor bump to `@narumitw/pi-starship` 0.50.0. Final expansion packaging evidence is
  recorded below.
- A real Pi 0.84.1 RPC smoke loaded only `packages/pi-starship/src/index.ts`, discovered `/starship`,
  returned the updated `/starship help` notification, exited successfully, and left the temporary
  agent directory without `pi-starship.toml`. TUI behavior was exercised through the local async Kit
  harness at 20, 40, and 80 columns; an interactive real-terminal/Nerd Font visual smoke was not run
  because repository execution policy forbids opening a TUI.
- Semantic audit covered `docs/extension-conventions.md`, `docs/extension-settings.md`, and Pi's full
  `extensions.md`, `tui.md`, `packages.md`, and `rpc.md`: direct routes/modes are preserved; preset
  selection is TUI-only; cancellation, disposal, replacement, and shutdown are generation-safe;
  complete-document replacement is previewed and confirmed; existing invalid-file, atomic publication,
  concurrent-file preservation, runtime rollback, lazy loading, and missing-file semantics remain in
  force. No accepted convention deviation remains; only real Nerd Font appearance is unverified.
- Follow-up expansion evidence: Starship 1.26.0 reported all 12 expected IDs, and all emitted documents
  were reviewed as development references. The 13 Pi documents validate without diagnostics, render
  expected Pi/Git information, and limit reachability to local core modules. The TDD catalog red state
  named the nine missing upstream styles and obsolete `bracketed` ID before implementation.
- Final `npm run check --workspace @narumitw/pi-starship` and root `npm run check` passed; the root gate
  completed 2,542 tests. `npm run changeset:status` still reports only the intended minor bump to
  `@narumitw/pi-starship` 0.50.0. Final `just pack starship` passed with 78 files, including all 14
  `src/presets/` modules, at 81.1 kB packed / 301.5 kB unpacked.
- Final Pi RPC smoke loaded only `src/index.ts`, discovered `/starship`, observed preset-aware help,
  exited successfully on stdin close, and did not create `pi-starship.toml`. The Kit TUI harness covered
  the paged 13-item list at 20, 40, and 80 columns; a real Nerd Font visual smoke remains unverified
  because repository execution policy forbids opening a TUI.
- Live-picker follow-up evidence: cursor changes synchronously publish an independent preview slot;
  Back, Ctrl+C, confirmation cancellation, disposal, session replacement, shutdown, invalid drafts,
  and failed apply paths clear it without persistence. Direct Enter reuses destructive confirmation and
  atomic apply, while `e` reuses the editor/review path. Callback-injected navigation and hints are
  covered. Final package check and root `npm run check` passed with 2,547 tests; Changesets still reports
  only `@narumitw/pi-starship` 0.50.0. `just pack starship` passed with 79 files at 82.4 kB packed /
  309.2 kB unpacked, including `src/command-preset-picker.ts`. The final RPC smoke advertised
  `live-preview presets` and created no settings file. Re-audit found no convention deviation; the
  prohibited real-terminal/Nerd Font visual path remains the only unverified presentation path.
