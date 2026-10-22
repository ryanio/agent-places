import { secp256k1 } from '@noble/curves/secp256k1.js'
import { keccak_256 } from '@noble/hashes/sha3.js'

// Agent Places 0.1 (spec/agent-places-0.1.md): the lines places, holders and
// collections sign, EIP-191 signing and recovery, the checks a collection
// runs on a place's own file, and the bodies a place sends. No network, no
// keys kept: a caller holds its own key and sends its own requests.

export const SPEC = 'agent-places/0.1'

// ---- Words ----------------------------------------------------------------

export const EVENTS = ['joined', 'linked', 'active', 'did', 'left'] as const
export type Event = (typeof EVENTS)[number]
export const HAPPENINGS = [
	'minted',
	'made',
	'built',
	'sold',
	'bought',
	'won',
	'gifted',
	'posted',
] as const
export type Happening = (typeof HAPPENINGS)[number]
export const CALLBACK_KINDS = ['sold', 'star'] as const
export type CallbackKind = (typeof CALLBACK_KINDS)[number]

export const TITLE = /^[A-Za-z0-9][A-Za-z0-9 '.#&!,()-]{0,39}$/
export const REF = /^[A-Za-z0-9_-]{1,64}$/
export const SYMBOL = /^[A-Z][A-Z0-9]{1,9}$/
export const PLACE_ID = /^[a-z][a-z0-9-]{1,23}$/
export const ASSET = /^eip155:\d+\/erc721:0x[0-9a-fA-F]{40}$/

// How a line names a token: in the collection's own words ("muse #947 of
// MUSEGOD", from its file's `item` and `word`), or by the collection's CAIP-19
// id ("eip155:4663/erc721:0x…/947"), the same for every collection.
export type Naming = { item: string; word: string } | { asset: string }
const tokenIn = (n: Naming, token: number) =>
	'asset' in n ? `${n.asset}/${token}` : `${n.item} #${token} of ${n.word}`

export type Did = {
	what: Happening
	title?: string
	price?: { amount: number; symbol: string }
	ref: string
}

// ---- Lines ----------------------------------------------------------------

// What a place signs to report a token. The place names itself, so one
// place's key can never speak for another's. `at` is unix seconds.
export function placeLine(o: {
	place: string
	naming: Naming
	token: number
	event: Event
	url: string
	at: number
	week?: number
	did?: Did
}): string {
	const said =
		o.event === 'active'
			? `active ${o.week ?? 0}`
			: o.event === 'did' && o.did
				? `did ${o.did.what}${o.did.title ? ` "${o.did.title}"` : ''}${o.did.price ? ` for ${o.did.price.amount} ${o.did.price.symbol}` : ''}`
				: o.event
	const ref = o.event === 'did' && o.did ? ` ref ${o.did.ref}` : ''
	return `${o.place} reports ${tokenIn(o.naming, o.token)}: ${said} ${o.url}${ref}. Signed at ${o.at}.`
}

// What each of a place's keys signs in its own file: that the place holds it.
export const placeKeyLine = (place: string, origin: string) =>
	`Agent Places: ${place} at ${origin} holds this key.`

// What a holder signs to stop every place reporting their token, or to let them again.
export const optOutLine = (n: { item: string; word: string }, token: number, out: boolean, at: number) =>
	out
		? `No place may report ${n.item} #${token} of ${n.word}. Signed at ${at}.`
		: `Places may report ${n.item} #${token} of ${n.word} again. Signed at ${at}.`

// What a collection signs when it tells a place about a token living there.
export const callbackLine = (
	n: { item: string; word: string },
	place: string,
	token: number,
	kind: CallbackKind,
	at: number,
) => `${n.word} tells ${place} about ${n.item} #${token}: ${kind}. Signed at ${at}.`

// ---- EIP-191 ----------------------------------------------------------------

const utf8 = new TextEncoder()
const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
const bytes = (h: string) => {
	const s = h.replace(/^0x/, '')
	if (s.length % 2 || /[^0-9a-f]/i.test(s)) throw new Error('not hex')
	return Uint8Array.from(s.match(/../g) ?? [], (b) => Number.parseInt(b, 16))
}
const digest = (line: string) => {
	const m = utf8.encode(line)
	return keccak_256(Uint8Array.from([...utf8.encode(`\x19Ethereum Signed Message:\n${m.length}`), ...m]))
}
const addressOf = (publicKey: Uint8Array) =>
	`0x${hex(keccak_256(secp256k1.Point.fromBytes(publicKey).toBytes(false).subarray(1)).subarray(-20))}`

// The address a private key signs as, lowercase.
export const addressOfKey = (key: string) => addressOf(secp256k1.getPublicKey(bytes(key)))

// An EIP-191 personal signature over `line`, 0x + r + s + v, as wallets and
// viem's signMessage make it.
export function signLine(line: string, key: string): string {
	const sig = secp256k1.sign(digest(line), bytes(key), { prehash: false, format: 'recovered' })
	return `0x${hex(sig.subarray(1))}${(27 + (sig[0] as number)).toString(16)}`
}

// Who signed `line`, lowercase, or null when the signature doesn't recover.
// (A contract wallet signs by ERC-1271 instead, which needs the chain.)
export function signerOf(line: string, signature: string): string | null {
	try {
		const s = bytes(signature)
		if (s.length !== 65) return null
		const v = s[64] as number
		const rec = v >= 27 ? v - 27 : v
		if (rec !== 0 && rec !== 1) return null
		const recovered = Uint8Array.from([rec, ...s.subarray(0, 64)])
		return addressOf(secp256k1.recoverPublicKey(recovered, digest(line), { prehash: false }))
	} catch {
		return null
	}
}

export const signedBy = (line: string, signature: string, address: string) =>
	signerOf(line, signature) === address.toLowerCase()

// ---- A place's own file ------------------------------------------------------

export type PlaceFile = {
	spec: string
	place: {
		id: string
		name: string
		home: string
		page: string
		keys: { address: string; signature: string }[]
		what?: string
		join?: string
		rules?: string
		callback?: string
		collections?: string[]
	}
}

// Whether a place's own file (served at <origin>/.well-known/agent-places.json)
// is sound: every part as the spec has it, every link on its own site, and
// each key signing that the place holds it at this origin.
export function checkPlaceFile(
	origin: string,
	file: unknown,
): { ok: true; place: PlaceFile['place'] } | { ok: false; problems: string[] } {
	const problems: string[] = []
	const f = file as Partial<PlaceFile> | null
	const p = f?.place
	const host = new URL(origin).host
	if (f?.spec !== SPEC) problems.push(`spec must be ${SPEC}.`)
	if (!p) return { ok: false, problems: [...problems, 'place is missing.'] }
	const own = (h: string) => h.toLowerCase() === host || h.toLowerCase().endsWith(`.${host}`)
	const onSite = (u: unknown) =>
		typeof u === 'string' &&
		URL.canParse(u) &&
		new URL(u).protocol === 'https:' &&
		own(new URL(u).host)
	if (!PLACE_ID.test(p.id ?? '')) problems.push('id is lowercase letters, digits and dashes, 2 to 24.')
	if (!p.name?.trim()) problems.push('name is missing.')
	if (!onSite(p.home)) problems.push(`home must be an https page on ${host}.`)
	let page: RegExp | null = null
	try {
		page = new RegExp(p.page ?? '')
	} catch {
		problems.push('page is not a regular expression.')
	}
	const named = (p.page ?? '').replace(/\\\./g, '.').match(/(?:[a-z0-9-]+\.)+[a-z]{2,}/gi) ?? []
	if (
		page &&
		(!p.page?.startsWith('^https:\\/\\/') ||
			!p.page.endsWith('$') ||
			!named.length ||
			!named.every(own) ||
			page.test('https://evil.example/a/b'))
	)
		problems.push(`page must be anchored (^https:\\/\\/ … $) and name only ${host} or hosts under it.`)
	for (const k of ['join', 'rules', 'callback'] as const)
		if (p[k] !== undefined && !onSite(p[k])) problems.push(`${k} must be an https page on ${host}.`)
	if (p.what !== undefined && !(typeof p.what === 'string' && p.what.length > 0 && p.what.length <= 200))
		problems.push('what is one sentence, 200 characters at most.')
	if (p.collections !== undefined && !(Array.isArray(p.collections) && p.collections.every((c) => ASSET.test(c))))
		problems.push('collections lists CAIP-19 ids: eip155:<chain>/erc721:<contract>.')
	const keys = Array.isArray(p.keys) ? p.keys : []
	if (keys.length < 1 || keys.length > 2) problems.push('keys holds one key, or two while rotating.')
	const line = placeKeyLine(p.id ?? '', origin)
	for (const k of keys)
		if (!/^0x[0-9a-fA-F]{40}$/.test(k.address ?? '') || !signedBy(line, k.signature ?? '', k.address))
			problems.push(`${k.address}'s signature isn't of "${line}".`)
	return problems.length ? { ok: false, problems } : { ok: true, place: p as PlaceFile['place'] }
}

// A place's own file, signed with its keys: what a place serves at
// /.well-known/agent-places.json.
export function placeFile(
	origin: string,
	place: Omit<PlaceFile['place'], 'keys'>,
	keys: string[],
): PlaceFile {
	const line = placeKeyLine(place.id, origin)
	return {
		spec: SPEC,
		place: {
			...place,
			keys: keys.map((k) => ({ address: addressOfKey(k), signature: signLine(line, k) })),
		},
	}
}

// ---- What a place sends -------------------------------------------------------

// One signed report: the body for POST <collection's report.one> (with the
// token in the path) or, with its `token`, one entry of a batch.
export function report(o: {
	key: string
	place: string
	naming: Naming
	token: number
	event: Event
	url: string
	at?: number
	week?: number
	did?: Did
}) {
	const at = o.at ?? Math.floor(Date.now() / 1000)
	const line = placeLine({ ...o, at })
	return {
		token: o.token,
		place: o.place,
		event: o.event,
		url: o.url,
		at,
		...('asset' in o.naming ? { asset: o.naming.asset } : {}),
		...(o.event === 'active' ? { week: o.week ?? 0 } : {}),
		...(o.event === 'did' && o.did ? o.did : {}),
		signer: addressOfKey(o.key),
		signature: signLine(line, o.key),
	}
}

// What a collection's call to a place says, checked: the line it signed, and
// whether one of the collection's keys signed it.
export function checkCallback(
	body: { token: number; kind: CallbackKind; at: number; signature: string },
	o: { naming: { item: string; word: string }; place: string; keys: string[] },
) {
	const line = callbackLine(o.naming, o.place, body.token, body.kind, body.at)
	const by = signerOf(line, body.signature)
	return { line, ok: by !== null && o.keys.some((k) => k.toLowerCase() === by) }
}
