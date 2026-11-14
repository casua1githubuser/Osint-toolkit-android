# OSINT Toolkit / 2002 — Android Java alpha

**Standalone Android app**: no Termux, Python or local HTTP server.
Java WebView bridge, Android SQLite, direct HTTPS profile checks, DNS A/AAAA resolution.

## Build
1. Push this complete project to GitHub (keep the `app/` and `gradle/` directories).
2. Actions → Android APK → Run workflow.
3. Download artifact `OSINT-Toolkit-Java-Alpha-APK` and extract `app-debug.apk`.

For a local build, install JDK 17 and Android SDK platform 35 / build-tools 35.0.0.
Set `ANDROID_HOME` to the SDK directory (or set `sdk.dir` in untracked `local.properties`).
Run `./gradlew :app:assembleDebug :app:lintDebug` on Linux/macOS or
`gradlew.bat :app:assembleDebug :app:lintDebug` on Windows.
The Gradle 8.11.1 wrapper downloads and verifies Gradle automatically.
The APK is written to `app/build/outputs/apk/debug/app-debug.apk`.

## Important limits
- This is an **alpha prototype**, NOT a port of all Python features.
- Search checks GitHub, GitLab, Reddit, Pinterest, TikTok by HTTP status; HTTP 200 is a **candidate only**, not proof that the profile exists.
- DNS supports A/AAAA address resolution only. No MX/TXT/DKIM yet.
- The OSINT / 2002 design is implemented as bundled HTML/CSS/JavaScript in the native WebView: home, search, DNS, results, local databases, history, settings, and a provisional graph.
- The graph visualizes only query-to-checked-source or domain-to-DNS-answer relationships. It does not infer account ownership or personal relationships.
- External catalogs (Sherlock/Maigret), CSV/XLSX import, phone/email searches, and a remote backend are not integrated. No demo records are bundled.
- Debug APK signed by a *new ephemeral GitHub runner debug key on each build*. Updates may require uninstall; **do not uninstall an existing installation without backing up data**. For release use a persisted secure signing key.
- `applicationId` is `com.osinttoolkit.app`, versionCode 6, versionName `0.5.0-alpha`, minSdk 26, targetSdk 35.
- Installation on a real Nothing Phone (3) has **not been verified**.

## Verification
GitHub Actions builds the debug APK and runs Android Lint on pushes to `main`,
pull requests, and manual runs. Check the run result before installing its APK.
On-device installation and behavior remain unverified.

## Interface revision

- Bundled Unbounded with Cyrillic support (SIL Open Font License in `app/src/main/assets/fonts/Unbounded-OFL.txt`). Extended geometric headings use a restrained oblique style inspired by the supplied type reference; URLs and timestamps retain system monospace.
- Separate images for profile search, graph and DNS. The search header is an interior view of the pedestrian bridge shown in its lower photo strip. Database/settings strips use different storage and curved-architecture images; DNS uses network detail. No decorative technical footer.
- Five equal navigation slots: Search, Graph, Home, Databases, Settings. Home is geometrically centered; History is reachable from Home and storage, with an explicit storage breadcrumb. Large text wraps and the page reserves the menu's measured height.
- Balanced motion: 100ms touch feedback and a 200ms/7px page entry with a soft easing curve. Navigation cancels the prior page animation; input is never delayed. Local refreshes do not replay page transitions. Both app and system reduced-motion preferences are respected.
- History is stored query results, not a collection/tag editor. External catalogs and imports are static availability descriptions, not clickable features. DNS always checks both address types; A/AAAA labels are not selectors.
- A native parent layout reserves system-bar, cutout and keyboard insets around the WebView. This changes the actual viewport so fixed navigation and scrolling content cannot occupy those inset regions.
- Functional regression checks: `npm ci --prefix tests` followed by `npm test --prefix tests`. GitHub Actions runs these before the Android build. Test fixtures live under `tests/` and are not APK assets.
