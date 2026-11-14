# OSINT Toolkit / 2002 — Android Java alpha

Standalone Android WebView app with SQLite history, direct HTTPS username checks
and DNS A/AAAA resolution. No Termux, Python service or local server is required.

## Search

Version **0.11.0-alpha** bundles **1,000 sources** in nine categories using a
compatible subset of Maigret's catalog. Search by source name/tag, filter by
category, select groups, and run up to eight checks concurrently. Progress and
stop controls are next to the username input. Cancelled runs preserve processed
results. Catalog rules, source attribution and limitations are documented in
[docs/source-catalog.md](docs/source-catalog.md).

Results are sortable/filterable as **Успех**, **Проверьте вручную**, **Неуспех**.
Positive markers count as a successful check; HTTP 200 alone remains manual
review. Redirects, access restrictions and network failures stay ambiguous.
A matching username never proves account ownership or personal identity.
Every result card opens its HTTPS profile URL in an external browser.

Sources and results are paged; history loads full entries only on demand.
The provisional graph shows only query-to-checked-source or domain-to-address
relationships and explicitly limits the number of displayed nodes.

## Build and verify

Use JDK 17, Android SDK 35 and build-tools 35.0.0. Set ANDROID_HOME or sdk.dir in
untracked local.properties. The verified Gradle 8.11.1 wrapper is included.

    npm ci --prefix tests
    npm test --prefix tests
    ./gradlew :app:testDebugUnitTest :app:assembleDebug :app:lintDebug

Use gradlew.bat on Windows. GitHub Actions runs these checks on main pushes,
pull requests and workflow_dispatch, and uploads the APK and Lint report.
APK path: app/build/outputs/apk/debug/app-debug.apk.

A self-contained HTML preview is generated with:

    python tools/package-preview.py OUTPUT_DIRECTORY

Photographs, fonts, the source picker and all app scripts are embedded directly.
No test records or native mock bridge are shipped in the APK/production preview.

## Interface

Cold blue photographic design with distinct page images, OSINT Wide typography
and shared 2px SVG icons. Five navigation destinations keep Home centered, with
16:9 selection plates. Interruptible outgoing-page dissolves avoid resetting the
new page's opacity. Decorative squares and orthogonal vectors pause offscreen;
system reduced-motion preference is respected. Insets reserve Android system
bars, keyboard and cutouts around the WebView.

## Limits

- Alpha; on-device behavior and battery usage have not been verified.
- ASCII username checks only; source-specific formats may produce manual review.
- DNS resolves A/AAAA only. WHOIS, MX/TXT, phone/email search, Sherlock, file import
  and remote APIs are not integrated. The bundled Maigret catalog is supported;
  the Python engine and its custom activation/proxy features are not included.
- Third-party site accessibility and matching rules can change.
- GitHub runner debug signing is ephemeral. Installing over a differently signed
  build may require uninstalling it; uninstalling removes local history.
- applicationId com.osinttoolkit.app; versionCode 21; minSdk 26; targetSdk 35.

Fonts, icon sources/licenses and generation prompts are retained in the repo.
