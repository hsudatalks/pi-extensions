# Pi TUI Kit Standalone Confirmation Plan

## Goal

Add and publish a bounded standalone confirmation contract that preserves Confirmed, Back, Close,
Stale, Unsupported, and Error outcomes across Pi modes, then prove it through Image Drop and
Analytics without moving either extension's domain side effects into Pi TUI Kit.

## Context

- Image Drop already implements `confirmed | cancelled | close` locally so Escape returns to its
  menu while Ctrl+C closes the whole flow.
- Analytics currently uses boolean `ctx.ui.confirm()` inside its Kit menu; cancellation stays on the
  privacy screen, but the boolean contract cannot preserve a TUI Ctrl+C request to close the whole
  dashboard.
- Pi RPC confirmation cancellation collapses to `false`; a deterministic Kit `select()` adaptation
  can preserve explicit Confirm/Cancel choices and map protocol cancellation to Back, while RPC
  cannot claim a separate Ctrl+C Close event the protocol does not expose.
- Repository policy requires publishing the Kit API before either consumer raises its compatibility
  floor. Publication, tags, visibility, and release workflow dispatch remain separately approval
  gated.

## Architecture

- Add `runConfirmation()` as a standalone Kit helper, not a ninth declarative menu screen.
- Return `confirmed`, `closed` with the existing `back | close` reason, `stale`, `unsupported`, or
  `error`; keep all domain mutation after a `confirmed` result in the consumer.
- In TUI mode, compose the existing standard actions renderer under `runCustomInteraction()` so the
  Kit reuses width safety, injected theme/keybindings, Ctrl+C handling, disposal, owner cancellation,
  stale classification, and pending-work draining.
- In RPC mode, issue one signal-aware `select()` with explicit Confirm and Cancel rows. Explicit
  Cancel and protocol cancellation map to Back; the adapter does not invent a Close signal.
- In print/JSON modes, return Unsupported after the optional callback. Revalidate owner state after
  every await and classify callback/UI failures without publishing stale feedback.
- Keep title, message, labels, session signal/generation, and every confirmed side effect
  consumer-owned.

## Non-Goals

- Do not add a generic modal framework, confirmation payload, timeout policy, danger styling, domain
  action callback, or new declarative screen kind.
- Do not change ordinary `ctx.ui.confirm()` behavior or existing menu Back/Close behavior.
- Do not publish or raise a consumer dependency floor without separate explicit approval.

## Risks

- Reusing a standard actions renderer could accidentally expose menu-only behavior. Mitigation:
  exercise only semantic activate/Back/Close events and keep the helper's public result independent
  of component internals.
- RPC cannot distinguish client cancellation reasons. Mitigation: document and test deterministic
  cancellation-to-Back behavior instead of claiming false parity.
- A confirmation result could win a race against session replacement. Mitigation: owner abort and
  `isCurrent()` checks take precedence after every await and before returning a user result.
- Consumer migrations could appear valid through workspace hoisting before the API exists on npm.
  Mitigation: keep them in a post-publication step and verify the registry package first.

## Rollback / Recovery

- Before publication, revert the helper, tests, docs, API-version change, and changeset together.
- After publication, retain the additive Kit API and revert each consumer migration independently;
  do not lower unrelated consumer compatibility floors automatically.

## Plan

- [x] Add focused `packages/pi-tui-kit/test/confirmation.test.ts` contract tests that initially fail
      because `runConfirmation()` is absent, covering TUI Confirm/Cancel/Escape/Ctrl+C, RPC
      Confirm/Cancel/protocol cancellation, terminal sanitization and width, stale owner abort,
      external disposal, unsupported modes, callback/UI errors, and stale-error suppression. Evidence:
      package typecheck first failed on the absent export, then the focused compiled Node test passed
      8/8 after the implementation.
- [x] Implement `packages/pi-tui-kit/src/confirmation.ts`, export its public options/result types and
      `runConfirmation()` from `src/index.ts`, and raise the menu API literal to 7. Evidence: package
      check/typecheck/build passed, generated declarations expose the generic context contract, and all
      143 Pi TUI Kit tests passed including export and context-usage checks.
- [x] Update `packages/pi-tui-kit/README.md` with ownership and exact TUI/RPC/non-interactive
      semantics, add a minor Kit changeset, and update the roadmap's source-complete status without
      marking the proof milestone complete. Evidence: Changesets resolves Kit to an independent
      0.50.0 minor; `just pack tui-kit` listed 49 intended files including production/testing roots and
      `dist/confirmation.{js,d.ts}`; package Biome/typecheck/build and cold RPC import passed.
- [x] Audit the source-complete diff against `docs/extension-conventions.md`, Pi `extensions.md`,
      `tui.md`, `rpc.md`, and `packages.md`, including cancellation, component disposal, session
      replacement, shutdown, post-await revalidation, public-root imports, and zero private `dist/*`
      imports. Evidence: focused tests cover all named lifecycle paths, await/guard review found owner
      revalidation at every continuation, and source searches found zero private `dist/*` references
      and zero coding-agent runtime value imports.
- [x] Run `npm run check` and the deterministic Kit runtime benchmark/smoke. Evidence: the repository
      gate passed 2,448/2,448 tests; the five-run benchmark kept `codingAgentLoaded: false` in import,
      actions, review, and task scenarios (121.04 ms median cold import), and a built RPC confirmation
      smoke returned `confirmed` through API version 7.
- [x] Obtain explicit user approval to publish the new Kit version, then execute and verify the
      repository's approved release workflow or publication path. Evidence: npm registry `latest`
      resolves to `0.51.0`, the packed registry artifact exports menu API 8 and `runConfirmation()`,
      and GitHub release `@narumitw/pi-tui-kit@0.51.0` was published on 2026-08-07.
- [x] After the release is visible on npm, migrate Image Drop in a separate bounded change, raise only
      its reviewed Kit floor, preserve link-rotation Confirm/Back/Close/stale behavior, add its own
      changeset, and verify focused tests, pack contents, Pi runtime smoke, and `npm run check`.
      Evidence: Image Drop now requires Kit `^0.51.0`, deleted its local confirmation component, and
      passes current session ownership to `runConfirmation()` while retaining link mutation locally;
      45 focused menu/lifecycle tests, the package check, 25-file dry-run package, isolated Pi load,
      Changesets status, and the 2,492-test repository gate passed.
- [x] After the release is visible on npm, migrate Analytics in a separate bounded change, raise only
      its reviewed Kit floor, preserve side-effect-free Back and committed-clear behavior while making
      TUI Ctrl+C close the dashboard, add its own changeset, and verify TUI/RPC/stale/error tests, pack
      contents, Pi runtime smoke, and `npm run check`. Evidence: Analytics now requires Kit `^0.51.0`
      and dynamically injects `runConfirmation()` into its dashboard; 14 focused menu tests cover
      TUI/RPC, Back, Close, stale ownership, error, committed-clear cancellation, and replacement,
      while the package check, 14-file dry-run package, isolated Pi load, and Changesets status passed.
- [x] Re-run the two-consumer behavior matrix, mark the roadmap milestone complete with publication
      and migration evidence, run the final repository gate, and archive this fully checked plan.
      Evidence: 59 combined Image Drop/Analytics focused tests and all 2,495 repository tests passed;
      the roadmap records both migrations and the completed standalone-confirmation milestone.

## Completion Checklist

- [x] The published root API exposes one documented standalone confirmation contract with no private
      Pi imports or consumer domain payloads. Evidence: the `0.51.0` registry artifact exports
      `runConfirmation()` and its built confirmation module through menu API 8.
- [x] Maintained tests prove Confirmed, Back, Close, Stale, Unsupported, and Error, including TUI/RPC
      limitations, pre-abort, owner abort, external disposal, and stale-error suppression.
- [x] Image Drop and Analytics consume the published API through independently reviewable migrations
      without capability, persistence, cancellation, or non-TUI regressions. Evidence: each package
      raises only its own Kit floor and has a separate patch Changeset and focused proof coverage.
- [x] Package dry runs, runtime smokes, the benchmark, and `npm run check` pass for the final state.
      Evidence: source-complete Kit benchmark evidence remains recorded above; both consumer package
      checks, dry runs, isolated Pi loads, the 59-test matrix, and the 2,495-test root gate passed.
- [x] The roadmap records stable release/adoption evidence and this plan is archived only after every
      item above is complete.
