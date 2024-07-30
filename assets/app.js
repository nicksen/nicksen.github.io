const q = (s) => document.querySelector(s)
q(`#run`).addEventListener(`click`, () => q(`#audio`).play())
