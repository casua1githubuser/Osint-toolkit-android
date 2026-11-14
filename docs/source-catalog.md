# Username sources and search execution

Version 0.11.1 bundles 1,000 checks on 1,000 distinct HTTPS hosts. The native
`source-catalog.json` and public UI `source-catalog.js` are generated together by
`tools/import-maigret.py`; frontend regressions verify their names match exactly.

Upstream: [Maigret data at 244bc2924c45b649faeba86cd63cff06522384be](https://github.com/soxoj/maigret/blob/244bc2924c45b649faeba86cd63cff06522384be/maigret/resources/data.json).
Its MIT license is bundled in the APK and standalone preview. The normalized
catalog records the input SHA-256. Five legacy URL checks retain their existing
order; five popular platforms have explicit direct links; the remaining 990
compatible entries are selected from Maigret, preferring its stored
traffic rank and then name. Rank is an upstream ordering hint, not a current
availability guarantee.

Import requires a direct HTTPS GET username template, a supported status/message
check, and no disabled flag, engine expansion, activation, special probe,
non-username identifier, request payload, custom authentication headers or
unsupported encoding. Fragment-only profiles, known shortlink endpoints and
duplicate hosts are excluded. Unsupported placeholders are rejected. This is a
catalog integration, not execution of the Maigret Python engine.

Search runs at most eight site requests concurrently, uses 4-second connect/read
timeouts, and reads at most 16 KiB for status checks or 128 KiB for message checks.
Body reads have an additional deadline. Redirects are not followed. Non-public
network addresses are rejected. Cancellation disconnects active requests and
cancels queued tasks; processed entries are saved as a partial result.

- **Успех**: a rule passed two live calibration rounds and the requested profile
  differs from a newly generated absent-username control in this search.
- **Проверьте вручную**: HTTP-only candidate, absence-only heuristic, missing
  markers, redirect, blocking, timeout or incompatible username format.
- **Неуспех**: HTTP 404/410 or an explicit configured absence marker.

All are profile-check outcomes; username equality does not establish identity.
Challenge/login pages stay ambiguous. Generic profile markers alone cannot
produce success. Manual/uncalibrated sources make no automated requests and
are deselected by default. Only 167 of the 1,000 entries passed both rounds;
the other 833 are explicitly manual. See [the audit](catalog-audit.md). A missing positive marker stays ambiguous
rather than being interpreted as a negative. Truncated absence-only pages also
stay ambiguous. Older stored candidates lacking evidence remain manual review.

The UI filters by category/name/tag, supports bulk selection, and renders twelve
sources and twenty-four result cards per page. Sorting groups outcomes, and each
card opens its HTTPS URL in an external browser. History lists transfer summaries
only and fetch one full entry when opened. Graphs show at most eight entries with
an explicit limit notice. An explicitly opened history result is preserved when
another search finishes in the background.

Checks use ASCII usernames of 1–40 characters (`A-Z`, digits, `_`, `.`, `-`), with
source-specific regex rules where available. Dot segments are rejected. Live
availability and site rules can change. All 1,000 original entries and five
new popular sources were probed on 2026-11-14; 370 underwent a separate runtime
holdout round. Zero holdout random names produced success. This does not
guarantee zero false positives for every future query or network. Native unit tests cover the catalog and classifications; UI
tests cover large selection, cancellation, paging, sorting and external links.
