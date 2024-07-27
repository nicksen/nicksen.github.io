<style>
  *, ::before, ::after {
    box-sizing: border-box;
    border-width: 0;
    border-style: solid;
  }

  html {
    line-height: 1.5;
    -webkit-text-size-adjust: 100%;
    -moz-tab-size: 4;
    tab-size: 4;
    font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
    font-feature-settings: normal;
    font-variation-settings: normal;
  }

  body {
    margin: 0;
    line-height: inherit;
  }

  html, body {
    height: 100%;
    width: 100%;
  }

  button {
    font-family: inherit;
    font-feature-settings: inherit;
    font-variation-settings: inherit;
    font-size: 100%;
    font-weight: inherit;
    line-height: inherit;
    color: inherit;
    margin: 0;
    padding: 0;
    text-transform: none;
    -webkit-appearance: button;
    background-color: transparent;
    background-image: none;
    cursor: pointer;
  }

  #run {
    background-color: #dc2626;
    color: #e7e5e4;
    padding: 20px 50px;
  }
</style>

<button type="button" id="run">Ma'am, this is a Wendy's&hellip;</button>

<script>
  const el = document.querySelector(`#run`)
  console.log(el)
</script>
