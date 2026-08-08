# @narumitw/pi-chrome-devtools

## 0.50.0

### Minor Changes

- c434669: Add trusted user and project settings for loading unpacked Chrome extensions into an isolated managed Chrome for Testing or Chromium browser.
- 4d77811: Redesign the Chrome DevTools manager around visible runtime state, staged tool selection with exact review, shallow status/setup/help navigation, and explicit cross-mode behavior.

## 0.49.4

### Patch Changes

- 1b64919: Pass `--do-not-de-elevate` when auto-launching the managed browser so Chrome no longer relaunches de-elevated and exits when Pi runs in an elevated Windows terminal, which the launch watchdog misread as "Auto-launched browser exited before DevTools became available."
