# Live source audit — 2026-11-14

The catalog count is not a claim that 1,000 sites support reliable automatic
lookup. This audit tested the previous 1,000 entries and five added popular
platforms using the app's actual Java HTTP checker on the workstation network.
It is not a device, geographic-accessibility or future-availability guarantee.

Each source received two newly generated high-entropy usernames (expected to be
absent) and, where available, the upstream `usernameClaimed` public reference.
References can disappear; they are test fixtures, not proof of account identity.
Negative names that violate a source's regex are reported as inconclusive.
No response bodies, cookies or credentials are stored in the reports.

The first round found eight original rules that treated random usernames as
candidates: Pinterest, TikTok, GaiaOnline, Acomics, yamaya.ru,
arcade-zockerbande.de, backloggd.com and bbs.aw-ol.com. Twitch's direct page
behaved the same way when added. Only yamaya.ru's original result contained a
positive marker that would have reached the old UI success group; the others
were status-only/absence-only candidates and already required manual review.

369 original rules passed the first round. A second independent runtime round
used fresh random controls, including an additional control for every positive
candidate. 167 passed **every** positive and negative check in both rounds.
There were zero successful matches on the holdout random usernames. This is
an observed result for these samples, not a statistically established global
false-positive rate. Other sources include timeouts, blocking, redirects,
missing references and inconclusive rules; they are not declared dead sites.

The final catalog retains 1,000 distinct hosts, adding Twitch, Instagram, X,
VK and Kick in place of five entries at the end of the imported subset. Its
167 twice-calibrated sources are selected by default. The remaining 833 are
clearly manual and make no automated request even if explicitly selected;
their result cards retain direct browser links. Twitch uses twitch.tv, not
TwitchTracker. Its generic HTML cannot distinguish a channel from a nonexistent
name; the official Get Users endpoint requires an app/user access token:
https://dev.twitch.tv/docs/api/reference/users/#get-users

For an automatic source, every apparent positive is checked against another
fresh random name at runtime. A candidate is successful only if that control
is explicitly not found. Control 200, CAPTCHA, redirect, timeout or other
ambiguity downgrades the candidate to manual review. HTTP 202/204/206 are not
profile evidence. Uncalibrated rules cannot assert success **or absence**.
Old stored generic positive-marker results also display as manual review.

## Reproduction

Compile SourceCatalog.java, ProfileChecker.java and tools/CatalogAudit.java
with the org.json dependency. The harness takes catalog JSON, pinned Maigret
JSON and an output JSONL path. An optional `--runtime` applies the full
differential checker; otherwise it probes the raw rule. It uses 24 workers,
with at most one request per source at a time, and the app's bounded timeouts.
Live results will differ with time and network conditions.

Regenerate the production catalog with:

    python tools/import-maigret.py PATH_TO_PINNED_MAIGRET_JSON --commit 244bc2924c45b649faeba86cd63cff06522384be --audit docs/audits/2026-11-14-original.jsonl --holdout docs/audits/2026-11-14-holdout.jsonl

Without audit inputs, generated sources default to manual. Audit results only
transfer when URL, check type, regex and both marker lists match exactly.

Raw request outcomes and the machine-readable summary are in `docs/audits/`.
The holdout JSONL includes 369 original sources and the new Kick rule (whose
positive worked but one negative timed out, so it remains manual).
