# Contributing

Thanks for helping improve `dsh-combo`.

## Before opening a change

- Keep the package name, Host row id, bundle patch row, and Client module loader id aligned.
- Keep the package exports for `./client`, `./cordis.patch.yml`, and `./package.json` in sync with the files shipped by the package.
- Use DSH's public Session Projection, Session Controller, Client Module, and Slot contracts. The main README links to the upstream references.
- Keep the Host fold pure and deterministic. UI-only state belongs in the Client.
- Update both README languages and `CHANGELOG.md` when user-visible behavior changes.

## Local workflow

```sh
npm test
dsh plugin --profile <development-profile> add link:/absolute/path/to/dsh-combo
dsh --profile <development-profile> --dump-config
```

Run the profile for a live Client smoke check after the local suite. The Client runs in both the Web profile and DSH Desktop's embedded Web UI. Tests use local runtime shims and do not prove compatibility with every DSH release.

## Releasing

Bump `version` in `package.json`, add the matching `## <version> ` section to `CHANGELOG.md`, and push to `main`. The release workflow runs the tests, publishes the version to npm when `NPM_TOKEN` is configured, and creates the GitHub release with the packed tarball. See [docs/publishing.md](docs/publishing.md) for the token setup, verification commands, and failure handling.

## Reporting a problem

Include the DSH version, profile surface (Web or Desktop Web UI), expected behavior, observed behavior, and the smallest relevant config. Remove private session content and credentials before sharing logs or screenshots.
