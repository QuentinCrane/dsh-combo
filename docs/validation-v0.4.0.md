# Release installation validation — v0.4.0

Validated on 2026-10-03 using the official DeepSeek Harness Desktop-bundled CLI, version `0.2.0-rc.2`, on macOS.

## Public distribution

- Repository: https://github.com/QuentinCrane/dsh-combo
- Release: https://github.com/QuentinCrane/dsh-combo/releases/tag/v0.4.0
- The public repository has the `dsh-plugin` topic for community-directory discovery.
- GitHub Actions validation and release jobs succeeded.
- A packaged `dsh-combo-0.4.0.tgz` is attached to the release.

## Official CLI installation and loading

A temporary `DSH_HOME` and an isolated profile initialized from the shipped Web template were used. The user's normal Desktop profile and credentials were not modified.

```sh
dsh --profile smoke --from-default-profile web --dump-config
dsh plugin --profile smoke add github:QuentinCrane/dsh-combo#v0.4.0
dsh --profile smoke --host 127.0.0.1 --port 38761 --no-open
```

Results:

- CLI installation completed successfully.
- The composed profile selected `@deepseek-ai/dsh-base`, `@deepseek-ai/dsh-web-app`, and `dsh-combo`.
- The real Host returned HTTP 200 from `/dsh-combo/config` with configuration revision 4.
- The real browser Client mounted one `data-dsh-combo-style` element, proving that the installed module was discovered and its overlay contribution rendered.
- The browser console reported no errors or warnings.
- The earlier v0.3.0 release also passed the same installation and loading checks.

pnpm reports the profile-local `@deepseek-ai/schemastery` peer as missing. This did not prevent installation or Host loading in the tested official bundled runtime, which provides the shared dependency. This validation does not establish compatibility with every future Harness version or exercise paid model calls.

## Directory status

`dsh-plugin.org` is a community-maintained directory, not an official DeepSeek store. Its discovery requirement has been met by adding the topic. A public listing was not yet available when checked; directory approval and refresh timing are controlled by that service. Official CLI installation already works independently of that listing.
