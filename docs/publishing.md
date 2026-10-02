# Publishing to npm

`dsh-combo` installs through two official channels: the GitHub spec
(`dsh plugin --profile web add github:QuentinCrane/dsh-combo`) and, once this
package is on npm, the registry spec (`dsh plugin --profile web add dsh-combo`).
The registry channel is worth having because npm mirrors serve mainland China
networks that cannot reach `codeload.github.com`, and because the DSH Plugin Hub
directory can record a bare package name.

The release workflow (`.github/workflows/release.yml`) publishes both: it runs
the tests, publishes the version to npm when `NPM_TOKEN` is configured, and then
creates the GitHub release with the packed tarball attached.

The official guide's rule applies here: a git install fetches sources, and a
package that needs a build must then ask the user to allowlist its `prepare`
script. This package ships runnable JavaScript with no `prepare` script, so the
GitHub channel needs no allowance — and the registry channel needs no allowance
either, while being reachable through npm mirrors. The attached tarball is the
third form: `dsh plugin --profile web add ./dsh-combo-<version>.tgz`.

## One-time setup

1. Confirm the name is still free: `npm view dsh-combo version` must answer
   `E404`. The unscoped name was unclaimed on 2026-10-02.
2. Create a token that can publish without an interactive 2FA prompt:
   npmjs.com → **Access Tokens** → **Generate New Token** → **Automation**
   (classic), or a **Granular Access Token** with *Read and write* package
   permissions and *Bypass 2FA* enabled.
3. Store it in the repository: **Settings → Secrets and variables → Actions →
   New repository secret**, name `NPM_TOKEN`.
4. Optional, no-secret alternative: configure npm **Trusted Publishing** for
   `dsh-combo` (npmjs.com → package or *pending publisher* → GitHub Actions,
   owner `QuentinCrane`, repository `dsh-combo`, workflow `release.yml`). The
   job already requests `id-token: write`, so once the npm CLI is 11.5.1 or newer
   the same `npm publish` call authenticates through OIDC and `NPM_TOKEN` can
   stay unset. Raise the workflow's Node version if its bundled npm is older.

Without either credential the publish step prints a notice, skips, and the
GitHub release step still runs — the workflow never fails for a missing token.

## Cutting a release

1. Bump `version` in `package.json`.
2. Add a matching `## <version> ` section to `CHANGELOG.md`; the workflow fails
   the GitHub release step when the section is missing.
3. Push to `main`. A `package.json` change on `main` triggers the workflow, and
   **Actions → Publish release → Run workflow** triggers it manually.

The manual run is also how the current version gets backfilled: the npm step
publishes whatever `package.json` says when that exact version is not on the
registry yet, while the GitHub release step exits early for an existing tag.

Publishing is idempotent per version — an already-published `dsh-combo@<version>`
is skipped, so re-running a release never fails on a duplicate. The step uses
`--provenance`, which attaches a signed attestation tying the tarball to the
workflow run and commit; it needs the public repository and `id-token: write`.

## Verify a release

```sh
npm view dsh-combo version dist.tarball
curl -s https://registry.npmmirror.com/dsh-combo | head -c 200   # mirror sync

dsh plugin --profile web add dsh-combo
dsh --profile web --dump-config | grep -A3 dsh-combo
```

The package ships runnable JavaScript with no `prepare` or install-time build
script, so what npm publishes equals the checkout; `npm pack --dry-run` shows
the 13 files that go out.

## After the first npm release

Add the registry channel to both READMEs, keeping the GitHub command as the
fallback:

```sh
# DSH Web UI
dsh plugin --profile web add dsh-combo

# DSH Desktop (quit the app first)
dsh plugin --profile desktop add dsh-combo
```

The DSH Plugin Hub directory records the install command it finds in the README,
so the next crawl picks the npm form up; no new submission is needed.

## Failure handling

| Symptom | Cause and fix |
|---|---|
| `EOTP` or `403` on publish | The token is a classic *Publish* token that still asks for 2FA. Use an *Automation* or *Granular* token with *Bypass 2FA*. |
| `E404` on publish | The token lacks package write permission, or `.npmrc` was never written — keep `registry-url` in the `setup-node` step so `NODE_AUTH_TOKEN` is consumed. |
| `EPUBLISHCONFLICT` / "cannot publish over" | That version already exists on npm. Bump `package.json`; the workflow only skips the exact version it read. |
| Provenance error | The repository must be public and the job needs `id-token: write`. |
| Broken release | `npm unpublish dsh-combo@<version>` within 72 hours, then delete the GitHub release and tag. |

## Local dry run

```sh
npm pack --dry-run      # tarball contents and size
npm publish --dry-run   # what npm would upload for this version
```

A real local publish (`npm login` followed by `npm publish --access public`,
without `--provenance`) is only a fallback when CI is unavailable; prefer the
workflow so the release carries provenance.
