document.addEventListener(`click`, ({ target }) => {
	let src
	if (target instanceof HTMLElement && (src = target.getAttribute(`data-play`))) {
		const audio = new Audio(src)
		audio.play()
	}
})
