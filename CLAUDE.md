# CLAUDE.md

A one-page static site: a single button that plays a sound clip. Keep it that way.

## Workflow

`mise` drives everything. Run `mise tasks ls` for the list, and see the README for what each task
does. `mise run lint` (prettier, tsc, actionlint) must pass before any commit.

## Git

- commits go directly to `main`; this repo has never used branches or merges
- **always ask before pushing** — a push to `main` triggers the GitHub Pages deploy
- commit messages use lowercase semantic prefixes (`fix:`, `feat:`, `refactor:`, `chore:`, `docs:`),
  subject line only. Commits before `d15f6b2` predate this convention and do not follow it.
- `git-branchless` is used here, but its hooks live in `.git/` and are per-clone. On a new machine
  run `git branchless init --main-branch main`.

## Decisions worth not relitigating

- **No linter beyond prettier and tsc.** oxlint was evaluated (2026-09) and rejected: it found zero
  findings in its correctness, suspicious and perf categories, and the ~50 findings in its style and
  restriction categories all contradict deliberate choices here (`no-console`, `no-async-await`,
  `no-optional-chaining`, `sort-imports` fighting `prettier-plugin-organize-imports`).
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

## Known and deferred

GitHub Actions in `.github/workflows/deploy.yaml` float on major-version tags rather than pinned
SHAs, and `actions/checkout` is a major version behind. Deferred to the next dependency-update pass.
