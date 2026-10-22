#!/usr/bin/env node
// npx agent-places check <origin>: reads a place's own file at
// <origin>/.well-known/agent-places.json and says whether it is sound
// (checkPlaceFile), or what to fix. It reads nothing else and sends nothing.
import { checkPlaceFile } from './index.ts'

const [cmd, arg] = process.argv.slice(2)
if (cmd !== 'check' || !arg || !URL.canParse(arg)) {
	console.error('usage: npx agent-places check https://<the place>')
	process.exit(1)
}
const origin = new URL(arg).origin
const res = await fetch(`${origin}/.well-known/agent-places.json`, {
	headers: { accept: 'application/json', 'user-agent': 'agent-places-check' },
	signal: AbortSignal.timeout(10_000),
}).catch(() => null)
// A site with no file often answers its app page with a 200.
const body: unknown = res?.ok ? await res.json().catch(() => null) : null
if (!body) {
	console.error(`${origin}/.well-known/agent-places.json is not there, or not JSON.`)
	process.exit(1)
}
if ((body as { collection?: unknown }).collection) {
	console.log(`${origin} serves a collection's file, not a place's: it receives reports rather than sends them.`)
	process.exit(0)
}
const out = checkPlaceFile(origin, body)
if (!out.ok) {
	console.error(`Not yet:\n${out.problems.map((p) => `- ${p}`).join('\n')}`)
	process.exit(1)
}
console.log(
	`${out.place.id} at ${origin} is sound: ${out.place.keys.length === 1 ? 'its key signs' : 'both its keys sign'} that ${out.place.id} holds it.`,
)
