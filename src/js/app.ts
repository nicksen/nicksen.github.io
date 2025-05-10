const root: ParentNode = document

interface QuerySelector {
	<K extends keyof HTMLElementTagNameMap>(
		selectors: K,
		container?: ParentNode,
	): HTMLElementTagNameMap[K] | undefined
	<E extends HTMLElement = HTMLElement>(selectors: string, container?: ParentNode): E | undefined
}

const q: QuerySelector = (selectors: string, container: ParentNode = root) =>
	container.querySelector(selectors) ?? undefined

const playSound = async (): Promise<void> => {
	const audio = q(`audio`)
	audio?.pause()
	audio?.fastSeek(0)
	audio?.play()
}

const main = async (): Promise<void> => q(`button`)?.addEventListener(`click`, playSound)

try {
	await main()
} catch (err) {
	console.error(err)
}
