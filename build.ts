import type { BuildConfig, BunPlugin } from "bun"
import tailwindPlugin from "esbuild-plugin-tailwindcss"
import htmlMinifierTerser from "html-minifier-terser"
import util from "node:util"
import postcssPresetEnv from "postcss-preset-env"
import htmlMinifierOptions from "./html_minifier_config"

const { values: args } = util.parseArgs({
	options: {
		minify: {
			type: `boolean`,
			default: false,
		},
	},
	strict: true,
})
const { minify } = args

const htmlPlugin = (): BunPlugin => {
	return {
		name: `html-plugin`,
		setup(build) {
			const minify = async (path: string): Promise<string> => {
				const html = await Bun.file(path).text()
				if (build.config.minify) {
					return htmlMinifierTerser.minify(html, htmlMinifierOptions)
				}

				return html
			}

			build.onLoad({ filter: /\.html$/u }, async (args) => {
				const html = await minify(args.path)

				return {
					contents: html,
					loader: `html`,
				}
			})
		},
	}
}

const config: BuildConfig = {
	entrypoints: [`src/index.html`],
	outdir: `_site`,
	splitting: true,
	minify,
	publicPath: `/`,
	plugins: [
		tailwindPlugin({
			postcssPlugins: {
				append: [
					postcssPresetEnv({
						env: `modern_css`,
					}),
				],
			},
		}),
		htmlPlugin(),
	],
}

const build = await Bun.build(config)
if (build.logs.length > 0) {
	console.warn(`Build succeeded with warnings:`)
	for (const message of build.logs) {
		console.warn(message)
	}
}
