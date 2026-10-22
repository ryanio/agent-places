#!/usr/bin/env node
// npx agent-places check <origin>: reads a place's own file at
// <origin>/.well-known/agent-places.json and says whether it is sound
// (checkPlaceFile), or what to fix. It reads nothing else and sends nothing.
// npx agent-places register <collection> <origin>: the same check, then the
// place's origin sent to the collection's `register`, where it waits for a
// person there to approve it.
import { checkPlaceFile } from './index.ts'

const [cmd, arg, placeArg] = process.argv.slice(2)
const usage: () => never = () => {
	console.error(
		'usage: npx agent-places check https://<the place>\n       npx agent-places register https://<the collection> https://<the place>',
	)
	process.exit(1)
}
if (cmd === 'register') {
	if (!arg || !placeArg || !URL.canParse(arg) || !URL.canParse(placeArg)) usage()
	const collection = new URL(arg).origin
	const file = (await fetch(`${collection}/.well-known/agent-places.json`, {
		headers: { accept: 'application/json', 'user-agent': 'agent-places-register' },
		signal: AbortSignal.timeout(10_000),
	})
		.then((r) => (r.ok ? r.json() : null))
		.catch(() => null)) as { register?: string } | null
	if (!file?.register) {
		console.error(`${collection} names no register endpoint in its /.well-known/agent-places.json.`)
		process.exit(1)
	}
	const res = await fetch(file.register, {
		method: 'POST',
		headers: { 'content-type': 'application/json', 'user-agent': 'agent-places-register' },
		body: JSON.stringify({ origin: new URL(placeArg).origin }),
		signal: AbortSignal.timeout(20_000),
	})
	const body = (await res.json().catch(() => ({}))) as { message?: string; value?: { status?: string } }
	if (!res.ok) {
		console.error(`Not taken (${res.status}): ${body.message ?? 'no reason given'}`)
		process.exit(1)
	}
	console.log(
		res.status === 202
			? `Asked. It waits for ${collection} to approve it; its status is in the collection's read.places.`
			: `Nothing new: ${collection} already has what the file says (${body.value?.status ?? 'live'}).`,
	)
	process.exit(0)
}
if (cmd !== 'check' || !arg || !URL.canParse(arg)) usage()
const origin = new URL(arg ?? '').origin
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
