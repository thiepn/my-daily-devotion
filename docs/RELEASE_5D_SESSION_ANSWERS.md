# Durable editor integration — Focused Prayer answer notes

This slice stacks on Prayer writing/Settings, PR #34. It does not finish Batch B or release 1.4.0: collection writing and People/Categories remain. Physical schema 2, domain contract 1 and ordinary portable backup format/schema 1 are unchanged. No merge, deployment or cloud connection.

## Behavior and safety

Material answer text uses the shared 500 ms/two-second controller and serialized writer. Opening an empty answer, reading context and reviewing recovery offers create no draft. Recovery compares writing and explicitly forks into a new owned ID. The payload retains its original session, item, prayer baseline, session date and complete return chain; midnight never substitutes today's queue or date.

Recovery links enter the identified session through a readonly entry path. Neither the Recovery resolver nor the recovery screen starts/reconciles a session. Recovery is offered only for the first pending, nondeleted Active request in that original open session. Changed wording requires explicit comparison; unavailable, ended, answered, skipped or previous-journal notes remain copyable. Ordinary Prayer Detail cannot record a session note as an unrelated answer.

Only explicit Mark answered invokes the identified-session adapter. Its actual session/item/prayer/resolution/event transaction also retires the submitted private generation. It rechecks the session's stored date, pending item relationship, prayer status and revision. Existing answer/action dating and reconciliation rules remain. The committed state returns directly; a later refresh failure cannot repeat the action. Private checkpoint failure leaves honest Retry/copy guidance and still allows one valid explicit save when its atomic retirement can succeed.

Newer queued input after commitment remains durable and copyable with a copy-only marker; it cannot create another resolution. Fields lock during commitment. Discard waits for queued writes and retirement before navigation. Pausing, skipping, ending and switching with an unfinished note retain the shared discard/keep dialog and unload warning; navigation never records an answer.

## Verification and presentation

Unit coverage checks readonly recovery, atomic answer/retirement, replay denial, ended/skipped/changed targets and wrong dates. Browser coverage exercises restart across midnight, pristine reads, readonly unavailable recovery, private-storage failure, existing session handoffs, simultaneous actions and queued text. Pristine read tests still snapshot every table; tests after deliberate draft persistence compare domain tables separately and inspect the private draft/commitment explicitly.

New deterministic images cover 320/360/390/430/768/1440px, dark, 200% text, review, kept writing, failures, long notes, discard and midnight. Existing Focused Prayer comparisons remain. The warm journal, botanical accent and immersive shell stay intact; recovery adds disclosed content and enlarged text scrolls naturally. Save actions wrap instead of narrowing below their text. Synthetic session/item/prayer fixtures now use valid UUIDs; no production records are rewritten.

Exact-commit evidence and package hashes belong in the draft PR after complete certification. Independent screen-reader/usability review, physical-phone keyboards/IME and interruption checks remain human/device gates. This report is not a declaration of final visual fidelity or of durable recovery in every editor.
