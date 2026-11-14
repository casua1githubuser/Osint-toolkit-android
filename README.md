# OSINT Toolkit / 2002 — Android Java alpha

**Standalone Android app**: no Termux, Python or local HTTP server.
Java WebView bridge, Android SQLite, direct HTTPS profile checks, DNS A/AAAA resolution.

## Build
1. Upload repository contents to GitHub (root must contain `settings.gradle`).
2. Actions → Android APK → Run workflow.
3. Download artifact `OSINT-Toolkit-Java-Alpha-APK` and extract `app-debug.apk`.

## Important limits
- This is an **alpha prototype**, NOT a port of all Python features.
- Search checks GitHub, GitLab, Reddit, Pinterest, TikTok by HTTP status; HTTP 200 is a **candidate only**, not proof that the profile exists.
- DNS supports A/AAAA address resolution only. No MX/TXT/DKIM yet.
- Graph, advanced catalogs, and React frontend are **not yet integrated**. The UI is an OSINT/2002-inspired native asset, not the previously approved pixel-perfect React screen.
- Debug APK signed by a *new ephemeral GitHub runner debug key on each build*. Updates may require uninstall; **do not uninstall an existing installation without backing up data**. For release use a persisted secure signing key.
- `applicationId` is `com.osinttoolkit.app`, versionCode 2, minSdk 26, targetSdk 35.
- Installation on a real Nothing Phone (3) has **not been verified**.

## Verification
The source was statically reviewed and packaged in this environment. No Android SDK/Gradle executable is available here, so compilation and on-device installation remain unverified.
