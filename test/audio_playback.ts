/*
  Smoke test for the built site: clicking the button plays the clip, and the page raises nothing.

  Whatever browsers the machine has are tested, on any platform: candidates are found by name
  across PATH and the platform's application directories, then each one is confirmed to be
  Chromium-family by its own --version output. Nothing is hard-coded to a particular install.

  Firefox and Safari are not driven: they speak WebDriver BiDi rather than the DevTools protocol
  used here, which would mean taking on a driver dependency.
*/

import { existsSync } from "node:fs"
import { mkdtemp, readdir, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

const headed = process.argv.includes(`--headed`)

interface Browser {
	name: string
	path: string
}

// browser executables are named after their browser on every platform
const BROWSERISH = /(chrome|chromium|edge|brave|vivaldi|opera|arc|thorium|yandex)/iu
// ...and identify themselves in --version, which is how a candidate is confirmed
const CHROMIUM = /\b(Chrome|Chromium|Edge|Brave|Vivaldi|Opera)\b/u
// webdriver binaries live beside the browsers and answer --version almost identically
// ("Microsoft Edge WebDriver 152.0"), but they drive a browser rather than being one
const DRIVER = /driver/iu

/* Everywhere a browser executable might sit, by platform. */
const searchPaths = (): string[] => {
	const {
		HOME = ``,
		LOCALAPPDATA = ``,
		PROGRAMFILES = ``,
		"PROGRAMFILES(X86)": X86 = ``,
	} = process.env
	const path = process.env[`PATH`] ?? ``
	const separator = process.platform === `win32` ? `;` : `:`
	const dirs = path.split(separator).filter(Boolean)

	if (process.platform === `darwin`) {
		return [...dirs, `/Applications`, join(HOME, `Applications`)]
	}
	if (process.platform === `win32`) {
		return [...dirs, PROGRAMFILES, X86, join(LOCALAPPDATA, `Programs`)].filter(Boolean)
	}

	return [...dirs, `/opt`, `/usr/lib`, `/snap/bin`]
}

/* Candidate executables with a browser-ish name. Names are filtered before anything is run, so
   unrelated applications are never launched just to see what they are. */
const scan = async (): Promise<string[]> => {
	const found: string[] = []
	for (const dir of new Set(searchPaths())) {
		let entries: string[]
		try {
			entries = await readdir(dir)
		} catch {
			continue // unreadable or missing, nothing to do
		}

		for (const entry of entries.filter((e) => BROWSERISH.test(e) && !DRIVER.test(e))) {
			// a macos or windows browser is a bundle or directory, with the executable inside
			const candidates =
				process.platform === `darwin`
					? [join(dir, entry, `Contents/MacOS`, entry.replace(/\.app$/u, ``)), join(dir, entry)]
					: [
							join(dir, entry),
							join(dir, entry, `${entry}.exe`),
							join(dir, entry, `Application`, `${entry}.exe`),
						]
			found.push(...candidates.filter((c) => existsSync(c)))
		}
	}

	return found
}

/* Confirms a candidate really is a chromium-family browser by asking it. */
const identify = async (path: string): Promise<Browser | undefined> => {
	try {
		const proc = Bun.spawn([path, `--version`], { stdout: `pipe`, stderr: `ignore` })
		const output = await new Response(proc.stdout).text()
		await proc.exited
		const version = output.trim()
		return CHROMIUM.test(version) && !DRIVER.test(version)
			? { name: version || path, path }
			: undefined
	} catch {
		return undefined
	}
}

const discover = async (): Promise<Browser[]> => {
	const override =
		process.argv.find((a) => a.startsWith(`--browser=`))?.slice(10) ?? process.env[`BROWSER_PATH`]
	if (override) return [{ name: override, path: override }]

	const byPath = new Map<string, Browser>()
	for (const candidate of await scan()) {
		const real = await realpath(candidate).catch(() => candidate)
		if (byPath.has(real)) continue
		const browser = await identify(real)
		if (browser) byPath.set(real, browser)
	}

	return [...byPath.values()]
}

const serve = (dir: string) =>
	Bun.serve({
		port: 0,
		async fetch(req) {
			const path = new URL(req.url).pathname
			const file = Bun.file(dir + (path === `/` ? `/index.html` : path))
			return (await file.exists()) ? new Response(file) : new Response(`not found`, { status: 404 })
		},
	})

const launch = async (browser: Browser, profile: string) => {
	const proc = Bun.spawn(
		[
			browser.path,
			...(headed ? [] : [`--headless=new`, `--mute-audio`]),
			// containerised ci runners cannot use the sandbox
			...(process.env[`CI`] ? [`--no-sandbox`, `--disable-dev-shm-usage`] : []),
			`--remote-debugging-port=0`,
			`--user-data-dir=${profile}`,
			`--no-first-run`,
			`--no-default-browser-check`,
			`--autoplay-policy=no-user-gesture-required`,
			`--window-size=1000,800`,
		],
		{ stdout: `ignore`, stderr: `ignore` },
	)

	// the chosen port is written to the profile once the browser is listening. the handle is
	// rebuilt each pass because a BunFile caches the stat it took when it was created.
	for (let i = 0; i < 150; i++) {
		await Bun.sleep(100)
		const portFile = Bun.file(join(profile, `DevToolsActivePort`))
		if (await portFile.exists()) {
			const port = Number((await portFile.text()).split(`\n`)[0])
			if (port) return { proc, port }
		}
	}

	proc.kill()
	throw new Error(`${browser.name} did not expose a debugging port`)
}

/* Minimal CDP client: enough to open a tab, click in it and collect what the page threw. */
const connect = async (port: number) => {
	const target = await (
		await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: `PUT` })
	).json()
	const ws = new WebSocket(target.webSocketDebuggerUrl)
	await new Promise((resolve) => ws.addEventListener(`open`, resolve, { once: true }))

	let id = 0
	const pending = new Map<number, (value: any) => void>()
	const events: any[] = []
	ws.addEventListener(`message`, (e) => {
		const message = JSON.parse(String(e.data))
		if (message.id === undefined) events.push(message)
		else pending.get(message.id)?.(message)
	})

	const send = (method: string, params: unknown = {}) =>
		new Promise<any>((resolve) => {
			const n = ++id
			pending.set(n, resolve)
			ws.send(JSON.stringify({ id: n, method, params }))
		})

	return { send, events, close: () => ws.close() }
}

interface Outcome {
	label: string | undefined
	playing: boolean
	currentTime: number
	errors: string[]
}

const visit = async (debugPort: number, url: string): Promise<Outcome> => {
	const cdp = await connect(debugPort)
	try {
		await cdp.send(`Runtime.enable`)
		await cdp.send(`Page.enable`)
		await cdp.send(`Page.navigate`, { url })
		await Bun.sleep(1_500)

		const evaluate = async (expression: string) => {
			const res = await cdp.send(`Runtime.evaluate`, {
				expression,
				awaitPromise: true,
				returnByValue: true,
			})
			return res.result?.result?.value
		}

		const rect = JSON.parse(
			await evaluate(`JSON.stringify(document.querySelector('button').getBoundingClientRect())`),
		)
		const x = Math.round(rect.x + rect.width / 2)
		const y = Math.round(rect.y + rect.height / 2)
		for (const type of [`mousePressed`, `mouseReleased`]) {
			await cdp.send(`Input.dispatchMouseEvent`, { type, x, y, button: `left`, clickCount: 1 })
		}
		await Bun.sleep(600)

		return {
			label: await evaluate(`document.querySelector('button')?.ariaLabel`),
			playing: !(await evaluate(`document.querySelector('audio').paused`)),
			currentTime: await evaluate(`document.querySelector('audio').currentTime`),
			errors: cdp.events
				.filter(
					(e) =>
						e.method === `Runtime.exceptionThrown`
						|| (e.method === `Runtime.consoleAPICalled` && e.params.type === `error`),
				)
				.map(
					(e) =>
						e.params.exceptionDetails?.exception?.description
						?? e.params.exceptionDetails?.text
						?? JSON.stringify(e.params.args?.map((a: any) => a.description ?? a.value)),
				),
		}
	} finally {
		cdp.close()
	}
}

const site = `_site`
if (!existsSync(join(site, `index.html`))) {
	console.error(`no build found in ${site}/ - run \`mise run build\` first`)
	process.exit(1)
}

const browsers = await discover()
if (browsers.length === 0) {
	console.error(`no chromium-family browser found - set BROWSER_PATH to one`)
	process.exit(1)
}

// `--list` answers "what did it actually find?", which is the first question when ci disagrees
if (process.argv.includes(`--list`)) {
	for (const browser of browsers) console.log(`${browser.name}\n  ${browser.path}`)
	process.exit(0)
}

let failures = 0
const check = (ok: boolean, description: string, detail = ``) => {
	console.log(`  ${ok ? `ok  ` : `FAIL`} ${description}${detail && ` - ${detail}`}`)
	if (!ok) failures++
}

const workdir = await mkdtemp(join(tmpdir(), `wendys-test-`))
const server = serve(site)
try {
	for (const [i, browser] of browsers.entries()) {
		console.log(`\n${browser.name} (${browser.path})`)
		let launched
		try {
			launched = await launch(browser, join(workdir, `profile-${i}`))
		} catch (err) {
			check(false, `launches and exposes a debugging port`, String(err))
			continue
		}

		const { proc, port } = launched
		try {
			const result = await visit(port, `http://127.0.0.1:${server.port}/`)
			check(result.label === `ma'am, this is a wendys`, `the button has its label`, result.label)
			check(
				result.playing && result.currentTime > 0,
				`clicking the button plays the clip`,
				`currentTime ${result.currentTime}`,
			)
			check(result.errors.length === 0, `the page raises nothing`, result.errors[0])
		} finally {
			proc.kill()
		}
	}
} finally {
	await server.stop(true)
	await rm(workdir, { recursive: true, force: true })
}

process.exit(failures === 0 ? 0 : 1)
