document.addEventListener(`click`, ({ target }) => {
	if (target instanceof HTMLElement) {
		const src = target.getAttribute(`data-play`)!
		const audio = new Audio(src)
		audio.play()
	}
})
