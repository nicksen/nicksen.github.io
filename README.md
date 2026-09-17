# groovywendys

Ma'am, this is a Wendy's. One button, one sound clip, no further features planned.

Live at [groovy.bitchbot.app](https://groovy.bitchbot.app).

## Requirements

[mise](https://mise.jdx.dev) provides the toolchain (Bun and actionlint). Everything else is fetched
by the tasks themselves.

```sh
mise install
```

## Tasks

Run `mise tasks ls` for the full list.

| Task               | Description                                  |
| ------------------ | -------------------------------------------- |
| `mise run dev`     | serve the site on a watching dev server      |
| `mise run build`   | build the site into `_site/`                 |
| `mise run deploy`  | clean, then build a minified production site |
| `mise run test`    | run browser smoke tests against the build    |
| `mise run lint`    | check formatting, types and workflows        |
| `mise run fmt`     | apply formatting fixes                       |
| `mise run clean`   | remove `_site/`                              |
| `mise run up:deps` | update dependencies to their latest versions |

## Deployment

Pushing to `main` runs [the deploy workflow](.github/workflows/deploy.yaml), which lints, builds
with `mise run deploy` and publishes `_site/` to GitHub Pages.

## Audio clip

The audio clip was created using:

```sh
ffmpeg -to 1 -i ./src/assets/wendys2.mp3 ./src/assets/1.mp3
ffmpeg -ss 1 -i ./src/assets/wendys4.mp3 ./src/assets/2.mp3
ffmpeg -i "concat:./src/assets/1.mp3|./src/assets/2.mp3" -acodec copy ./src/assets/audio.mp3
```

`wendys0.mp3` through `wendys4.mp3` are the untrimmed source recordings; `1.mp3` and `2.mp3` are the
intermediate cuts. Only `audio.mp3` ships with the site.
