async function main(): Promise<void> {
	document.querySelector(`button`)?.addEventListener(`click`, playSound)
}

async function playSound(): Promise<void> {
	const audio = document.querySelector(`audio`)
	audio?.pause()
	audio?.fastSeek(0)
	audio?.play()
}

try {
	await main()
} catch (err) {
	console.error(err)
}
