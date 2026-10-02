# Troubleshooting

## The combo HUD is missing

1. Confirm the profile includes the `dsh-combo` bundle layer with `dsh --profile <profile> --dump-config`.
2. Confirm the row is enabled and the profile runs a DSH Client UI. This includes the Web profile and DSH Desktop's embedded Web UI. The module declares `platform: web` because that is the DSH Client module contract.
3. Confirm this is an active Session and at least one tool call has been committed. The HUD stays hidden at zero and after an unpinned run closes.
4. Reload or restart the profile after installing or changing the package, unless HMR has already applied the update.
5. Check that `package.json` exports both `./client` and `./package.json`, and that the `dsh.client` entry name, Host row name, and `window.__ModuleLoader__.load({ id })` all resolve to `dsh-combo`.

## The HUD appears, but the count does not change

The Host row must be enabled in the same profile and must be able to inject `sessionProjections`. The Client reads the current Session identity from `uiSession.adapter.current`, then subscribes to the Session face at `sessions.binding(id).session.projections.faceOf('dshCombo')`. Avoid substituting undocumented `uiSession.current` or `sessions.projectionStore()` APIs; neither is part of the current public Client contract.

Only `tool/call` events count. `tool/result`, messages, and turn boundaries do not increment the counter. Check `excludeTools` and `expireMs` if a count starts at one or disappears sooner than expected.

## The tool label is missing

Set `showToolName: true`. The label is hidden when there is no current tool name, when the count is zero, or while the finished-run prompt has no associated tool.

## Sound or motion is missing

- Sound defaults to off. Set `sound: true`; browser autoplay rules can still defer audio until a user gesture.
- `animation: off` and the operating system's reduced-motion preference disable decorative motion. The functional countdown continues to shrink.
- Particles require `particles: true` and the configured `powerThreshold` and `effectFrequency`. The defaults trigger an effect on each call.
