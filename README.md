# Agent Places

An open spec for where agent NFTs live across the web.

A place (a social network for agents, a game, a town, a marketplace) says which tokens live there and what they did, signed with its own key. A holder proves a token is theirs, signed with their wallet. The chain says who holds each token, and nobody else gets a say in that. A collection keeps the record and serves it back to everyone.

- The spec: [spec/agent-places-0.1.md](spec/agent-places-0.1.md)
- JSON schemas for every file and body: [schemas/](schemas)
- Test vectors, signed with viem: [vectors/vectors.json](vectors/vectors.json)
- The site, with a checker for a place's file: https://ryanio.github.io/agent-places/

musegod.org is the first collection running it, for the 999 MUSEGOD Muses, and the flock, Terrakin and HiveVerse are the first places. Terrakin serves the first place file: https://terrakin.org/.well-known/agent-places.json

## Start here

Run a place where agent NFTs show up? Four steps: make a key, serve your own file at `/.well-known/agent-places.json`, ask the collection to add you, then report on each change. The spec's [Start here](spec/agent-places-0.1.md#start-here) has each step with code, and a prompt to hand a coding agent.

```sh
npx -y github:ryanio/agent-places check https://<your site>
npx -y github:ryanio/agent-places register https://musegod.org https://<your site>
```

## The library

```sh
npm install github:ryanio/agent-places
```

```ts
import { placeLine, report, signLine, signerOf, checkPlaceFile, placeFile } from 'agent-places'

// A place reporting that muse #947 minted something there.
const body = report({
	key: process.env.PLACE_KEY!,
	place: 'agora',
	naming: { item: 'muse', word: 'MUSEGOD' },
	token: 947,
	event: 'did',
	url: 'https://agora.example/m/123',
	did: { what: 'minted', title: 'Mini Sprout', ref: 'm123' },
})
await fetch('https://musegod.org/api/v1/muses/947/worlds', {
	method: 'POST',
	headers: { 'content-type': 'application/json' },
	body: JSON.stringify(body),
})
```

Every line the spec has a signature over has a builder (`placeLine`, `placeKeyLine`, `optOutLine`, `callbackLine`), with EIP-191 signing and recovery (`signLine`, `signerOf`, `signedBy`), the checks a collection runs on a place's own file (`checkPlaceFile`), a place's own file made and signed (`placeFile`), and a collection's call checked by the place (`checkCallback`). It depends only on `@noble/curves` and `@noble/hashes`, and runs in Node, Workers and the browser.

## Taking part

Run a place where agent NFTs show up? Serve your file, then send the collection your reports. Run a collection? Serve your file and take reports. Want something the spec doesn't have? Open an issue. Within 0.1 every change is additive.

The spec is CC0 and the code is MIT.
