# CLAUDE.md

A one-page static site: a single button that plays a sound clip. Keep it that way.

## Workflow

`mise` drives everything. Run `mise tasks ls` for the list, and see the README for what each task
does. `mise run lint` (prettier, tsc, actionlint) must pass before any commit.

## Git

- work on a detached `HEAD` (the git-branchless way), then fast-forward `main` onto the stack to
  land it. This repo has never used branches or merges.
- **always ask before pushing** — a push to `main` triggers the GitHub Pages deploy
- commit messages use lowercase semantic prefixes (`fix:`, `feat:`, `refactor:`, `chore:`, `docs:`),
  subject line only. Commits before `d15f6b2` predate this convention and do not follow it.
- `git-branchless` is used here, but its hooks live in `.git/` and are per-clone. On a new machine
  run `git branchless init --main-branch main`.

## Decisions worth not relitigating

- **No linter beyond prettier and tsc.** oxlint was evaluated (2026-09) and rejected: it found zero
  findings in its correctness, suspicious and perf categories, and the ~50 findings in its style and
  restriction categories all contradict deliberate choices here (`no-console`, `no-async-await`,
  `no-optional-chaining`, `sort-imports` fighting `prettier-plugin-organize-imports`). Worth
  evaluating again at a later date: the calculus changes if the codebase grows past a few files, or
  once oxlint's type-aware rules reach parity with what tsc already checks.
- **The three project names are all load-bearing** and intentionally differ: `groovywendys`
  (package.json), `nicksen.github.io` (repo), `groovy.bitchbot.app` (CNAME). Do not "align" them.
- **Keep every file in `src/assets/`.** The untrimmed `wendys*.mp3` recordings and the `1.mp3` /
  `2.mp3` intermediates are retained as provenance even though only `audio.mp3` ships.
- **Build warnings are fatal.** `build.ts` exits non-zero on any log output; hard errors already
  throw in Bun.
- **`mise run deploy` cleans first, `mise run build` does not.** Development builds stay incremental
  on purpose. Note that mise's `wait_for` only orders a task already in the run graph — it does not
  pull one in, so `clean` has to be a real `depends` entry.
- Playback errors in `playSound` are swallowed on purpose: clicking the button mid-clip aborts the
  in-flight `play()`, and that rejection is expected rather than exceptional.

## Browser test

`test/audio_playback.ts` launches browsers itself and drives them over the DevTools protocol, with
no test dependency. What cost time to learn:

- **The debugging port comes from the browser's stderr announcement**
  (`DevTools listening on ws://...`), not from the `DevToolsActivePort` file in the profile. Edge
  never writes that file even though it is listening the whole time; Chrome and Chromium do, which
  hides the problem locally.
- **Startup can be slow.** Chromium on a loaded CI runner has taken ~19s, so the launch ceiling is
  60s. A 15s one failed intermittently and looked like flakiness.
- **WebDriver binaries are not browsers.** `msedgedriver` and `chromedriver` sit on PATH beside the
  browsers and answer `--version` almost identically ("Microsoft Edge WebDriver 152.0"), so they are
  excluded by name and by version string.
- **CI is the real signal.** Only Chrome is normally installed locally, while the runner has Chrome,
  Chromium and Edge. Both bugs above were invisible on macOS and only appeared on the runner.
- **Firefox and Safari are not covered.** They speak WebDriver BiDi rather than the DevTools
  protocol, so covering them means a driver dependency — Playwright would bring Firefox and WebKit
  together. Declined so far as too heavy for a one-button site.
- `--list` prints the browsers discovered, `--headed` shows the window.

## Known and deferred

GitHub Actions float on major-version tags rather than pinned SHAs. This is a choice, reviewed and
kept in 2026-09: patches and security fixes arrive automatically, at the cost of trusting the tags.
Pinning to SHAs needs Dependabot or manual bumps to avoid going stale.
