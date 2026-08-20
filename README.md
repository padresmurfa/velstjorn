# Vélstjórn C → D

A single-page study plan for the Vélstjórn programme at Tækniskólinn / Véltækniskólinn,
mapping the route from haustönn 2026 to vélfræðingur (STCW A-III/2).

**The page contents are encrypted.** This repository holds only the ciphertext; the
plan is decrypted in the browser from a key supplied in the URL. Without the key the
page renders a locked state and nothing else — the plaintext is never in this repo and
never reaches the server.

## How it works

| File | |
|---|---|
| `index.html` | Shell — fonts, stylesheet, empty mount point |
| `app.js` | Reads the key from the URL, fetches and decrypts the payload, renders the page |
| `data.enc.json` | AES-256-GCM ciphertext, with the PBKDF2 salt and GCM IV |
| `build.js` | Encrypts a local plaintext JSON into `data.enc.json` |

Key derivation is PBKDF2-HMAC-SHA-256 at 250,000 iterations; encryption is AES-256-GCM,
so a wrong key fails authentication rather than rendering garbage. Salt and IV are
regenerated on every build. Decryption uses WebCrypto — no dependencies, no build
tooling, no framework.

The key is read from either `?key=…` or `#key=…`. **Prefer the fragment**: a fragment is
never sent to the server and does not appear in `Referer` headers, whereas a query string
does both.

## Rebuilding

The plaintext payload is deliberately kept outside this repository — it lives in the private
companion repo `padresmurfa/velstjorn-source`, along with the source curricula, the analysis
documents, and a validator that checks the plan is internally consistent before it ships.

```
PLAN_KEY='…' node build.js ../plan/plan-data.json data.enc.json
```

`build.js` refuses to run without `PLAN_KEY` and validates the input as JSON before
encrypting, so a malformed payload fails at build time rather than in someone's browser.

## Sources

Built from Tækniskólinn's published curricula as of 20 August 2026 — the VC25 and VD25
námsskipulag, the A-B-C-D námskrá, the 2026–2030 course offering calendar, and the TBR19
Tölvubraut námskrá — together with tskoli.is, Samgöngustofa and Slysavarnafélagið Landsbjörg.
