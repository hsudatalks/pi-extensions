# Pi TUI Kit Deferred Multi-Select Qualification Plan

## Goal

Close the Phase 4 deferred multi-select gate with maintained consumer evidence: either admit one
shared Kit-owned deferred transaction contract, or record a bounded no-go that keeps each draft and
persistence workflow extension-owned without changing immediate-save consumers.

## Context

Pi Sync and Subagents both render Kit `multiSelect` screens but own materially different transaction
flows. Pi Sync uses a TUI-only draft followed by a separate exact review, optional privacy
acknowledgement, and conflict-checked atomic publication; RPC is intentionally read-only. Subagents
keeps Save and Discard actions in the searchable tool screen, preserves unavailable configured tools,
and writes user settings only on Save; RPC intentionally reports status instead of opening the
manager. Existing Kit multi-select already owns cross-mode toggles, rejected optimistic rollback,
action rows, disposal, and stale-owner behavior.

Immediate-save selectors in Chrome DevTools, Firecrawl, deprecated Google GenAI, and Plan mode persist
each accepted toggle and must not be converted to deferred drafts as part of this qualification.

## Non-Goals

- Add a new public Kit screen, transaction coordinator, settings API, or menu API version.
- Expand Pi Sync or Subagents command-mode support.
- Change any consumer persistence, confirmation, conflict, rollback, or session-ownership policy.
- Change immediate-save selectors.

## Plan

- [x] Characterize Pi Sync and Subagents draft, Save, Discard/cancel, rejection, RPC, disposal, and
      session-replacement behavior from maintained source, READMEs, and focused tests; the roadmap
      records that their review, publication, recovery, and RPC contracts do not converge.
- [x] Verify existing Kit multi-select coverage owns only reusable interaction semantics—toggle
      dispatch, optimistic rejection rollback, action rows, RPC adaptation, cancellation, disposal,
      and stale ownership—without owning consumer drafts or publication; Kit runtime/component tests
      passed in the 194-test focused run.
- [x] Verify Pi Sync and Subagents focused tests pass for their current extension-owned workflows;
      both complete test files passed in the 194-test focused run.
- [x] Verify Chrome DevTools, Firecrawl, Google GenAI, and Plan mode retain immediate-save behavior;
      active consumer files passed in the 194-test focused run, all 31 deprecated Google GenAI tests
      passed through an isolated temporary compile, and the selector source diff was empty.
- [x] Update `docs/roadmaps/pi-tui-kit-roadmap.md` so Phase 4 and both deferred-flow milestones reflect
      the evidence-backed no-go without claiming a new Kit API.
- [x] Run `npm run check` and `git diff --check`; the 2,495-test repository gate passed, the diff
      check was clean, the touched-source private-import search was empty, and qualification-consumer
      package/source diffs were empty.

## Completion Checklist

- [x] The roadmap states that deferred multi-select remains extension-owned, with Pi Sync/Subagents
      rationale and explicit RPC boundaries.
- [x] Immediate-save consumers are explicitly unchanged and supported by focused verification.
- [x] No package manifest, production source, lockfile, or changeset was added for this docs-only
      qualification beyond the already-present standalone-confirmation work in the worktree.
- [x] Every plan item has evidence; archive this completed plan under `docs/plans/archived/`.
