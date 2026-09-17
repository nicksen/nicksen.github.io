/*
  Smoke test for the built site: clicking the button plays the clip, and the page raises nothing.

  Every Chromium-family browser found on the machine is tested, on any platform, over the DevTools
  protocol. Firefox and Safari speak WebDriver BiDi instead, which would mean a driver dependency.
*/

import { existsSync } from "node:fs"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

const headed = process.argv.includes(`--headed`)

interface Browser {
	name: string
	path: string
}

/* Chromium-family browsers, by platform. Any of them speaks the DevTools protocol used below. */
const candidates = (): Browser[] => {
	const {
		LOCALAPPDATA = ``,
		PROGRAMFILES = ``,
		"PROGRAMFILES(X86)": PROGRAMFILESX86 = ``,
	} = process.env
	const byPlatform: Record<string, Browser[]> = {
		darwin: [
			{ name: `chrome`, path: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` },
			{ name: `edge`, path: `/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge` },
			{ name: `brave`, path: `/Applications/Brave Browser.app/Contents/MacOS/Brave Browser` },
			{ name: `chromium`, path: `/Applications/Chromium.app/Contents/MacOS/Chromium` },
			{ name: `vivaldi`, path: `/Applications/Vivaldi.app/Contents/MacOS/Vivaldi` },
		],
		win32: [
			{ name: `chrome`, path: `${PROGRAMFILES}\\Google\\Chrome\\Application\\chrome.exe` },
			{ name: `chrome`, path: `${PROGRAMFILESX86}\\Google\\Chrome\\Application\\chrome.exe` },
			{ name: `chrome`, path: `${LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe` },
			{ name: `edge`, path: `${PROGRAMFILES}\\Microsoft\\Edge\\Application\\msedge.exe` },
			{ name: `edge`, path: `${PROGRAMFILESX86}\\Microsoft\\Edge\\Application\\msedge.exe` },
		],
	}

	// on linux, and as a fallback anywhere, the binaries live on PATH
	const onPath = [
		`google-chrome`,
		`google-chrome-stable`,
		`chromium`,
		`chromium-browser`,
		`microsoft-edge`,
		`brave-browser`,
	].map((name) => ({ name, path: name }))

	return [...(byPlatform[process.platform] ?? []), ...onPath]
}

const discover = (): Browser[] => {
	const override =
		process.argv.find((a) => a.startsWith(`--browser=`))?.slice(10) ?? process.env[`BROWSER_PATH`]
	if (override) return [{ name: override, path: override }]

	const found = new Map<string, Browser>()
	for (const browser of candidates()) {
		const absolute = browser.path.includes(`/`) || browser.path.includes(`\\`)
		const resolved = absolute
			? existsSync(browser.path)
				? browser.path
				: undefined
			: (Bun.which(browser.path) ?? undefined)
		if (resolved && !found.has(resolved)) found.set(resolved, { ...browser, path: resolved })
	}

	return [...found.values()]
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

const browsers = discover()
if (browsers.length === 0) {
	console.error(`no chromium-family browser found - set BROWSER_PATH to one`)
	process.exit(1)
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
		const { proc, port } = await launch(browser, join(workdir, `profile-${i}`))
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
