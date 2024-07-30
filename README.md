# groovywendys

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

This project was created using `bun init` in bun v1.1.21. [Bun](https://bun.sh) is a fast all-in-one
JavaScript runtime.

## Audio clip

The audio clip was created using:

```sh
ffmpeg -to 1 -i ./src/assets/wendys2.mp3 ./src/assets/1.mp3
ffmpeg -ss 1 -i ./src/assets/wendys4.mp3 ./src/assets/2.mp3
ffmpeg -i "concat:./src/assets/1.mp3|./src/assets/2.mp3" -acodec copy ./src/assets/audio.mp3
```
