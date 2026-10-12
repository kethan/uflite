import { gzipSync } from 'node:zlib'

const entries = [
  ['uflite/nano', 'bench/size-nano.js'],
  ['uflite/lite', 'bench/size-lite.js'],
  ['uflite', 'bench/size-full.js'],
  ['hono', 'bench/size-hono.js'],
  ['itty-router', 'bench/size-itty.js'],
]

const [hono, itty] = await Promise.all([
  Bun.file('node_modules/hono/package.json').json(),
  Bun.file('node_modules/itty-router/package.json').json(),
])
console.log(`Bun ${Bun.version}; Hono ${hono.version}; itty-router ${itty.version}; browser target, minified, bundled; one GET /hello route returning a Response`)
for (const [name, entrypoint] of entries) {
  const result = await Bun.build({
    entrypoints: [entrypoint],
    target: 'browser',
    minify: true,
    sourcemap: 'none',
    write: false,
  })
  if (!result.success) throw new Error(`${name}: ${result.logs.join('\n')}`)
  const output = result.outputs[0]
  const bytes = Buffer.from(await output.arrayBuffer())
  console.log(`${name.padEnd(13)} ${bytes.length} B minified; ${gzipSync(bytes).length} B gzip`)
}
