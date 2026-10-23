import assert from 'node:assert/strict'
import { test } from 'node:test'
import vectors from '../vectors/vectors.json' with { type: 'json' }
import {
	addressOfKey,
	callbackLine,
	checkCallback,
	checkPlaceFile,
	optOutLine,
	pageMatches,
	placeFile,
	placeKeyLine,
	placeLine,
	report,
	signedBy,
	signerOf,
	signLine,
} from './index.ts'

// The test vectors were signed with viem, the library a collection most
// likely checks with, so these hold this library to it byte for byte.

const MUSE = { item: 'muse', word: 'MUSEGOD' }
const U = 'https://agora.example/a/k41'
const line = (name: string) => {
	const c = vectors.cases.find((x) => x.name === name)
	if (!c) throw new Error(name)
	return c
}

test('every line is built and signed exactly as the vectors have it', () => {
	const at = vectors.at
	const built: Record<string, string> = {
		joined: placeLine({ place: 'agora', naming: MUSE, token: 947, event: 'joined', url: U, at }),
		linked: placeLine({ place: 'agora', naming: MUSE, token: 947, event: 'linked', url: U, at }),
		left: placeLine({ place: 'agora', naming: MUSE, token: 947, event: 'left', url: U, at }),
		active: placeLine({ place: 'agora', naming: MUSE, token: 947, event: 'active', url: U, at, week: 12 }),
		did: placeLine({
			place: 'agora',
			naming: MUSE,
			token: 947,
			event: 'did',
			url: 'https://agora.example/m/123',
			at,
			did: { what: 'sold', title: 'Mini Sprout', price: { amount: 0.01, symbol: 'ETH' }, ref: 'm123' },
		}),
		didPlain: placeLine({
			place: 'agora',
			naming: MUSE,
			token: 947,
			event: 'did',
			url: 'https://agora.example/p/9',
			at,
			did: { what: 'posted', ref: 'p9' },
		}),
		asset: placeLine({
			place: 'agora',
			naming: { asset: vectors.asset },
			token: 947,
			event: 'linked',
			url: U,
			at,
		}),
		placeKey: placeKeyLine('agora', 'https://agora.example'),
		optOut: optOutLine(MUSE, 947, true, at),
		optIn: optOutLine(MUSE, 947, false, at),
		callback: callbackLine(MUSE, 'agora', 947, 'sold', at),
	}
	assert.equal(addressOfKey(vectors.key), vectors.address)
	for (const c of vectors.cases) {
		assert.equal(built[c.name], c.line, c.name)
		assert.equal(signLine(c.line, vectors.key), c.signature, `${c.name} signs as viem does`)
		assert.equal(signerOf(c.line, c.signature), vectors.address, `${c.name} recovers`)
	}
	assert.equal(signedBy(`${line('joined').line} `, line('joined').signature, vectors.address), false)
	assert.equal(signerOf(line('joined').line, '0x1234'), null)
})

test("a place's own file is sound only when its keys sign for it at its origin and its links stay on its site", () => {
	const origin = 'https://agora.example'
	const file = placeFile(
		origin,
		{
			id: 'agora',
			name: 'Agora',
			home: `${origin}/`,
			page: '^https:\\/\\/agora\\.example\\/a\\/[a-z0-9]{2,20}$',
			what: 'A town of agents.',
			join: `${origin}/join.md`,
			callback: `${origin}/agent-places/calls`,
			unit: 'hours',
		},
		[vectors.key],
	)
	assert.equal(file.place.keys[0]?.signature, line('placeKey').signature)
	assert.equal(checkPlaceFile(origin, file).ok, true)
	assert.equal(checkPlaceFile('https://evil.example', file).ok, false, 'served from another site')
	const bad = (o: object) => checkPlaceFile(origin, { ...file, place: { ...file.place, ...o } }).ok
	assert.equal(bad({ page: '^https:\\/\\/evil\\.example\\/a\\/\\w+$' }), false)
	assert.equal(bad({ join: 'https://evil.example/join.md' }), false)
	assert.equal(bad({ id: 'Agora!' }), false)
	// A pattern that could take a regex engine seconds on one url.
	assert.equal(bad({ page: '^https:\\/\\/agora\\.example\\/(a+)+$' }), false)
	assert.equal(bad({ unit: 'Hours!' }), false)
})

test("a page pattern that names the token matches only that token's page", () => {
	const named = '^https:\\/\\/agora\\.example\\/\\?muse=(?<token>\\d{1,4})$'
	assert.equal(pageMatches(named, 'https://agora.example/?muse=947', 947), true)
	assert.equal(pageMatches(named, 'https://agora.example/?muse=947', 5), false, "#947's page for #5")
	assert.equal(pageMatches(named, 'https://evil.example/?muse=5', 5), false)
	// A pattern with no token group can't say whose page it is: any match goes.
	const plain = '^https:\\/\\/agora\\.example\\/a\\/[a-z0-9]{2,20}$'
	assert.equal(pageMatches(plain, 'https://agora.example/a/k41', 947), true)
})

test('a report carries its line and signature, and a call from a collection checks against its keys', () => {
	const r = report({
		key: vectors.key,
		place: 'agora',
		naming: MUSE,
		token: 947,
		event: 'did',
		url: 'https://agora.example/m/123',
		at: vectors.at,
		did: { what: 'sold', title: 'Mini Sprout', price: { amount: 0.01, symbol: 'ETH' }, ref: 'm123' },
	})
	assert.equal(r.signature, line('did').signature)
	assert.equal(r.signer, vectors.address)
	assert.equal(r.what, 'sold')
	const call = { token: 947, kind: 'sold' as const, at: vectors.at, signature: line('callback').signature }
	const keys = [vectors.address]
	const now = vectors.at + 60
	assert.equal(checkCallback(call, { naming: MUSE, place: 'agora', keys, now }).ok, true)
	assert.equal(checkCallback(call, { naming: MUSE, place: 'other', keys, now }).ok, false)
	// Signed afresh on every attempt, so an old one is a replay.
	const late = checkCallback(call, { naming: MUSE, place: 'agora', keys, now: vectors.at + 601 })
	assert.deepEqual([late.signed, late.fresh, late.ok], [true, false, false])
})
