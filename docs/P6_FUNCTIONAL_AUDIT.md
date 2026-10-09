# P6 — Functional workflow audit and defect hardening

**Status (2026-10-09):** Scoped fixes committed for certification, not deployed. P6 is independent of open P1–P5 PRs. A code audit and simulated browser checks do not prove all physical-device flows are defect-free.

## Audit matrix

| Workflow | Inspected | Finding / disposition |
| --- | --- | --- |
| Today and reading-plan setup | TodayScreen, PlanSetup, PlanScreen, McheyneRepository, core-flow tests | Explicit completion, transaction-scoped activity and reversible reading progress already implemented; preserve |
| Scripture selection and reading | BibleScreen, reading hooks, search/collection tests | Explicit passage selection and return links; no automatic reading completion added |
| Daily reflection | ReflectionScreen, durable controller and writing guard | Existing private writing checkpoints, conflict and newer-input protection remain authoritative |
| Reflection to prayer handoff | PrayerHandoffScreen, NewPrayerScreen, source validation | Save-once creation protects against duplicate prayers; retain explicit source review |
| Prayer editing and lifecycle | PrayerDetailScreen, usePrayerDraftGuard, PrayerRepository | **Defect fixed:** Prayed now bypassed the unsaved editor confirmation. Now prompts Keep editing, Save and continue (when permitted), or Discard and continue, and uses latest committed revision |
| Lifecycle cleanup after commit | PrayerDetailScreen | **Defect fixed:** an archived/waiting action could be committed but private draft cleanup could fail and suggest a failed status change. Now states the action was recorded and tells users not to retry it |
| Prayer sessions and answers | PrayerSessionScreen, existing session tests | Existing locked action handling and recorded-answer protection retained; needs physical interrupted-session verification |
| Optional Remember | RememberChoices and History | Local, opt-in reminders/anniversaries preserved; unavailable preferences handled |
| Back navigation | Prayer detail parser and JournalHeading | **Defect fixed:** arbitrary unknown and self-referential return URLs were accepted. Now restrict to internal routes and reject a Back link to the same prayer |
| Portability/offline recovery | V1 archive and recovery draft code; P5 branch | Intentionally excluded from P6 mutation; separate P1/P5 certification still required |

## New test evidence

- Prayer-detail unit tests: reject unknown, malformed, encoded and self-referential return paths while preserving valid filtered History/Prayer paths.
- New prayer-action Playwright tests: Keep editing makes zero events; Save and continue records exactly one update and one prayed event; discard removes only unfinished writing; no-editor action remains one click.
- Existing core-flow, durable-writing, session, search, portability and repository tests stay mandatory at the exact PR SHA. Never lower CI thresholds or blindly rebaseline screenshots.

## Outstanding release risks

- P1–P5 PRs were still open at P6 start. The latest completed P5 certification failed during verify-phase9: its older test expects a three-argument backup export call whereas P5 adds an optional fourth argument. This is a separate P5 contract-fix task, not a successful P5 certificate.
- Passing P6 independently does not certify the later merged main commit.
- Physical Android keyboard, PWA offline/online, multi-tab revision conflicts, quota pressure, slow writes, accessibility, phone memory, power-interruption and disposable-profile schema-1-to-3 migration remain separate checks.
- No real user's journal, deployed build, DNS or release tag was changed.

## Acceptance

- [ ] P6 typecheck, unit, browser, screenshot and exact-artifact CI complete on final PR commit.
- [ ] Confirm correct activity counts after save/continue, discard/continue, rapid clicks, stale revisions and post-commit refresh failure.
- [ ] Complete device and older-journal migration qualification; resolve failures in P1–P5 independently.
- [ ] Re-certify the final integrated main and publish only with separately authorized P2 deployment.

**Next:** P7 — Accessibility & Performance Qualification: screen readers, WCAG focus and contrast, reduced motion, keyboard, long text, responsiveness and device resource budgets.
