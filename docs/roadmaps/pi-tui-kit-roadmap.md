# Pi TUI Kit Roadmap

- **Status:** Source API 9 live-choice capability is complete and verified; publication and
  post-publication consumer migrations remain gated
- **Audience:** Pi TUI Kit maintainers and extension authors
- **Planning horizon:** The reviewed Pi 0.84.1 capability baseline; no delivery dates are committed
- **Repository source:** API version 9 adds standalone live choice, generic interaction hints, and
  shared choice selection behavior to the API-8 confirmation, browse, custom-interaction, adaptive
  review, distinct Back/Close, disabled-action, and `/testing` foundations
- **Published status:** API 8 is published; API 9 must publish independently before any consumer
  raises its compatibility floor
- **Migration evidence:** Maintained package/consumer tests and the stable PR references in the
  decision log below

## Vision

`@narumitw/pi-tui-kit` gives Pi extensions a small, dependable set of declarative interaction
patterns that feel native to Pi without depending on Pi's private UI implementation. Extensions
spend their effort on domain state, persistence, safety, and product language instead of rebuilding
cross-mode presentation, navigation, rendering safety, cancellation, disposal, and stale-session
handling.

## Objectives

- Preserve the reason a menu session terminates so callers can distinguish root Back from whole-flow
  Close without extension-local sentinels.
- Make bounded review screens adapt safely to terminal height while retaining deterministic RPC
  pagination and fixed-size compatibility.
- Make disabled action rows understandable and width-safe across TUI and RPC without changing raw
  identity, navigation, or the guarantee that disabled actions never execute.
- Publish a supported consumer test host that exercises real TUI and RPC adapters, then remove the
  equivalent generic orchestration added to repository-level test support by the first adopters.
- Admit new public flows only when compatible consumer evidence proves reusable interaction and
  lifecycle policy; keep domain state, validation, persistence, and transactional recovery local.
- Improve runtime change locality only where a behavior matrix proves one shared interaction driver
  can replace duplicated mode-specific action and lifecycle coordination.
- Keep read-only catalog presentation separate from extension-owned data freshness, status meaning,
  and domain actions.
- Centralize custom-component cancellation, disposal, stale-owner classification, and pending-work
  draining without absorbing the specialized component or its domain result.
- Provide a bounded live-choice lifecycle shell when cursor selection is the reusable interaction,
  while keeping preview snapshots, rollback, persistence, and final apply policy consumer-owned.
- Keep injected-key hint formatting and stable-ID selection behavior consistent without making
  declarative choice screens side-effecting.
- Keep package source imports from Pi private `dist/*` paths at zero through every roadmap phase.

## Current State

The maintained package exposes eight declarative screen kinds: `actions`, `detail`, `browse`,
`choice`, `settings`, `input`, `review`, and `multiSelect`. Source API 9 also exposes:

- `runTask()` for abort-aware work with a TUI loader;
- `runConfirmation()` for distinct Confirmed, Back, Close, Stale, Unsupported, and Error outcomes;
- `runLiveChoice()` for initial and cursor preview callbacks, typed selection/shortcut/exit outcomes,
  lifecycle draining, and deterministic ordinary RPC selection;
- `formatInteractionHints()` for sanitized injected bindings and literal shortcuts;
- `runCustomInteraction()` for lifecycle ownership around one extension-owned specialized
  component; and
- a supported `/testing` subpath for semantic TUI driving and strict RPC scripts.

Published API 8 includes distinct root Back/Close results, adaptive review, read-only browse,
custom-interaction lifecycle handling, standalone confirmation, and explanatory disabled action
rows. Source API 9 adds live choice and hint formatting without changing declarative `choice`
cursor semantics. The internal interaction driver owns shared semantic action coordination once for
both modes while adapters retain TUI component and RPC dialog cadence.

Representative migrations prove the shipped boundaries: Usage uses `runTask()`; Stamp uses
validated input; Image Drop composes input, review, and confirmation; Starship uses read-only browse;
Pi Sync uses custom-interaction lifecycle ownership; and Analytics uses confirmation. These consumers
retain domain state, validation, persistence, rollback, and session ownership. The supported testing
subpath is proven through Stamp and Image Drop.

Deferred multi-select qualification admitted no Kit transaction API because Pi Sync and Subagents do
not share Save/Discard cadence, review, persistence, conflict recovery, or RPC behavior. The direct
dialog inventory likewise admitted no new API: one-off values use Pi primitives, setup and
authentication sequences remain domain transactions, boolean confirmation stays direct unless richer
outcomes are required, and multi-line editing remains extension-owned.

The original Pi 0.84.1 review found no additional Kit capability to admit or shipped screen to
retire. Subsequent Starship preset work converged with Statusline's palette picker on a bounded live
choice contract: initial/cursor preview, Enter confirmation, Back/Close distinction, owner
cancellation, and consumer-owned snapshot restoration. Optional shortcut dispatch covers Starship's
customize route without absorbing its save/apply transaction. Action-bearing async catalogs,
reorderable lists, forms, and editors remain unqualified. Public `Input`, `SelectList`,
`SettingsList`, and `ScrollView` remain useful low-level building blocks but do not own the Kit's
cross-mode, cancellation, navigation, rollback, or stale-owner policy.

Production and experimental consumers continue to use the Kit alongside direct Pi dialogs. Raw
consumer and dialog counts are intentionally not pinned because they change independently of roadmap
outcomes; the stable admission rule is compatible lifecycle evidence, not call volume.

## Guiding Principles

- **Public Pi APIs only:** use root-exported Pi primitives whose domain contract fits; never deep-import
  private implementation paths or copy a private component wholesale.
- **Reusable policy, local domain ownership:** the kit owns cross-mode interaction, rendering safety,
  navigation, cancellation, disposal, and stale checks. Extensions own domain drafts, validation,
  authorization, persistence, rollback, wording, and session ownership.
- **Evidence before abstraction:** require two compatible consumers by default. Record explicit
  contrary evidence or a finite no-go rather than widening an API speculatively.
- **Preserve capability:** migrations retain preview, persistence, validation, failure recovery,
  editor state, safety, and non-TUI behavior even when that requires keeping a specialized flow.
- **Explicit terminal outcomes:** Back, Close, Stale, Unsupported, and Error are lifecycle semantics,
  not presentation details to infer from labels or mutable flags.
- **Mode-specific presentation, shared lifecycle:** TUI and RPC may use different cadence, but action
  acceptance, transitions, signal composition, stale checks, and error routing follow one contract.
- **Safe display boundary:** sanitize rendered labels, metadata, values, key hints, pasted text, and
  errors while preserving raw identities only in non-rendered action payloads.
- **Bounded rollout:** one lifecycle or capability contract per PR; package work, proof migration, and
  unrelated dependency changes remain independently revertible.

## Roadmap Themes

### Explicit Interaction Semantics

Preserve lifecycle outcomes the navigator and adapters already know so extensions can compose nested
flows without losing Back-versus-Close intent.

### Host-Adaptive, Cross-Mode Experience

Use live TUI dimensions for bounded rendering while preserving deterministic RPC behavior and
unsupported-mode boundaries.

### Verifiable Consumer Adoption

Make real component and adapter behavior straightforward to test from consuming packages rather than
requiring each extension to rebuild a TUI/RPC host.

### Evidence-Controlled Expansion

Qualify standalone interactions and future screen patterns against compatible consumers. Keep
wizards, editors, action-bearing catalogs, and preview workflows specialized until their lifecycle
contracts converge; use live choice only for the now-proven bounded cursor-selection contract.

### Runtime Locality Without Speculative Layers

Concentrate action and lifecycle policy only when doing so deletes duplicated coordination. Avoid a
pass-through driver that merely renames the same TUI and RPC branches.

## Phases and Milestones

### Phase 1: Proven Declarative Foundation

**Status:** Complete.

**Milestones:**

- [x] Static choice and searchable multi-select shipped through focused proof migrations after an
  evidence-based capability qualification.
- [x] Input, bounded review, and `runTask()` shipped in menu API version 3 through representative
  consumer flows.
- [x] Usage, Stamp, and Image Drop completed behavior-preserving consumer migrations.
- [x] The BTW review gate recorded exact missing seams instead of weakening its specialized behavior.
- [x] Package checks, deterministic TUI/RPC smokes, dry-run packages, and repository gates passed for
  the shipped capabilities and migrations.

**Outcome:** The kit has a verified cross-mode foundation and concrete adoption evidence from which
the next lifecycle contracts can be prioritized.

### Phase 2: Distinct Menu Session Outcomes

**Status:** Complete.

**Milestones:**

- [x] `RunMenuResult` exposes a runtime-owned reason that distinguishes root Back from explicit Close
  without carrying domain-specific completion payloads.
- [x] Root Back, nested Back, Ctrl+C, close items, action Close, custom-UI disposal, RPC cancellation,
  owner abort, unsupported mode, and failure have characterized terminal outcomes.
- [x] Nested Back remains an in-menu transition and never reports a terminal result.
- [x] An explicit menu API-version and compatibility decision covers exact result-object changes and
  consumer migration requirements.

**Outcome:** Menu and standalone flows can share a precise cancellation vocabulary, unlocking safe
three-way confirmation and preview composition.

### Phase 3: Adaptive Review and Supported Testability

**Status:** Complete. Adaptive review, the supported testing entrypoint, and named Stamp/Image Drop
test-host adoption are published; the subsequent BTW gate and focused migration also passed.

**Milestones:**

- [x] Review accepts an opt-in terminal-adaptive viewport policy while existing fixed numeric sizing
  and RPC pagination remain compatible.
- [x] Adaptive review stays within terminal row budgets at constrained, typical, and large heights,
  including wrapped headers, position indicators, resize, and scroll-offset clamping.
- [x] A separate `@narumitw/pi-tui-kit/testing` entry point drives real TUI components and RPC dialogs
  through focus, text input, key events, rejected retries, pending actions, disposal, and owner abort.
- [x] Stamp and Image Drop representative menu/input tests use the supported test host. Their direct
  ad hoc Kit drivers are gone; repository-level `test/support.ts` remains for explicitly inventoried
  Kit, specialized-component, experimental, and deprecated test owners rather than being deleted
  prematurely.
- [x] The BTW review gate passed against published API 5. Kit choice and adaptive-review flows preserve
  raw identity, initial/restored selection, root Back versus Ctrl+C Close, exact draft content,
  constrained/expanded resize, editor changes observed at completion, and finite host disposal.
  `BtwTextRangeSelector` remains specialized for exact character and line selection.

**Outcome:** Review behavior adapts to its host and consumer packages can verify kit lifecycle
contracts without private component knowledge.

### Phase 4: Qualified Shared Flows and Runtime Locality

**Status:** Complete. The internal interaction driver, read-only browse, custom-interaction
lifecycle helper, standalone confirmation, and explanatory disabled action presentation are published
through API 8. Image Drop and Analytics completed confirmation proof migrations. Deferred
multi-select completed its qualification as a bounded no-go for a new Kit transaction API.

**Milestones:**

- [x] A complete seven-screen TUI/RPC behavior matrix admitted the internal semantic interaction
  driver. One coordinator now owns action lookup/invocation, intent mismatch and disabled rejection,
  transitions, composed action signals, stale checks, and error routing while adapters retain TUI
  component and RPC dialog cadence.
- [x] Menu API version 6 admits read-only browse with searchable TUI presentation, deterministic RPC
  list/detail adaptation, textual status, bounds, sanitization, IME focus, and selection restoration;
  extensions retain catalog data, status meaning, freshness, and every domain action.
- [x] `runCustomInteraction()` owns composed cancellation, stale-owner classification, exactly-once
  disposal, and optional pending-work draining around specialized public custom components without
  absorbing their Back/Close values or side effects.
- [x] Pi Starship and Pi Sync completed bounded API-v6 adoption: Modules uses browse, custom Sync UI
  uses the lifecycle helper, and both retain their prior domain, settings, cancellation, and non-TUI
  contracts.
- [x] Published API 8 adds explanatory disabled action rows to top-level actions and multi-select
  actions. Sanitized reasons, adaptive ellipsis-safe labels, inert activation, raw identity, and
  legacy reason-less RPC labels are covered across TUI and RPC.
- [x] Standalone confirmation proves Confirmed, Back, Close, Stale, Unsupported, and Error through
  Image Drop and Analytics. Both consumers raised only their published Kit floor, retained domain
  side effects, and passed focused TUI/RPC/lifecycle tests, package checks, dry-run packaging,
  isolated Pi loads, and the repository gate.
- [x] Deferred or batched multi-select remains extension-owned after Pi Sync and Subagents failed the
  common-transaction gate. They share Kit toggle, rejection rollback, action-row, cancellation,
  disposal, and stale-owner mechanics, but not Save/Discard cadence, review and confirmation policy,
  persistence, conflict recovery, or interactive RPC support.
- [x] Immediate-save multi-select behavior remains unchanged for Chrome DevTools, Firecrawl,
  Google GenAI, and Plan mode. Focused maintained tests verified each accepted toggle still persists
  immediately, and qualification introduced no selector source changes.

**Outcome:** Repeated lifecycle and read-only disclosure policy moves behind bounded public or
internal seams without absorbing consumer transactions or creating a universal UI framework.

### Phase 5: Evidence-Based Evolution

**Status:** Complete against the Pi 0.84.1 public surface and current maintained consumer evidence.
Reassess after a Pi dependency upgrade or when two consumers demonstrate a compatible missing
contract.

**Milestones:**

- [x] Remaining direct dialogs were reclassified into one-off bounded choices/values, domain
  setup/auth sequences, boolean domain confirmations, and multi-line editors. Call volume admitted no
  new API; each class retains its existing owner or uses the published confirmation helper when richer
  outcomes are required.
- [x] Action-bearing and live async catalogs remain specialized: Recall's scoped searchable actions
  and File Context's asynchronous file/revision/diff workflow do not share an interaction or
  transaction contract. No compatible tree workflow was found.
- [x] At the Phase-5 review gate, live previews and reorderable lists remained specialized because
  Statusline's palette picker and Starship's then-current transaction had not yet converged. Later
  Starship preset evidence supersedes only the bounded live-choice part of this decision in Phase 6;
  reorder and transaction policy remain extension-owned.
- [x] Multi-line editor remains deferred after the latest Pi 0.84.1 review confirmed that
  `ctx.ui.editor()` still has no `AbortSignal`; reconsider only when Pi exposes an abort-aware
  cross-mode editor contract.
- [x] Shipped screens were reviewed against Pi 0.84.1 public exports. `Input`, `SelectList`,
  `SettingsList`, and `ScrollView` remain lower-level building blocks rather than equivalent
  cross-mode composites, so no screen was retired.

**Outcome:** The kit continues to grow only where evidence supports durable leverage and removes local
abstractions when Pi provides a better stable owner.

### Phase 6: Bounded Live Choice

**Status:** Source complete and verified as API 9; publication and consumer adoption remain gated.

**Milestones:**

- [x] Statusline palette selection and Starship preset selection demonstrate a compatible bounded
  contract: initial and cursor preview, injected navigation, Enter confirmation, Back/Close,
  stale-owner protection, and consumer-owned restoration and persistence.
- [x] Source API 9 exposes `runLiveChoice()` with current/disabled rows, optional shortcuts, synchronous
  preview immediacy, latest-selection coalescing for pending async previews, cancellation/disposal
  draining, typed terminal outcomes, and ordinary signal-aware RPC selection without preview effects.
- [x] One internal stable-ID selection controller owns wrap, paging, Home/End, and empty-list behavior
  for declarative and live choices without making declarative cursor movement side-effecting.
- [x] `formatInteractionHints()` owns injected-binding lookup, aliases, control sanitization,
  exclusions, de-duplication, literal shortcuts, and separator policy; existing Kit menu and browse
  hints consume it.
- [x] API-root type tests, TUI/RPC/lifecycle coverage, the repository gate, and dry-run package
  inspection verify the source contract and Kit-only release intent.
- [ ] Publish API 9 through the independent Changesets release before raising a consumer's Kit floor.
- [ ] After publication, migrate Statusline and Starship in independently reviewable consumer changes
  that remove local selection/hint loops while preserving preview snapshots, rollback, settings,
  confirmation, collectors, and session-generation ownership.

**Outcome:** The source contract concentrates reusable cursor-selection and lifecycle policy. Once
published and proven by both consumers, live preview pickers can delete duplicate interaction code
without turning the Kit into a preview-state or transaction owner.

## Technical Health

- Keep TypeScript strict, NodeNext-compatible, and built as published JavaScript plus declarations.
- Keep Pi private `dist/*` imports at zero and package-root consumer imports as the supported boundary.
- Keep production JavaScript imports from `@earendil-works/pi-coding-agent` at zero; use it only for
  erased public types, compose runtime UI from public `pi-tui` primitives and callback-owned theme and
  keybindings, and verify cold import plus first interaction with the serial runtime benchmark.
- Keep the demonstrated runtime/interaction ownership boundary: adapters own presentation cadence
  and the interaction driver owns semantic action coordination. Recombine or split only when a new
  behavior matrix proves better locality and deletes coordination.
- Maintain deterministic model, component, runtime, package-root usage, and README tests for every
  public contract.
- Maintain a TUI/RPC behavior matrix across all declarative screens and standalone live choice
  covering success, rejection, user cancellation, component disposal, owner abort, `isCurrent()`
  failure, callback/action failure, session replacement, and shutdown.
- Keep terminal sanitization and cell-aware width checks at the final display boundary while passing
  raw IDs and values separately.
- Revalidate mutable state after every await before publishing UI or in-memory state.
- For each public package change, run the package check, root `npm run check`, deterministic runtime
  smokes, and `just pack tui-kit`; inspect all exported production and testing entry points.

## Risks and Dependencies

- **Result compatibility:** adding a close reason changes exact result objects even when most callers
  only inspect `kind`. Mitigation: characterize callers, make an explicit API-version decision, and
  provide focused migration evidence.
- **Terminal-height calculation:** wrapped headers and scroll-position lines can make row budgeting
  circular. Mitigation: keep fixed sizing compatible, make adaptive sizing opt-in, and test complete
  rendered-frame height at multiple widths and terminal sizes.
- **Testing API coupling:** a public harness could accidentally expose Pi or component internals.
  Mitigation: expose semantic driving and stable render snapshots through a separate testing entry
  point, not raw private instances.
- **RPC flattening:** Pi dialogs cannot express every TUI distinction or cadence. Mitigation: define
  deterministic RPC outcomes independently and do not claim parity Pi cannot expose.
- **Editor lifecycle:** Pi's RPC editor lacks `AbortSignal` support, and BTW retains a narrow wrapper
  that captures live editor text at standard-menu completion, restores only a current completed flow,
  and avoids writes after host disposal. Exact text selection remains extension-owned.
- **Internal-refactor breadth:** a semantic driver can become a shallow extra layer. Mitigation: require
  a before/after deletion test and keep the refactor independently revertible.
- **API sprawl:** direct-dialog counts can encourage speculative wrappers. Mitigation: retain the
  evidence gate and domain ownership boundary.
- **Consumer capability loss:** a standard flow may erase preview, rollback, selection restoration, or
  three-way cancellation. Mitigation: compare behavioral contracts before migration and preserve
  specialized flows on a no-go result.
- **Preview continuation races:** a slow preview may finish after a newer cursor, owner replacement, or
  exit. Mitigation: keep one drained latest-selection queue, abort through the interaction signal,
  revalidate generation after awaits, and require consumers to honor the callback signal.
- **Premature consumer adoption:** source API 9 is not yet a published compatibility floor.
  Mitigation: publish the Kit-only Changeset first, then migrate consumers in later PRs.

## Success Metrics

| Indicator | Baseline | Target | Horizon and source |
| --- | --- | --- | --- |
| Pi private `dist/*` imports in kit source | 0 | Remain 0 | Every phase; boundary check and source search |
| Ordinary `runMenu()` close outcomes visible to callers | Published API 3 collapsed Back and Close | Published API 5 distinguishes root Back and explicit Close | Phase 2 published; runtime TUI/RPC matrix |
| Review TUI viewport policy | Published API 3 was fixed, default 14 rows | Published API 5 provides opt-in adaptive sizing within the live terminal budget | Adaptive milestone published; review component and registry-package smokes |
| Reusable consumer input-host logic | Generic behavior added to repository `test/support.ts` | Supported `/testing` source plus Stamp and Image Drop adoption are complete; retained root owners are inventoried | Phase 3; package and consumer diffs/tests |
| Proof for each new public flow | Two compatible consumers by default; exceptions require recorded evidence | Two completed proof migrations or an explicit no-go/deferral | Every expansion phase; maintained tests and stable PRs |
| Lifecycle verification | Existing deterministic package and consumer coverage | Every admitted contract covers TUI/RPC, cancellation, disposal, owner abort, stale state, and failure | Every phase; package and repository gates |
| Runtime action/lifecycle ownership | TUI and RPC formerly coordinated screen actions in separate branches | One internal driver now owns shared semantic action policy; adapters retain presentation lifecycle | Phase 4 source-complete; maintained all-screen matrix plus source diff |
| Read-only catalog disclosure | Searchable catalogs were specialized | Menu API 6 browse owns bounded cross-mode list/detail presentation without domain actions | Phase 4 published; package matrix and Pi Starship adoption |
| Specialized custom lifecycle | Consumers repeated cancellation, disposal, stale-owner, and draining logic | `runCustomInteraction()` owns the shared lifecycle shell while components and domain results remain local | Phase 4 published; package tests and Pi Sync adoption |
| Standalone confirmation | Image Drop locally distinguished confirm, Back, and Close; boolean dialogs collapsed cancellation intent | Published API 8 includes the API-7 confirmation contract preserving Confirmed, Back, Close, Stale, Unsupported, and Error without owning side effects | Phase 4 published and proven through Image Drop and Analytics |
| Deferred multi-select transaction ownership | Pi Sync and Subagents both used Kit multi-select with extension-local drafts | Keep transactions extension-owned unless consumers converge on Save/Discard cadence, review, persistence, conflict recovery, and interactive RPC semantics | Phase 4 qualification complete; maintained Kit and consumer tests plus source/README contract review |
| Direct-dialog admission pressure | Remaining calls mixed one-off prompts, domain transactions, boolean confirmations, and editors | Admit APIs from compatible lifecycle evidence, never raw call volume; reuse published confirmation only where richer outcomes are required | Phase 5 inventory complete; active-source recount, owner classification, and repository gate |
| Specialized interaction pressure | Action-bearing and async catalogs, reorderable lists, forms, editors, and preview workflows beyond bounded choice have incompatible or single-consumer contracts | Keep each specialized until two consumers prove compatible reusable policy | Phase 5 baseline plus Phase 6 bounded-live-choice exception; re-open on new evidence |
| Public Pi replacement pressure | Pi 0.84.1 exposes useful low-level TUI primitives but no equivalent Kit cross-mode composite | Retire a Kit screen when a stable public Pi owner provides the complete contract | Phase 5 review complete; re-run after Pi dependency upgrades |
| Disabled action presentation | Disabled action rows could hide their state or truncate labels ambiguously | Published API 8 presents sanitized reasons and ellipsis-safe labels across TUI/RPC while keeping actions inert and raw identities stable | Phase 4 published; registry package, maintained component/runtime tests, and archived implementation plan |
| Bounded live-choice ownership | Statusline and Starship repeated cursor navigation, preview dispatch, key hints, and exit handling | Source API 9 owns selection and lifecycle mechanics while consumers retain preview state, rollback, persistence, and final apply | Phase 6 source-complete; Kit TUI/RPC/lifecycle tests, repository gate, package dry run, and post-publication proof migrations |
| Interaction-hint consistency | Kit and specialized pickers repeated binding lookup, aliases, exclusions, and sanitization | Source API 9 exposes one formatter and uses it for Kit menu, browse, and live-choice hints | Phase 6 source-complete; formatter and rendering tests |
| Regression gate | Repository CI-equivalent gate at each capability change | No regression in the repository CI-equivalent gate | Every phase; `npm run check` |

Delivery dates and capacity targets are unknown; this roadmap intentionally measures verified behavior
and adoption rather than calendar output.

## Non-Goals

- Becoming a general application framework, settings store, transaction coordinator, or domain state
  container.
- Adding arbitrary domain payloads to menu termination results.
- Reproducing Pi's model, session, trust, tree, authentication, provider, or editor domain logic.
- Copying public controls that extensions can import directly or wrapping them without shared policy.
- Exposing Pi TUI component instances through declarative production or testing APIs.
- Adding a general wizard or form merely to reduce Stamp or Image Drop screen definitions; their
  validation and publication semantics differ.
- Adding a multi-line editor while Pi lacks an abort-aware RPC editor contract.
- Building an action-bearing catalog, tree, transcript, general preview-state framework, or reorder
  framework; bounded live choice does not own preview state or transactions.
- Reducing direct dialog counts as an end in itself.
- Committing to delivery dates, speculative package versions, or implementation scope without a
  focused approved plan.

## Decisions and Changes

| Date | Decision or change | Rationale and impact |
| --- | --- | --- |
| 2026-07-30 | Store the canonical roadmap under `docs/roadmaps/`. | Roadmaps describe strategic direction; executable feature plans remain under `docs/plans/`. |
| 2026-07-30 | Reuse root-exported Pi composites only when their domain contract fits; use non-exported composites only as interaction references. | Deep implementation paths are not compatibility contracts, while public exports should not be copied. |
| 2026-07-30 | Require two compatible consumers before adding a screen by default. | Prevents one-off hooks and unsupported abstraction growth. |
| 2026-07-30 | Deliver static choice through Statusline information profiles and Worktree selection. | Both need confirmed static selection with raw identity and no cursor-movement side effect. |
| 2026-07-30 | Keep async catalogs, trees, login flows, and live previews deferred. | These patterns require stronger shared evidence or remain domain-specific. |
| 2026-07-30 | Admit optional searchable multi-select through Plan mode and Subagents while keeping API version 2. | Both share stable tool IDs and filtering while retaining different persistence ownership. |
| 2026-07-30 | Defer searchable catalog. | Jupyter remains specialized and no second bounded static catalog workflow was proven. |
| 2026-07-30 | Defer contextual decision. | Image Drop initially had no second compatible consumer, while Starship preview and public confirmations required different contracts. |
| 2026-07-31 | Ship `runTask()`, declarative input, and bounded review in menu API version 3 through PR #478. | Repeated lifecycle and mode-adaptation policy justified public flows; editor remained deferred because Pi lacks abort-aware RPC support. |
| 2026-07-31 | Complete Usage, Stamp, and Image Drop proof migrations through PRs #479, #481, and #482. | The migrations verified reusable lifecycle ownership while leaving domain validation, persistence, and session state with consumers. |
| 2026-07-31 | Record BTW review as no-go. | Root Back and Ctrl+C Close collapse to one result, and fixed review sizing cannot preserve terminal-row behavior. |
| 2026-08-01 | Prioritize menu termination reasons, adaptive review, and a supported consumer test host. | These are the highest-confidence gaps demonstrated by real migrations and unblock stronger composition without adding speculative screen kinds. |
| 2026-08-01 | Move the internal interaction driver, standalone confirmation, and deferred multi-select behind the near-term lifecycle work. | Behavior matrices and explicit terminal outcomes should precede broad runtime refactoring or new public flows. |
| 2026-08-01 | Merge the next-architecture implementation note into this canonical roadmap. | Maintaining one Pi TUI Kit roadmap avoids conflicting priorities while preserving the migration evidence and prior decision history. |
| 2026-08-01 | Implement mandatory `RunMenuResult.closed.reason` and raise repository menu API to version 4. | The navigator already owns root Back versus Close; exposing that reason removes a proven composition blocker while leaving domain completion values local. Publication remains a separate workflow. |
| 2026-08-01 | Implement opt-in adaptive review and raise repository menu API to version 5. | Live public TUI rows now bound complete review frames while fixed/default TUI output and deterministic RPC pages remain unchanged; the testing entry point, BTW gate/migration, and package release remain separate work. |
| 2026-08-01 | Add the supported `@narumitw/pi-tui-kit/testing` subpath without changing production exports or menu API version. | Semantic TUI driving and strict input/select RPC scripts concentrate demonstrated test-host policy without exposing components or absorbing consumer context/domain mocks; adoption and release remain separate. |
| 2026-08-01 | Adopt the supported testing subpath in Stamp and Image Drop before publication. | Two real consumers now prove sequential TUI screens, rejected input, pending drains, strict RPC where supported, loader cancellation, and three-way confirmation; broad root support remains only for its other inventoried owners. |
| 2026-08-01 | Publish menu API 5 and the supported testing subpath. | The pinned-npm provenance workflow and repository gate passed; a clean registry fixture resolved Kit roots, adaptive review, exact close results, and strict NodeNext declarations. |
| 2026-08-01 | Admit BTW's standard choices and preview to Kit after the post-publication gate. | Supported-harness and real-Pi smokes preserve editor text, selected question/scope, Back/Close, raw choice identity, adaptive resize, and exact preview content while `BtwTextRangeSelector` remains local. |
| 2026-08-01 | Admit the internal semantic interaction driver after the Phase 4 deletion gate. | A seven-screen TUI/RPC matrix proves compatible raw payloads, transitions, errors, cancellation, disposal, and stale ownership; one internal owner replaces mode-specific action resolution without changing exports or API version 5. |
| 2026-08-02 | Publish menu API 6 with read-only browse, injected static-list keybindings, and `runCustomInteraction()` through PR #520. | Bounded list/detail disclosure and specialized-component lifecycle policy became reusable while catalog data, domain actions, Back/Close values, and side effects stayed consumer-owned. |
| 2026-08-02 | Adopt API-v6 capabilities in Pi Starship and Pi Sync through PR #522. | Starship Modules now uses browse and Sync custom UI uses the lifecycle helper; both consumers raised only their own compatibility floors and retained domain, settings, cancellation, and non-TUI policy. |
| 2026-08-08 | Implement source menu API 7 with standalone confirmation; keep publication and proof migrations gated. | Image Drop and Analytics demonstrate compatible Confirm/Back/Close needs. TUI reuses the standard actions renderer and custom-interaction lifecycle shell; RPC cancellation maps deterministically to Back because Pi exposes no separate RPC Ctrl+C dialog result. |
| 2026-08-08 | Advance repository source to menu API 8 with explanatory disabled action rows. | Top-level and multi-select actions now share sanitized disabled reasons, adaptive ellipsis-safe TUI labels, deterministic RPC presentation, and inert activation without changing raw identity or legacy reason-less RPC labels. Publication and consumer floor changes remain separate gates. |
| 2026-08-08 | Publish menu API 8 through the registry release tagged `@narumitw/pi-tui-kit@0.51.0`. | The registry package and GitHub release expose `runConfirmation()`, the API-8 literal, and disabled action presentation; consumer proof migrations remain independently reviewable follow-ups. |
| 2026-08-08 | Migrate Image Drop link rotation to the published standalone confirmation contract. | Image Drop raised only its Kit floor, removed its local confirmation component, passed session ownership into the helper, and retained link invalidation and startup error policy locally; focused tests, package checks, dry-run packaging, isolated Pi load, and the repository gate passed. |
| 2026-08-08 | Complete standalone-confirmation proof through Analytics. | Analytics raised only its Kit floor, retained deletion and committed-clear policy, made TUI Ctrl+C close the dashboard, and proved TUI/RPC Back, Close, stale, error, replacement, and cleanup-warning behavior; focused tests, package checks, dry-run packaging, isolated Pi load, and the repository gate passed. |
| 2026-08-08 | Close deferred multi-select qualification without a new Kit transaction API. | Pi Sync requires a separate exact review, optional privacy acknowledgement, conflict-checked atomic publication, and read-only RPC; Subagents uses pinned in-screen Save/Discard, unavailable-tool preservation, synchronous settings publication, and RPC status. Existing Kit mechanics are reusable, but the transaction contracts do not converge. Immediate-save Chrome DevTools, Firecrawl, Google GenAI, and Plan-mode selectors remained unchanged and passed focused verification. |
| 2026-08-08 | Classify remaining direct dialogs without admitting a new API. | One-off choices and values fit Pi's direct primitives; setup/auth sequences retain extension-owned drafts, secrets, validation, and publication; boolean confirmations use direct dialogs when all dismissals mean no and can adopt published `runConfirmation()` when richer outcomes are proven; multi-line editors remain deferred pending abort-aware RPC support. Raw call volume is not an admission criterion. |
| 2026-08-08 | Complete Phase 5 capability and public-export review against Pi 0.84.1 without admitting or retiring an API. | Recall, File Context, Statusline, and Starship then demonstrated incompatible specialized catalog, preview, reorder, and transaction contracts; no maintained tree pair exists; Pi's editor remains non-abort-aware; and its public TUI controls remain lower-level than the Kit's cross-mode lifecycle contracts. Reassess after a Pi dependency upgrade or two compatible consumers provide new evidence. |
| 2026-08-08 | Admit source API 9 bounded live choice after Starship preset selection converged with Statusline palette selection. | `runLiveChoice()` owns injected navigation, typed exits, optional shortcuts, RPC downgrade, stale checks, coalescing, disposal, and draining; a shared internal controller and public hint formatter remove repeated interaction mechanics. Preview snapshots, rollback, persistence, confirmation, and final apply remain consumer-owned. Publication must precede separate proof migrations. |
