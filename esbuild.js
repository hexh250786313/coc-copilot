/* eslint-disable @typescript-eslint/no-var-requires */
const { dirname: _dirname } = require('path')

async function start(watch) {
  await require('esbuild').build({
    entryPoints: ['src/index.ts'],
    bundle: true,
    watch,
    minify: process.env.NODE_ENV === 'production',
    sourcemap: process.env.NODE_ENV === 'development',
    mainFields: ['module', 'main'],
    external: ['coc.nvim'],
    platform: 'node',
    target: 'node10.12',
    outfile: 'build/index.js',
    plugins: [],
  })
}

let watch = false
if (process.argv.length > 2 && process.argv[2] === '--watch') {
  console.log('watching...')
  watch = {
    onRebuild(error) {
      if (error) {
        console.error('watch build failed:', error)
      } else {
        console.log('watch build succeeded')
      }
    },
  }
}

start(watch).catch((e) => {
  console.error(e)
})
