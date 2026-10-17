# B2C recovery checkpoint — 17 October 2026

Repository: `luxardodigiwork-sys/luxardo-website` (singular). This is an audit checkpoint, not a production release or a claim that all divergent branches have been merged.

## Selected runtime

The starting commit is `5c5087aa829fabfbcf70410431777c69f8edcf64` on `claude/upbeat-fermat-un7uz1` (PR #4). Its 28 commits after `main` contain the latest phone-authenticated checkout, server pricing in integer paise, stock reservation/release-once, webhook/verification guards, payment reconciliation, staff custom claims, private order metadata, Resend queue and content publishing tests.

Keep these business and safety decisions: Ready-to-Stitch fabric only; stitching is not included; sizes determine fabric/panels. India first. Prime and Express-dependent UI remain disabled. Checkout remains disabled until later staging/provider verification. Hosting deployment is manual and separate from Functions/rules/index deployment. No project aliases, credentials, live data or provider configuration were changed here.

## Included in this checkpoint

- All code already present at the selected baseline, with its original history.
- Adapted secondary-page lazy loading from `launch/cleanup` (`dc56fa2`) into the current guarded route tree. Providers, routes and auth guards retain their existing architecture.
- Adapted new-image compression from `launch/cleanup` (`489f44b`, `f051371`): cap the longest edge, encode WebP with JPEG fallback, use the encoded filename/content type. Existing photos are untouched; original upload remains an explicit option. New tests cover portrait dimensions, no upscaling and JPEG fallback.
- Handle download-URL retrieval failure so the uploader does not remain stuck.
- Recovered cleanup safeguards from PR #2/#3: exclude local databases, service-account files, private key files and CLI artifacts. Remove the tracked database, stale auth/rules backups and Firebase cache from this branch's current tree. Original refs/history remain intact.
- Remove Vite's server API-key replacement. Server-only configuration is not injected into client assets by that define.
- Repair literal newline escapes and stale deployment/email/index instructions in the existing launch documents.
- Record every observed remote branch head and changed-path inventory in `recovery-branches-2026-10-17.json`. This inventory contains paths and SHAs only, not credentials or copied divergent code.

## Preserved but not integrated wholesale

| Source | Recorded head | Decision and remaining comparison |
|---|---|---|
| `main` | `62af84d1f6854c5c00416819ccddc09c942ad699` | Existing default branch; unchanged. Selected baseline descends from it. |
| `claude/upbeat-fermat-un7uz1` | `5c5087aa829fabfbcf70410431777c69f8edcf64` | Selected baseline. Original branch and PR #4 unchanged. |
| `launch/cleanup` | `31c4efce867eeabc20043c92ff36274047c3db8d` | Diverges at main: 89 commits absent from the selected baseline. Compatible upload/lazy-loading/cleanup ideas adapted. Guest/COD checkout, V2 callables, staff identity, collection schema, deployment automation, tracking configuration, redesign and bulk photo optimiser require separate comparison; they are not silently applied. |
| `launch/oct11` | `57281b119245c5de82c0896112592abad9dccd78` | Ancestor of cleanup; alternate checkout/email transition preserved there. |
| `b2c-only` | `a1d70ab555f7a502af79b66a84dc800a54c46771` | Ancestor of cleanup; earlier B2C split preserved there. |
| `codespace-verbose-parakeet-q7jgqr6v9jw429x6w` | `0dad672182c180a8c9905546c226bb0689ed8224` | Earlier content/hero/collection work already in cleanup ancestry; compare UI/content contracts before porting. |
| `claude/keen-meitner-xfkq37` | `e9c6446e14face7656d7f47fcb44478e3c7752b9` | Separate branding/country/security branch. Current baseline already has environment-based server credential handling. Do not mass-replace identifiers/domains/storage keys or enable country auto-detection without resolving India-first behavior. Database cleanup adapted here. |
| `phase1-production-foundation` | `777a3da6a79ac7b63b889c8af3a083d2bd329c3b` | Flow production workflows, not merged into this B2C runtime. PR #1 preserved. |
| `flow-main` | `5a52d36b2564e24c5a508496fec5e01d6971adfb` | Flow-specific CI/workflow changes; no deployment/workflow substitution into B2C. |
| `conflict_210426_1413` | `d2660be26209a561d1964aa0bd3450f2e85e8e3e` | Unrelated Git history containing an alternate Python/React stack. Preserve, do not merge over the existing React/Firebase B2C architecture. |

No source branches or PRs were deleted, closed, force-pushed or merged. The manifest is a recovery map, not a merge commit and not proof that deferred changes are present in the runtime.

## Validation boundaries

Local environment: Node 24.19.0, Java 17. Dependency installs succeeded for root and Functions.

- `npm run lint`: passed.
- `npm run test:unit`: 125 passed, zero failures (122 existing plus 3 compression tests).
- `npm --prefix functions run build`: passed.
- `VITE_CHECKOUT_ENABLED=false npm run build`: passed; route chunks emitted.
- `git diff --check`: passed.
- Targeted current-tree credential-pattern scan: no credential-shaped live values identified; fixture-only matches reviewed. This is not proof that the Git history is free of secrets.
- `npm run test:rules`: blocked before tests by Java 17; Firebase CLI requires Java 21+. Other local emulator suites are not claimed as run. A Java 21 runtime download failed in this environment.
- GitHub CI on the draft PR must confirm rules, orders/stock, publishing, notifications and Functions emulator suites on the pushed commit. Do not reuse the baseline's green status as the result of this checkpoint.
- Original baseline CI run `38991117754` passed; preview and production skipped. It is historical evidence only.

No live Google/OTP, Razorpay, Resend, Firebase deployment, shipping, DNS or product-content verification occurred. No browser end-to-end upload test occurred; compression tests use a controlled canvas/bitmap harness. Existing unrelated runtime issues require the next focused audit, not a claim of completion here.

## Remaining audit work

1. Review the divergent B2C UI/content/schema and collections work against this fixed checkpoint; port compatible pieces individually with tests. Decide guest/COD versus the selected phone-authenticated checkout explicitly before changing it.
2. Review bulk photo optimiser before exposing it: it writes multiple documents and must respect current content publishing/product stock guards. It is not included here.
3. Scan historical commits and rotate any previously exposed credentials through the appropriate account owner. Removing the database from the tip does not remove password hashes from history; no history rewrite or credential rotation occurred.
4. Verify staging project alias, real Firebase claims/rules/indexes and provider settings later. Do not enable checkout or deploy production as part of the checkpoint audit.
5. Review legacy scripts and legacy Express code before running or deploying them. They are retained for recovery and are not the selected production backend.
