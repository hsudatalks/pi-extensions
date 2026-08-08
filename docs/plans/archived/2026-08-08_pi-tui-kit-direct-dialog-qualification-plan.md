# Pi TUI Kit Direct Dialog Qualification Plan

## Goal

Complete the first Phase 5 evidence gate by recounting active extension calls to Pi's direct
`select`, `confirm`, `input`, and `editor` dialogs and classifying them by compatible lifecycle
contract rather than treating call volume as pressure for new Kit APIs.

## Context

The post-confirmation-migration source baseline contains 101 direct dialog call sites across 11
active extension packages: 36 `select`, 39 `confirm`, 17 `input`, and 9 `editor`. Pi Sync owns 48 of
those sites inside storage/setup/synchronization workflows; Pi Goal owns 18 inside goal and settings
workflows. The remaining sites are distributed across Accounts, Chat, Langfuse, Plan mode, Recall,
Starship, Statusline, Subagents, and Worktree.

This inventory is qualification evidence, not a durable metric target. The roadmap should record the
contract classes and admission decisions without pinning transient counts.

## Non-Goals

- Reduce direct dialog counts as an end in itself.
- Change extension behavior, command modes, settings, persistence, or package metadata.
- Add a new Kit screen or raise the menu API version.
- Migrate isolated prompts without two compatible consumers and a demonstrated lifecycle seam.
- Reconsider action-bearing catalogs, forms, or public Pi export replacement in this gate.

## Qualification Decision

| Contract class | Recounted owners | Decision and boundary |
| --- | --- | --- |
| Sequential domain setup and authentication | 49 sites: Accounts 3, Chat 3, Langfuse 3, Sync 36, Worktree 4 | Keep extension-owned. These flows coordinate partial drafts, secret handling, validation, remote state, exact previews, and publication. Consumers retain their signal/generation checks and revalidate mutable state after awaits. |
| One-off bounded choice or value | 4 sites: Goal 1, Plan mode 1, Recall 2 | Keep Pi direct primitives. Repository conventions already prefer `ctx.ui.select()` for a one-off small choice; these calls do not justify a menu/session abstraction. |
| Boolean domain confirmation | 39 sites: Accounts 2, Chat 3, Goal 11, Recall 1, Starship 1, Subagents 5, Sync 12, Worktree 4 | Keep direct where every dismissal intentionally means “do not proceed.” Use the already-published `runConfirmation()` only in a consumer-specific migration that needs distinct Back/Close, stale, unsupported, or error outcomes; no new API is needed. Side effects and current-state revalidation remain local. |
| Multi-line editor | 9 sites: Goal 6, Plan mode 1, Starship 1, Statusline 1 | Remain direct and deferred from Kit until Pi exposes an abort-aware cross-mode editor contract. Draft validation, preview, persistence, and rollback remain extension-owned. |

The four classes cover all 101 active-source sites exactly once. No compatible pair demonstrates a
missing Kit contract. Existing Kit choice, input, review, confirmation, task, and custom-interaction
contracts remain available for bounded consumer migrations when their stronger semantics are needed.

## Plan

- [x] Verify the exact active-source inventory and package/method distribution after the completed
      confirmation migrations; a literal active-source scan found 101 sites across 11 packages: 36
      `select`, 39 `confirm`, 17 `input`, and 9 `editor`.
- [x] Classify every owning workflow into one-off direct primitives, domain setup/auth sequences,
      boolean domain confirmations, or multi-line editors; the qualification table covers all 101
      sites exactly once and admits no new Kit candidate.
- [x] Audit cancellation, disposal, session replacement, shutdown, post-await ownership, RPC, and
      side-effect ownership for each contract class. Representative source confirms setup flows own
      signal/generation checks and publication, boolean callers own post-confirm revalidation,
      one-off choices use Pi's cross-mode primitive, and editor flows retain draft/persistence policy.
- [x] Update `docs/roadmaps/pi-tui-kit-roadmap.md` to check off the direct-dialog milestone and record
      the resulting admission/deferral decisions without preserving transient raw counts.
- [x] Run `npm run check`, `git diff --check`, and a source-diff audit; the 2,495-test repository gate
      passed, the diff check and Kit private-import search were clean, and every inventoried owner
      package had an empty qualification diff.

## Completion Checklist

- [x] Every direct dialog owner is represented by one lifecycle-contract class.
- [x] Future candidates name the missing evidence or existing public Kit contract; no speculative API
      was admitted from count alone.
- [x] The roadmap remains consistent with its evidence-before-abstraction and editor deferral
      principles.
- [x] No package manifest, production source, lockfile, or changeset was added for this docs-only gate
      beyond the already-present standalone-confirmation work in the worktree.
- [x] Every task has evidence; archive this completed plan under `docs/plans/archived/`.
