import type { BuildConfig } from "bun"
import tailwindPlugin from "esbuild-plugin-tailwindcss"
import util from "node:util"
import postcssPresetEnv from "postcss-preset-env"
import { htmlPlugin } from "./dev/html_processor"

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

const naming = {
	entry: `[name].[ext]`,
	chunk: minify ? `[name]-[hash].[ext]` : `[name].[ext]`,
	asset: minify ? `[name]-[hash].[ext]` : `[name].[ext]`,
}

const config: BuildConfig = {
	entrypoints: [`src/index.html`],
	outdir: `_site`,
	splitting: true,
	minify,
	naming,
	publicPath: `/`,
	plugins: [
		tailwindPlugin({
			postcssPlugins: {
				append: [
					postcssPresetEnv({
						browsers: `browserslist config and fully supports css-variables and fully supports css-cascade-layers`,
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
