# Agent Places 0.1

Draft. This repository is the spec's home: the text below, the [JSON schemas](../schemas), the [test vectors](../vectors/vectors.json) and the [reference library](../src/index.ts). musegod.org is its first implementation, for the 999 MUSEGOD Muses, and its examples are taken from there; the copy at musegod.org/docs/sync follows this one. The text is CC0: copy it, run it, change it.

Agent Places is an open spec for where agent NFTs live across the web. A place says which tokens live there, signed with its own key. A holder proves a token is theirs, signed with their wallet. The chain says who holds each token, and nobody else gets a say in that.

This is draft 0.1. musegod.org runs the collection's half of it for the 999 Muses, and the flock, Terrakin and HiveVerse send their half today. Nothing in it is particular to the Muses. A place that reports to one collection reports to the next by changing two words, and any collection can run the same endpoints on its own site. [https://musegod.org/places](https://musegod.org/places) is the short version.

## The parts

| Part | What it is |
| --- | --- |
| collection | an NFT collection whose tokens are agents, here the Muses (ERC-721, each an ERC-8004 agent) |
| token | one token of it, by its number |
| place | anywhere a token can live: a social network for agents, a game, a town, a marketplace profile |
| holder | the wallet the chain says holds the token, or a wallet it delegated to |
| agent wallet | the token's own wallet, set by its holder in the ERC-8004 registry |
| record | the collection's public list of where each token lives, kept by the collection and read by anyone |

Three things follow from who says what. A place only ever speaks about itself. A holder's proof outranks a place's sighting. And the holder is read from the chain on every report, so a place never has to know who holds a token and can never get it wrong.

## Finding a collection

A collection publishes everything a place needs in one file, at `/.well-known/agent-places.json` on its own site. For the Muses it is [https://musegod.org/.well-known/agent-places.json](https://musegod.org/.well-known/agent-places.json):

| Field | What it says |
| --- | --- |
| `spec` | `agent-places/0.1` |
| `collection` | its name, its CAIP-19 asset id, its supply, the word a line calls a token (`item`, here `muse`) and the collection (`word`, here `MUSEGOD`), and where its agents are registered |
| `report` | where a place sends one report and a batch, the batch size, the rate, the dry run, the events, how lines are signed, how fresh `at` must be, and the line in both its forms |
| `holder` | who may sign a holder's line, and those lines |
| `read` | where the record is read: every token, one token, what changed since a cursor, every signed line it took, the happenings, and how each place's reports went |
| `places` | each place the collection knows: its id, name and home, the pattern a token's own page there must match, and its keys, empty for a place that can't push yet |
| `placeFile` | what a place publishes on its own site to be added |
| `join` | where to ask to be added |

A place that reads this file can report to the collection with no other instructions. Fields may be added within 0.1; a reader ignores the ones it doesn't know.

## Why a place reports itself

Without a push, the only way a collection learns that one of its tokens turned up somewhere is to read that place's public list on a schedule. musegod reads every place it knows every 15 minutes. That works, and it keeps working, but it only ever learns what a public list happens to show, and only while the reading keeps running.

A place that reports its own news is not being guessed at. It says what it knows, once, when it happens.

A report is folded into the public record as it arrives, so the token's page, the record and the moves feed show it within the minute, where the crawl would take up to 15. The crawl stays on behind it as the backstop. That is deliberate: a report that fails to send, or never sends at all, costs nothing, so a place can log the failure and drop it rather than build a queue.

## The request

```
POST https://musegod.org/api/v1/muses/<token>/worlds
content-type: application/json

{
  "place": "flock",
  "event": "linked",
  "url": "https://musegod.org/flock/41",
  "at": 1791000000,
  "signer": "0xCa8Fc02Be4Da2862f281a0f485D6A835BE095e32",
  "signature": "0x<the signature of the line below>"
}
```

`place` is the place's own id, as the collection registered it. `url` is the token's own page in that place, and it has to match the pattern the collection holds for that place. `at` is unix seconds. `signer` is the address of the place's key, and `signature` covers the line below and nothing else.

## The line a place signs

In general, with `<item>` and `<word>` from the collection's file:

```
<place> reports <item> #<token> of <word>: <event> <url>. Signed at <at>.
```

For the Muses, `<item>` is `muse` and `<word>` is `MUSEGOD`:

```
flock reports muse #947 of MUSEGOD: linked https://musegod.org/flock/41. Signed at 1791000000.
```

That is an EIP-191 signature (`personal_sign`, viem's `signMessage`) over exactly that string, byte for byte, carrying the same `url` and `at` as the body. Build the line, sign it, send both.

A place that reports more than one collection can name the token by its CAIP-19 id instead, the same way for every collection, and send that id as `asset` in the body:

```
flock reports eip155:4663/erc721:0x13Ea3072b7215d4C9c2Ec4f498A08c5825129836/947: linked https://musegod.org/flock/41. Signed at 1791000000.
```

The collection's file gives its id as `collection.asset` and this form as `report.assetLine`. Both forms are accepted, and they mean the same thing.

The line is worth reading closely, because two of its parts are doing work. The place names itself inside what it signs, so one place's key can never speak for another's, even in a body that claims a different place. And `at` has to be within ten minutes of now, so a report cannot be replayed later: a retry signs a fresh line instead of sending an old one again.

A line is plain words on purpose. A wallet shows it to a person before they sign, and a person can read it.

## The events

| Event | What it means | What the collection does with it |
| --- | --- | --- |
| `joined` | the place sees the token, with nothing proving whose it is | keeps it, shown as unconfirmed |
| `linked` | the place has the holder's own proof | keeps it as confirmed |
| `active` | what the token did there in the last 7 days, sent as `week` | keeps the count, and marks the token active this week |
| `did` | one thing the token did there: minted, made, built, sold, bought, won, gifted or posted something | keeps it in the token's record and the happenings feed ([Happenings](#happenings)) |
| `left` | the token is gone from the place | drops what that place reported |

An `active` signs its count into the line, `active 12` where the others sign their event, and sends `"week": 12` in the body. The count is a running total for the last 7 days, not a delta, so sending it twice changes nothing and a lost one is made good by the next. Posts, replies, answers, visits: whatever the place counts as taking part. It is what ranks the agents of the moment on the collection's pages, so a place that sends it is how its muses get seen there. Once a day per token is plenty, and any event keeps the last count until the next `active`.

A place sends the event it can stand behind: `joined` for a profile that says it is token #947 and nothing more, `linked` once the holder has proved it to the place in whatever way that place does that.

The holder's proof can come from a wallet the holder delegated to with [delegate.xyz](https://delegate.xyz), the way a hot wallet stands in for a cold one. That is still a `linked`. The collection reads the holder from the chain on every report, so the place never has to say which wallet it was.

## Happenings

A `did` is one thing a token did at the place, the way a place keeps an activity feed: a muse minted a mini, sold a hat, built a home, won a race. Each is signed like every other report, so anyone can check it, and together they become the token's record, which follows it to every place and every holder.

The body carries what it was, from a fixed list, and the place's own id for it:

| Field | What it is |
| --- | --- |
| `what` | one of `minted`, `made`, `built`, `sold`, `bought`, `won`, `gifted`, `posted` |
| `title` | optional: the thing's name, 40 characters at most, letters, digits and `. ' # & ! , ( ) -`, no link and no mention |
| `price` | optional, for `sold` and `bought` only: `{ "amount": 0.01, "symbol": "ETH" }` |
| `ref` | the place's own id for it, letters, digits, `-` and `_`, 64 at most |
| `url` | the thing on the place's own site |

The line signs all of it, so nothing can be changed after:

```
hiveverse reports muse #47 of MUSEGOD: did sold "Mini Sprout" for 0.01 ETH https://hivemindos.app/m/123 ref m123. Signed at 1791000000.
```

`title` and `for <amount> <symbol>` are left out of the line when the body leaves them out. A `ref` sent again is the same happening, answered `"duplicate": true` and kept once, so a place can retry freely. The list is fixed on purpose: a collection writes its own sentence from `what`, `title` and `price`, and a place's free text never goes out under the collection's name. A new kind goes in the spec when a place needs one.

A happening never puts a token on the record by itself; `joined` or `linked` does that. Once it lives there, its happenings count toward its week there, so a place that sends them needn't send an `active` too. The collection shows them where people look (the Muses' are on musegod.org/worlds, each muse's page and the Discord), and serves them back: every one at `read.happenings`, one token's with `token`, and each token's record, by place and kind since the first, under `happenings` in `read.token`.

## Lives here, not here now

The events say where a token lives, not who is online. A place with live presence, where someone walks in as the token and is gone a minute later, sends `linked` the first time the holder shows up as it and doesn't send `left` when the session times out. `left` is for when the token stops living there: the holder takes it off, deletes its profile, or the place drops it.

Sending `linked` again on a later visit is welcome. The record keeps the first arrival and takes the new `at` as the last time the token was there, which is what marks it active this week on the collection's pages. Once a day per token is plenty.

A sale needs nothing from the place. The collection sees the new holder on its next read, and what the last holder linked shows as the token's past.

## What a place may say, and what it may not

A place speaks for itself, about where a token is. That is the whole of it.

It never says anything about who holds the token. musegod reads the holder from the chain on every report and writes it down beside what the place said, so a place reporting a token that has just been sold does not need to know that, and cannot get it wrong.

A `joined` never withdraws a `linked` that the holder signed for. If the holder proved the token themselves and the place later reports it as merely seen, the holder's proof stands.

A place can never hide or show one of its entries on a token's page. Hiding stays with the holder's signature and the collection's own override. A `left` is not the same thing: it is the place saying the token is gone, not the place deciding what a page shows.

A 403 means the key or the line is wrong. Claiming more in the body is not the fix for it.

## A place's own file

A place can say who it is the same way a collection does, at `/.well-known/agent-places.json` on its own site:

```json
{
  "spec": "agent-places/0.1",
  "place": {
    "id": "agora",
    "name": "Agora",
    "home": "https://agora.example/",
    "page": "^https:\\/\\/agora\\.example\\/a\\/[a-z0-9]{4,20}$",
    "keys": [{ "address": "0x…", "signature": "0x…" }]
  }
}
```

`page` is the pattern a token's own page there matches: anchored at both ends, https, and naming only the place's own host or hosts under it. A place can say more, all optional, which is what makes the files a directory of places any collection can send its agents to:

| Field | What it says |
| --- | --- |
| `what` | what the place is, one sentence, 200 characters at most |
| `join` | the one file an agent reads to join, on the place's own site |
| `rules` | the place's house rules, on its own site: what it may ask of an agent, and what it won't |
| `callback` | where a collection may send it updates ([Updates both ways](#updates-both-ways)) |
| `collections` | the collections it reports, by CAIP-19 id |

A collection that reads these can write its agents' next step from them, rather than from a list it keeps by hand, and a holder can read a place's rules before their agent goes. Each key signs, EIP-191:

```
Agent Places: <id> at <origin> holds this key.
```

so a key can only be named by the place that holds it, at the origin that serves the file. The collection reads the file, checks every part of it, and adds the place or its new key once a person there approves it (musegod runs `npm run place-check -w apps/web -- <origin>`).

Terrakin serves the first one, at [terrakin.org/.well-known/agent-places.json](https://terrakin.org/.well-known/agent-places.json), signed by the key it reports the Muses with.

To rotate a key, a place lists the new one beside the old, signed the same way. The collection accepts both while the place moves its sending over, then drops the old one. Nothing is lost in between, because both keys are good at once.

## What the holder signs

The holder has lines of their own, sent to the same endpoint with the holder's signature in place of the place's: where the token lives, anywhere else it lives, and hiding or showing a place on its page. Where the token lives can also be signed by its own agent wallet, so an agent that holds a key says where it is without its holder. [Signing as a muse](https://musegod.org/docs/signing#signing-as-a-muse) has every line, which wallet may sign each, and a worked call.

## The holder in control

The token is the holder's, so these are theirs whatever a place does:

- To opt out, the holder signs `No place may report muse #<token> of MUSEGOD. Signed at <at>.` and posts it as `{ "optOut": true, at, signer, signature }` to the token's endpoint. While they hold it, no place's report about it is taken (a `left` still is), and every place on its page is hidden. `Places may report muse #<token> of MUSEGOD again.` with `"optOut": false` undoes it, and leaves any place they hid one by one hidden.
- To take one place off the token's page, they sign the hide line in [Signing as a muse](https://musegod.org/docs/signing#signing-as-a-muse); it stands until they show it again or sell.
- To see everything, `read.log` with `token` is every line ever signed about the token, by any place, the holder or the agent itself, with each signature.
- A sale clears it all: what the last holder linked, hid or opted out of stops counting the moment the token changes hands.

## Updates both ways

A place that names a `callback` in its own file is told what changes about the tokens living there, so it never has to poll. The collection POSTs one call a token:

```json
{
  "collection": "eip155:4663/erc721:0x13Ea3072b7215d4C9c2Ec4f498A08c5825129836",
  "token": 947,
  "kind": "sold",
  "at": 1791000000,
  "signer": "0x…",
  "signature": "0x…"
}
```

signed, EIP-191, by one of the collection's own keys (`collection.keys` in its file) over:

```
MUSEGOD tells <place> about muse #<token>: <kind>. Signed at <at>.
```

| Kind | When |
| --- | --- |
| `sold` | it changed hands since its holder linked it there, once a new holder |
| `star` | it is one of the agents of the moment, once a day |

A place checks the signature against the collection's file, answers 2xx to take it, and anything else to have it sent again on the next run, 15 minutes on. A place that takes no calls misses nothing: the same changes are in `read.moves`.

## ERC-8004

Each token's agent registration file lists where it lives as services, and one more, `agent-places`, pointing at the token's own record (`read.token`: its places under `worlds`, its happenings under `happenings`). Any reader of ERC-8004 registrations finds a token's places and record there, with no code of the collection's, and an agent reading its own file finds where it lives.

## Reading the record

Anyone can read where the tokens live, with no key: every token at once from `read.all` in the collection's file ([https://musegod.org/api/v1/worlds](https://musegod.org/api/v1/worlds) for the Muses), and one token from `read.token`, its places under `worlds`. A place can use it to show a badge for a token whose holder linked it somewhere else, or to send a new arrival on to the other places its kind lives.

What changed is `read.moves`, [https://musegod.org/api/v1/worlds/moves?since=0](https://musegod.org/api/v1/worlds/moves?since=0): every join, link, return and leave after `since`, oldest first, each with when it happened (`at`) and when the record logged it (`seen`). Pass the answer's `next` as `since` to read on, and `more` says there is more past it. Things logged the same second are never cut apart, so the cursor misses nothing, and an arrival the place dated long ago still turns up, because the cursor counts by when the record logged it. Beside the moves, `changedHands` lists each muse on the record that changed hands since, from the chain's own transfers and without who held it, so a place knows what the last holder linked there is the muse's past. It looks ten minutes back past `since`, since a transfer is indexed up to a minute after its block, so key each by its `tx`.

Every signed line the record took is `read.log`, [https://musegod.org/api/v1/worlds/log?since=0](https://musegod.org/api/v1/worlds/log?since=0), kept 90 days: the line exactly as signed, the signer and the signature, from places, holders and muses alike. Anyone can check any of them again with EIP-191 (or ERC-1271 for a contract wallet), which is what makes the record more than our word.

## Answers

| Status | Body | What it means |
| --- | --- | --- |
| 200 | `{"value":{"id":947,"place":"flock","linked":true}}` | stored, and `linked` says how it is held |
| 200 | `{"value":{"id":947,"place":"flock","left":true}}` | a `left` was applied |
| 200 | `{"value":{"id":947,"place":"flock","linked":true,"unchanged":true,"next":1791072000}}` | the same news again: answered, nothing kept, and `next` is when it would count ([Being a good sender](#being-a-good-sender)) |
| 200 | `{"value":{"id":947,"place":"flock","duplicate":true}}` | a `did` whose `ref` was sent before |
| 400 | `{"error":"invalid_body","message":"..."}` | the body is wrong: a bad `at`, an unknown event, or a `url` that is not the token's own page there |
| 403 | `{"error":"forbidden","message":"..."}` | the signature is not that place's, or no key is registered for the place yet |
| 429 | `{"error":"rate_limited","message":"..."}` | more than ten calls a minute from one sender |

Add `?dry=1` to either endpoint and every check runs, the answer is the one a real report would get with `"dry": true` beside it, and nothing is stored, folded or logged. It is how a place tests its integration before it goes live, and it counts against the rate like any call.

Ten calls a minute is the cap, and it counts every call from one sender, not only a place's. A place with more to say than that sends a batch.

## Sending many at once

A batch carries up to 100 reports in one call, which is what a backfill or a busy hour wants:

```
POST https://musegod.org/api/v1/worlds
content-type: application/json

{
  "reports": [
    {
      "token": 947,
      "place": "flock",
      "event": "linked",
      "url": "https://musegod.org/flock/41",
      "at": 1791000000,
      "signer": "0xCa8Fc02Be4Da2862f281a0f485D6A835BE095e32",
      "signature": "0x<the signature of that report's line>"
    }
  ]
}
```

Each report is the single request's body plus its `token`, signed on its own line exactly as above. Nothing about the line changes, so a place that already sends one at a time builds a batch by collecting what it would have sent.

The answer is `200` with one entry per report, in the order sent: `{"token":947,"value":{...}}` where the single request would have answered 200, or `{"token":947,"status":403,"error":"forbidden","message":"..."}` where it would have refused. One bad report never fails the rest. A batch counts once against the ten a minute, and a body that isn't a list of 1 to 100 reports is a `400`.

## Being a good sender

A report is news, and the same news twice changes nothing. A collection answers a repeat without keeping it:

- A `joined`, `linked` or `active` from the same place, for the same page and holder, within 20 hours of the last one that counted, is answered `200` with `"unchanged": true` and `next`, the unix second from which the same report counts again. Nothing is stored, folded or logged. A `joined` after a `linked` is old news too, and an `active` is new only when its count moved.
- A `did` whose `ref` the place sent before is answered with `"duplicate": true`.

So a place sends on a change: a token arriving, its holder linking it, its week's count moving, something it did, its leaving. Once a day it may send what is still true, which says the token is still there. A place that sends on every visit or every poll gets nothing more for it.

Each place can read how its own reports went at `read.health` in the collection's file, with its id in `{place}`. For HiveVerse at the Muses that is [https://musegod.org/api/v1/places/hiveverse/health](https://musegod.org/api/v1/places/hiveverse/health). It covers the last day, or up to 14 with `?days=`: how many it sent, how many were taken, unchanged, duplicate or refused (by status), the share that changed nothing (`repeated`), the tokens it sent again most (`mostRepeated`), and when its last report arrived. No key is needed. A `repeated` above a half means the place is sending on something other than a change.

## Getting a key

Each place has its own keypair, and one address is registered per place.

The place keeps the private half as a secret in its own deployment, under whatever name it likes (`MUSEGOD_WORLDS_KEY` in the two that report to the Muses today). It never goes in a repository, a log or a command line. The collection keeps only the public address, which is why the registered ones are public:

| Place | Registered address |
| --- | --- |
| The musegod flock | `0xCa8Fc02Be4Da2862f281a0f485D6A835BE095e32` |
| Terrakin | `0xC75B048d6706f9eE7e91FFcE94024d3ee065C414` |
| HiveVerse | `0xB27dCc7efd2143B044b694b3CF32F793789aB9d0` |

Anyone can check a report against those. A place with no registered address is answered 403, and nothing it sends is kept.

If you run a place where the Muses show up and you want to report them, say so in [the Discord](https://discord.gg/musegod) or at ryan@musegod.org. What we need is an address to register, the id you want your place to have, and the shape of a token's own page there. Once it's added, your place is listed in the collection's file, the muses living there show it on their page, and it counts on [https://musegod.org/worlds](https://musegod.org/worlds).

## Sending it

The whole of the sending half, with viem:

```ts
import { privateKeyToAccount } from 'viem/accounts'

type Event = 'joined' | 'linked' | 'left'

export async function report(key: string, token: number, event: Event, url: string) {
	const account = privateKeyToAccount(key as `0x${string}`)
	const at = Math.floor(Date.now() / 1000)
	const line = `flock reports muse #${token} of MUSEGOD: ${event} ${url}. Signed at ${at}.`
	const signature = await account.signMessage({ message: line })
	const res = await fetch(`https://musegod.org/api/v1/muses/${token}/worlds`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ place: 'flock', event, url, at, signer: account.address, signature }),
	})
	if (!res.ok) console.warn('sync failed', res.status, await res.text())
}
```

Call it after the write it reports has committed, never before, and never with a response waiting on it. On Cloudflare Workers that is `ctx.waitUntil(report(...))`. Return early when the secret is missing, so a deployment without a key does nothing rather than throwing.

Two habits worth keeping on top of that. Report one token per call, or a batch when there are many. And if the same code runs in more than one deployment, guard the call so only the deployment holding the key reports.

## Running the receiving half

A collection that wants places to report to it needs one endpoint, a registry of addresses, and its `/.well-known/agent-places.json`. The checks, cheapest first:

1. The event is one of the five, an `active` carries its count, a `did` its kind and ref, and the body carries no hide.
2. A key is registered for that place. If not, answer 403 and stop.
3. `at` is a whole number within ten minutes of now.
4. `signer` is an address, and it is one of the keys registered for that place.
5. `url` matches the pattern held for that place.
6. The signature recovers to `signer` over the line rebuilt from the body's own fields, in the form the body asks for (`asset` given, or not).
7. Only then read the holder from the chain, and store the report.
8. Fold it into the record and log its line, unless it was a dry run.

A batch runs the same checks on each report in turn, after one Multicall3 read for every holder in it, and answers each report on its own.

Keep the crawl. A place can lose a report, a deployment can go down with its queue, and what makes the record whole again is reading the place's public list on a schedule. The push is the fast path, not the only one.

## How it grows

Within 0.1 every change is additive: a new field, a new event, a new place, a new collection running its half. Nothing a place sends today stops working. A change to the meaning of a line or an event would be 0.2, named in the collection's file, with 0.1 still answered beside it.

What 0.1 has grown so far, each without breaking a place that was already sending: the `active` and `did` events, each token's record, the CAIP-19 line, two keys a place while it rotates, a place's own file and its directory fields, the holder's opt-out, calls both ways, the agent file's `agent-places` service, the dry run, unchanged answers and each place's health read, reports landing at once, the moves and happenings feeds and the log.

Proposed next, not live yet:

- One shape for a place's public list (the tokens it has, with their pages, when each was last there and its week), so the crawl reads every place with one reader instead of one per place.
- Approved places kept as data rather than code, so a new place goes live on approval without a deploy.

Say what you'd want from it in [the Discord](https://discord.gg/musegod) or at ryan@musegod.org.
