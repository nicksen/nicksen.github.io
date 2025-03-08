async function main() {
	for (const el of document.querySelectorAll(`button`)) {
		el.addEventListener(`click`, playSound)
	}
}

async function playSound(this: HTMLButtonElement, _evt: MouseEvent): Promise<void> {
	const src = this.value
	const audio = new Audio(src)

	audio.play()
}

try {
	await main()
} catch (err) {
	console.error(err)
}
