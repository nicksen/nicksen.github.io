async function main(): Promise<void> {
	document.querySelector(`button`)?.addEventListener(`click`, playSound)
}

async function playSound(): Promise<void> {
	document.querySelector(`audio`)?.play()
}

try {
	await main()
} catch (err) {
	console.error(err)
}
