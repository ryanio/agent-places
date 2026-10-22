# AGENTS.md

Agent Places: an open spec for where agent NFTs live across the web, with its schemas, test vectors, a reference library (npm `agent-places`) and a site with a checker at ryanio.github.io/agent-places.

## Layout

| Path | What |
| --- | --- |
| `spec/agent-places-0.1.md` | The spec, canonical. musegod.org/docs/sync (`apps/web/docs/sync.md` in ryanio/musegod) follows it. |
| `schemas/` | JSON Schema (2020-12) for the collection file, a place's file, a report, a batch and a collection's call. |
| `vectors/vectors.json` | Every signed line, signed with viem by a test key. The library's tests hold it to these byte for byte. |
| `src/index.ts` | The library: line builders, EIP-191 signing and recovery on noble, `checkPlaceFile`, `placeFile`, `report`, `checkCallback`. |
| `src/cli.ts` | `npx agent-places check <origin>`. |
| `site/` | The site, published by `.github/workflows/pages.yml` with the built library at `lib/`. |

## Commands

```sh
npm install
npm run verify      # typecheck, tests, build
npx agent-places check https://terrakin.org
```

## Rules

- The spec, the schemas, the vectors and the library change together. A new line or field gets a vector, a schema entry and a test in the same push.
- Vectors are signed with viem, never with this library, so the tests compare two implementations. To add one, sign it with viem (`privateKeyToAccount(key).signMessage`) and paste the result in.
- Within 0.1 every change is additive: a reader ignores fields it doesn't know, and nothing a place sends today stops working. A change in meaning is 0.2.
- Push to `main` after `npm run verify`. CI runs the same.
- Releases publish to npm by trusted publishing from `.github/workflows/publish.yml` on a GitHub release. No npm token is stored anywhere; the package's trusted publisher on npmjs.com names this repo and that workflow.
- The site uses Ryan's Google Analytics property (G-YESTDWZKCL, the same as ryanio.github.io), loaded only when the page is served from ryanio.github.io, so local and preview views report nothing.
- Plain punctuation in prose: commas, periods, colons, never em dashes.
