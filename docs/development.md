# Development notes

`dsh-combo` is an out-of-tree DSH bundle. The package root is the bundle boundary: `package.json` declares `dsh.bundle` and `dsh.client`, and `cordis.patch.yml` inserts the Host row. The Host entry and Client factory share the `dsh-combo` identity.

## Runtime path

1. The Host plugin registers the `dshCombo` unit with `ctx.sessionProjections`.
2. The unit increments on committed `tool/call` events and clears at `turn/start` or `turn/end`. It publishes `{ combo, tool, changedAt }` as the Client view.
3. The Client plugin registers a component in `shell.overlay` through `ctx.slots.inject()`.
4. `uiSession.adapter.current` is the root adapter's observable current binding. The binding's `key` identifies the Session; `sessions.binding(id).session.projections.faceOf('dshCombo')` returns the projection observable.
5. `/dsh-combo/config` serves the validated row config to the browser. If that route is unavailable, the Client uses its local defaults.

The two `inject` declarations have different roles:

- `dsh.client.inject` in `package.json` lists Client package relationships. It is manifest metadata, not Cordis activation order.
- `export const inject` in `client.js` lists runtime Cordis services. Those services gate `apply()`.

The package exports both `./client` and `./package.json`. The former is the Client module bundle; the latter lets package resolvers inspect `dsh.client` metadata where package self-exports are enforced. Ordinary feature plugins should omit `dsh.client.immediately`; DSH reserves that stage-one preload mark for boot infrastructure.

## Local checks

Run the unit tests with `npm test`. They use small local shims for React and Schemastery so the pure Host fold and Client rendering logic can be exercised without booting DSH. They do not replace a live Client smoke check.

For an integration smoke check, install this checkout into a disposable or development profile, inspect `dsh --profile <profile> --dump-config`, start that profile, and confirm the HUD appears after a tool call and disappears at turn end. The same Client module is used by the Web profile and DSH Desktop's embedded Web UI; Desktop installs use the `desktop` profile. Repeat with `enabled: false` and with an idle timeout if those options changed.

The public DSH contract references are linked from the main README. DSH is in developer preview; if an upstream contract changes, update the implementation, fixture, and these notes together.
