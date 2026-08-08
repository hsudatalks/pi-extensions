# 🖼️ pi-image-drop — Browser Image Staging for Pi

[![npm](https://img.shields.io/npm/v/@narumitw/pi-image-drop)](https://www.npmjs.com/package/@narumitw/pi-image-drop) [![Pi extension](https://img.shields.io/badge/Pi-extension-blue)](https://pi.dev) [![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)

`@narumitw/pi-image-drop` adds one menu-first `/image-drop` command to the latest [Pi Coding Agent](https://pi.dev). Its **Open staging page** action serves a private loopback page where you can paste, drop, choose, preview, reorder, retry, and remove local images. The ordered batch is attached to your next non-empty interactive Pi message.

The page never contains a prompt or Attach button: Pi remains the only place where messages are written and sent. Its React and TypeScript frontend uses Radix Themes, Primitives, Colors, and Icons, and ships as local bundled assets with no CDN or runtime build step.

## ✨ Features

- Stages pasted, dropped, or selected images on a private loopback page.
- Preserves an ordered batch for the next non-empty interactive Pi message.
- Previews, reorders, retries, and removes images before submission.
- Supports PNG, JPEG, WebP, GIF, BMP, TIFF, HEIC/HEIF, and AVIF input.
- Applies orientation, strips private metadata, and enforces Pi-compatible image limits.
- Keeps bounded sent-image history for explicit re-attachment during the live session.
- Uses Radix UI for an adaptive light/dark design system, accessible dialogs and disclosures, semantic colors, and consistent action icons.
- Opens a side-effect-free standard TUI menu with current draft state, Status, Settings, and Help.
- Reports batch state above Pi's editor and can start automatically with each session.

## 📦 Install

```bash
pi install npm:@narumitw/pi-image-drop
```

Try the working tree without installing:

```bash
pi -e ./packages/pi-image-drop
# or
just try image-drop
```

This package targets the latest Pi release and uses its `agent_settled` lifecycle event. Older Pi releases are not supported.

## 🚀 Workflow

1. Run `/image-drop` in an interactive Pi session. The command opens a menu without starting the browser service or changing a link.
2. Choose **Open staging page**. Pi prints and displays a clickable one-time `http://127.0.0.1:<port>/...` link. The extension does **not** open a browser, including when session startup is enabled.
3. Open the link. Paste images anywhere, drop files, or select **Choose images**.
4. Review previews and processing details. Drag to reorder, use the keyboard-accessible arrow buttons, retry failures, delete individual items, or use confirmed **Clear all**.
5. Write and submit a non-empty message in Pi. The ready images are appended after any attachments already on that message, in browser order.
6. After Pi records that user message, the sent images move to **Previously sent**. They are not attached to later prompts unless you explicitly choose **Add again**. You can preview, re-add, delete, or clear retained images from the browser page.

The `🖼️` widget above Pi's editor reports ready, uploading, error, and queued counts. Uploading or failed items block the whole batch and preserve the Pi editor text. Image-only messages are not supported.

By default, the loopback service starts lazily only when you choose **Open staging page**. With `startOnSessionStart: true`, it starts after each Pi session initializes and displays the link in Pi automatically. A later Open action reuses the service. If the previous one-time link is still unused, Image Drop previews that it will be invalidated and asks before creating another; cancellation leaves the existing link unchanged. A browser refresh keeps the current in-memory batch and sent-image history. Opening the authenticated page in another tab gives the new tab the editing lease and makes the old tab stale. Reloading, replacing, forking, or shutting down the Pi session releases both the draft and all retained history.

## 💬 Command menu

Run `/image-drop` without arguments in TUI mode. The standard menu shows the current draft and
service state, then offers:

- **Open staging page** — start or reuse the private browser service and create a one-time link.
- **Status** — inspect draft readiness, sent-history usage, model image support, Pi image policy, and auto-resize behavior.
- **Settings** — configure automatic startup or review advanced resource limits.
- **Help** — review the send workflow, privacy lifecycle, and remote forwarding guidance.
- **Close** — return to Pi without side effects.

Use the configured navigation and confirmation keys. Escape returns from a standard subview or closes
the main menu; Ctrl+C closes from any menu level. Status, settings, limits, and help share one
lifecycle-owned navigation flow. Resource-limit entry and save review use standard declarative
screens with rejected-draft retention and exact bounded content. Cancellable loaders remain
extension-owned; link rotation uses Pi TUI Kit's standalone Confirm/Back/Close contract while Image
Drop retains ownership of link invalidation. `/image-drop` accepts no arguments. The interactive menu is unavailable
in RPC, JSON, and print modes and rejects those invocations before starting the service; manual
settings remain available through the JSON file below.

## 🖼️ Supported images

| Input | Provider-ready output |
| --- | --- |
| PNG | PNG |
| JPEG | JPEG |
| WebP | WebP |
| GIF, including animation | GIF |
| BMP | PNG |
| TIFF | PNG |
| HEIC/HEIF | PNG |
| AVIF | PNG |

Detection uses file signatures, not filenames or browser MIME types. SVG, HTML, remote URLs, unknown formats, corrupt files, and images over the configured pixel limit are rejected.

The processor applies orientation and removes EXIF (including GPS), XMP, IPTC, comments, and other sensitive metadata. It retains an ICC color profile and animated GIF timing where the output format supports them. With Pi's `images.autoResize` enabled (the default), output is reduced to fit Pi's 2,000-pixel and approximately 4.5 MiB Base64 inline limits. With it disabled, output that exceeds either limit fails visibly instead of being resized.

## ⚙️ Configuration

Image Drop has one optional **global-only** JSON file. In TUI mode, choose **Settings** from `/image-drop` for guided editing, or edit the same file manually:

```text
${PI_CODING_AGENT_DIR:-~/.pi/agent}/pi-image-drop.json
```

Example:

```json
{
  "startOnSessionStart": true,
  "maxImages": 8,
  "maxImageBytes": 10485760,
  "maxBatchBytes": 41943040,
  "maxImagePixels": 50000000,
  "maxRetainedImages": 128,
  "maxRetainedBytes": 536870912
}
```

| Setting | Default | Behavior |
| --- | --- | --- |
| `startOnSessionStart` | `false` | Start the loopback service and display a link after each Pi session initializes. This never opens a browser. |

| Limit setting | Safe default | Hard ceiling |
| --- | ---: | ---: |
| `maxImages` | 8 | 32 |
| `maxImageBytes` | 10 MiB | 50 MiB |
| `maxBatchBytes` | 40 MiB | 200 MiB |
| `maxImagePixels` | 50 megapixels | 100 megapixels |
| `maxRetainedImages` | 128 | 256 |
| `maxRetainedBytes` | 512 MiB | 1 GiB |

Settings saved from the menu are written atomically, preserve unknown fields, and apply to future Pi sessions; the current draft and history are never rebuilt or discarded to apply new limits. Automatic-start changes save immediately, and leaving Settings waits for an in-progress save. Resource-limit changes remain a preview until **Review changes before saving** is confirmed; cancelling a field, preview, or unsaved limits menu writes no resource-limit change. If saving fails, the previous file and effective session settings remain active and the menu reports how to retry.

`maxRetainedImages` and `maxRetainedBytes` govern how much sent history can coexist with the current draft, using combined image-count and resident-byte accounting. When either limit is reached, Image Drop removes the oldest sent-history entries first until the new draft fits. It never automatically removes the active or queued draft and does not reject a new image merely because retained history is full; the draft remains independently bounded by the batch limits above.

Limit values are positive integer counts/bytes/pixels, and `startOnSessionStart` must be a boolean. `maxImageBytes` cannot exceed `maxBatchBytes`. Unknown fields are ignored by this version and preserved by menu saves for forward compatibility. Malformed JSON, invalid recognized values, symlinks, files larger than 64 KiB, or values above a hard ceiling cause the **whole file** to be ignored with one warning and safe defaults to be used; the menu will not overwrite an invalid file. Limit values above a safe default but within a hard ceiling produce a memory/provider-limit warning.

At upload and submission time, the extension also re-reads Pi's documented global and trusted-project `images.autoResize` and `images.blockImages` settings. `blockImages: true` or a text-only current model blocks processing/submission without discarding the draft.

## 🔐 Security and privacy

- The HTTP listener binds only to a random `127.0.0.1` port.
- A rotating bootstrap token is exchanged once for an HttpOnly, `SameSite=Strict` session cookie, then removed from the URL.
- Exact Host, mutation Origin, session-cookie, and active-client checks are enforced. No permissive CORS headers are sent.
- Pages use a restrictive Content Security Policy plus no-store, no-referrer, MIME-sniffing, and frame-denial headers.
- Raw request bodies, decoded pixels, source bytes, previews, and provider-ready bytes are bounded and stay in the Pi process memory. The extension creates no image cache, temporary image files, browser storage, or session-file entries.
- After Pi records the matching user message, only sanitized provider-ready bytes and display metadata move to sent history; original uploaded source bytes are released. History remains available for preview and explicit re-adding until you delete it, FIFO retention limits remove it, or the Pi session reaches reload, replacement/fork, or shutdown.
- Once Pi records a message, normal Pi/provider retention rules apply independently of deleting Image Drop's in-process history.

A loopback page is local to your operating-system network namespace. Do not expose the port to a LAN or public interface.

## 🖥️ Platforms, browsers, and remote environments

The supported local targets are current macOS, Windows, desktop Linux, and WSL with current stable Chrome, Edge, Firefox, or Safari where those browsers are available. Native `sharp` packages are installed for the current platform; HEVC-backed HEIC and BMP use bounded portable decoders because the patent-safe prebuilt `sharp`/libvips bundle omits them.

WSL normally forwards loopback to Windows automatically; always use the printed `127.0.0.1` URL rather than changing it to `localhost`. For SSH, a container, or a devcontainer, forward the exact printed port and preserve the Host value. If Pi prints port `45678`, for example:

```bash
ssh -L 45678:127.0.0.1:45678 user@remote-host
```

Then open the unchanged `http://127.0.0.1:45678/...` link locally. Image Drop does not provide a cloud relay or remote upload endpoint.

## 🚧 Limitations

- Only the argument-free `/image-drop` menu is registered; there is no `/image-drop open` or `/image-drop clear` textual route.
- A non-empty interactive Pi message is required. RPC, extension-generated, slash-command, and image-only inputs do not consume the batch.
- All items must be ready. One uploading or failed item blocks submission until it is retried or deleted.
- Provider aggregate request limits vary. Raising the defaults to the hard ceilings does not guarantee that a provider accepts the final multi-image request.
- Sent history exists only for the current live Pi session. It is not reconstructed from the transcript, persisted across sessions, or shared with another Pi process.
- FIFO retention can remove the oldest sent images automatically at the configured count or memory limit; the browser displays the current usage and limit.

## 🗂️ Package layout

```text
src/index.ts            Pi package entrypoint
src/image-drop.ts       extension registration and command orchestration
src/runtime.ts          Pi lifecycle, lazy capabilities, and message orchestration
src/interactive-ui.ts   lazy menu and standalone-confirmation Pi TUI Kit boundary
src/menu.ts             limit input/review projections, menu-state helpers, and loader
src/format.ts           lightweight byte formatting shared by runtime and menus
src/batch.ts            in-memory draft and sent-history state machine
src/images.ts           bounded queue with codecs loaded on first image processing
src/server.ts           lazily loaded authenticated loopback HTTP/SSE server
src/settings.ts         extension settings
src/pi-settings.ts      effective Pi image settings adapter
src/web/ui/             authored React and TypeScript browser source
src/web/app.js           generated bundled React application
src/web/state.js         generated compatibility helper module
src/web/styles.css       generated Radix Themes, Colors, and local styles
src/web/index.html       minimal authenticated React shell
```

## 🧪 Development

From the repository root:

```bash
npm --workspace @narumitw/pi-image-drop run build:web
npm --workspace @narumitw/pi-image-drop run check
npm test
just try image-drop
just pack image-drop
```

Edit browser code under `src/web/ui/`, then run `build:web`. The package typecheck runs `check:web`, which rebuilds in a temporary directory and rejects stale generated assets. The dry-run package must contain the manifest, license, README, TypeScript/TSX sources, and bundled static web assets, but no tests, fixtures, image bytes, build scripts, or `node_modules`.

## 🚀 Publishing

The first publication is intentionally a maintainer action:

```bash
npm publish --workspace @narumitw/pi-image-drop --access public
```

`just npm-public` only changes visibility after a scoped package already exists. Do not publish from an implementation or verification run.

## 🔎 Keywords

Pi extension, Pi Coding Agent, browser image staging, image prompt, local image upload, metadata removal, local-first AI coding agent.

## 📄 License

MIT. See [`LICENSE`](./LICENSE).
