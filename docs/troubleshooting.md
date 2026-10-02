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

- Sound defaults to off. Turn it on in the HUD's gear panel or on the Plugins-page configuration section, and use 试听 / **Preview** there to check it before enabling; browser autoplay rules can still defer audio until a user gesture.
- `animation: off` and the operating system's reduced-motion preference disable decorative motion. The functional countdown continues to shrink.
- Particles require `particles: true` and the configured `powerThreshold` and `effectFrequency`. The defaults trigger an effect on each call.

## The configuration section is missing from the Plugins page

1. The section exists only while the Host serves the `dsh-combo` settings namespace, which requires the Host half that exports the Schemastery `Config`. Host plugin code is cached per process: after changing `index.js`, restart the profile instead of relying on HMR.
2. The section belongs to the Plugins page, which declares the slot while it is mounted; reopen or reload the page if the manager mounted after the plugin did.
3. A remote (non-loopback) Web deployment keeps settings in memory and serves no namespaces, so the page does not appear there. The HUD's gear panel still works on that page.

## A saved setting does not take effect

1. The HUD merges this browser's quick-tune overrides over the profile config. Saving the same key from the Plugins page clears that override; changing it again in the gear panel afterwards wins again. Use **恢复默认设置** in the gear panel to drop every local override.
2. Watch the line under the configuration section: a save reports 已保存到 profile 配置，立即生效, while a conflict or a refused value reports an error and reloads the current values.
3. A setting edited by hand in `cordis.patch.yml` needs a profile reload; a setting saved from the page applies live.
4. Sound is stored as `sound: true` plus `soundVolume` and `soundFrom`; a volume of `0` is silence by design.
