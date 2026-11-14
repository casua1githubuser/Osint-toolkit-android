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
- Graph, advanced catalogs, and React frontend are **not yet integrated**. The UI is an OSINT/2002-inspired native asset, not the previously approved pixel-perfect React screen.
- Debug APK signed by a *new ephemeral GitHub runner debug key on each build*. Updates may require uninstall; **do not uninstall an existing installation without backing up data**. For release use a persisted secure signing key.
- `applicationId` is `com.osinttoolkit.app`, versionCode 2, minSdk 26, targetSdk 35.
- Installation on a real Nothing Phone (3) has **not been verified**.

## Verification
GitHub Actions builds the debug APK and runs Android Lint on pushes to `main`,
pull requests, and manual runs. Check the run result before installing its APK.
On-device installation and behavior remain unverified.
