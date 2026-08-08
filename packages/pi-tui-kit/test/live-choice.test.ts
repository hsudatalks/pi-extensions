import assert from "node:assert/strict";
import test from "node:test";
import { stripVTControlCharacters } from "node:util";
import { type KeyId, matchesKey, visibleWidth } from "@earendil-works/pi-tui";
import { createMockContext } from "../../../test/support.js";
import { runLiveChoice } from "../src/index.js";
import { createRpcHarness, createTuiHarness } from "../src/testing/index.js";

const choices = [
	{
		id: "minimal",
		label: "Minimal",
		description: "Small output",
		details: ["Model and branch"],
	},
	{
		id: "blocked",
		label: "Blocked\u001b[31m",
		description: "Unavailable profile",
		disabled: true,
		disabledReason: "Missing\u0007 font",
	},
	{
		id: "full",
		label: "Full",
		description: "Everything",
		details: ["Model, tokens, tools, and time"],
	},
] as const;

test("runLiveChoice previews initial and cursor choices and dispatches enabled shortcuts", async () => {
	const previews: string[] = [];
	const tui = createTuiHarness({ width: 32, rows: 20 });
	const context = createMockContext({ mode: "tui", hasUI: true, custom: tui.custom });
	const running = runLiveChoice(context.ctx, {
		title: "Preset\u001b[2J picker",
		lines: ["Choose with a live preview."],
		items: choices,
		currentItemId: "minimal",
		initialItemId: "blocked",
		shortcuts: [{ id: "customize", keys: ["e", "shift+e"], label: "customize" }],
		onSelectionChange: ({ item }) => {
			previews.push(item.id);
		},
	});
	await tui.waitForOpen();
	await Promise.resolve();
	const frame = tui.render();
	const plain = stripVTControlCharacters(frame.join("\n"));
	assert.match(plain, /Minimal.*✓ current/u);
	assert.match(plain, /Blocked/u);
	assert.match(plain, /Unavailable: Missing font/u);
	assert.equal(frame.join("\n").includes("\u001b[2J"), false);
	for (const line of frame) assert.ok(visibleWidth(line) <= 32);
	assert.deepEqual(previews, ["blocked"]);

	tui.press("tui.select.confirm");
	assert.equal(tui.isOpen, true);
	tui.type("e");
	assert.equal(tui.isOpen, true);
	tui.press("tui.select.down");
	await Promise.resolve();
	tui.type("E");
	assert.deepEqual(await running, {
		kind: "shortcut",
		shortcutId: "customize",
		itemId: "full",
	});
	assert.deepEqual(previews, ["blocked", "full"]);
});

test("runLiveChoice omits shortcuts that conflict with remapped standard controls", async () => {
	const bindingKeys = (binding: string): KeyId[] => {
		switch (binding) {
			case "tui.select.up":
				return ["up"];
			case "tui.select.down":
				return ["e"];
			case "tui.select.pageUp":
				return ["pageUp"];
			case "tui.select.pageDown":
				return ["pageDown"];
			case "tui.select.confirm":
				return ["enter"];
			case "tui.select.cancel":
				return ["escape", "ctrl+c"];
			default:
				return [];
		}
	};
	const tui = createTuiHarness({
		keybindings: {
			getKeys: (binding) => bindingKeys(binding),
			matches: (data, binding) => bindingKeys(binding).some((key) => matchesKey(data, key)),
		},
	});
	const context = createMockContext({ mode: "tui", hasUI: true, custom: tui.custom });
	const running = runLiveChoice(context.ctx, {
		title: "Preset",
		items: [choices[0], choices[2]],
		shortcuts: [{ id: "customize", keys: ["e", "return"], label: "customize" }],
	});
	await tui.waitForOpen();
	assert.doesNotMatch(tui.render().join("\n"), /customize/u);

	tui.type("e");
	tui.press("tui.select.confirm");
	assert.deepEqual(await running, { kind: "selected", itemId: "full" });
});

test("runLiveChoice shares wrapping, clamped paging, Home, and End selection semantics", async () => {
	const previews: string[] = [];
	const tui = createTuiHarness();
	const context = createMockContext({ mode: "tui", hasUI: true, custom: tui.custom });
	const running = runLiveChoice(context.ctx, {
		title: "Preset",
		items: choices,
		initialItemId: "minimal",
		viewportSize: 2,
		onSelectionChange: ({ item }) => {
			previews.push(item.id);
		},
	});
	await tui.waitForOpen();
	for (const input of [
		"tui.select.up",
		"tui.select.down",
		"tui.select.pageDown",
		"tui.select.pageDown",
		"home",
		"end",
	] as const) {
		tui.press(input);
		await Promise.resolve();
	}
	tui.press("tui.select.confirm");
	assert.deepEqual(await running, { kind: "selected", itemId: "full" });
	assert.deepEqual(previews, ["minimal", "full", "minimal", "full", "full", "minimal", "full"]);
});

test("runLiveChoice preserves Back, Close, stale ownership, and external disposal", async () => {
	async function drive(exit: "tui.select.cancel" | "ctrl+c") {
		const tui = createTuiHarness();
		const context = createMockContext({ mode: "tui", hasUI: true, custom: tui.custom });
		const running = runLiveChoice(context.ctx, { title: "Preset", items: choices });
		await tui.waitForOpen();
		tui.press(exit);
		return running;
	}
	assert.deepEqual(await drive("tui.select.cancel"), { kind: "closed", reason: "back" });
	assert.deepEqual(await drive("ctrl+c"), { kind: "closed", reason: "close" });

	const owner = new AbortController();
	const staleTui = createTuiHarness();
	const staleContext = createMockContext({ mode: "tui", hasUI: true, custom: staleTui.custom });
	const stale = runLiveChoice(staleContext.ctx, {
		title: "Preset",
		items: choices,
		signal: owner.signal,
	});
	await staleTui.waitForOpen();
	owner.abort(new DOMException("Session replaced", "AbortError"));
	assert.deepEqual(await stale, { kind: "stale" });

	const disposedTui = createTuiHarness();
	const disposedContext = createMockContext({
		mode: "tui",
		hasUI: true,
		custom: disposedTui.custom,
	});
	const disposed = runLiveChoice(disposedContext.ctx, { title: "Preset", items: choices });
	await disposedTui.waitForOpen();
	disposedTui.dispose();
	assert.deepEqual(await disposed, { kind: "stale" });
});

test("runLiveChoice blocks cursor previews after generation ownership becomes stale", async () => {
	let current = true;
	const previews: string[] = [];
	const tui = createTuiHarness();
	const context = createMockContext({ mode: "tui", hasUI: true, custom: tui.custom });
	const running = runLiveChoice(context.ctx, {
		title: "Preset",
		items: choices,
		isCurrent: () => current,
		onSelectionChange: ({ item }) => {
			previews.push(item.id);
		},
	});
	await tui.waitForOpen();
	current = false;
	tui.press("tui.select.down");
	tui.press("ctrl+c");
	assert.deepEqual(await running, { kind: "stale" });
	assert.deepEqual(previews, ["minimal"]);
});

test("runLiveChoice revalidates generation ownership after an awaited preview", async () => {
	let current = true;
	let release: () => void = () => undefined;
	const gate = new Promise<void>((resolve) => {
		release = resolve;
	});
	const tui = createTuiHarness();
	const context = createMockContext({ mode: "tui", hasUI: true, custom: tui.custom });
	const running = runLiveChoice(context.ctx, {
		title: "Preset",
		items: choices,
		isCurrent: () => current,
		onSelectionChange: async () => gate,
	});
	await tui.waitForOpen();
	current = false;
	release();
	assert.deepEqual(await running, { kind: "stale" });
});

test("runLiveChoice aborts and drains preview work while coalescing queued cursor changes", async () => {
	let release: () => void = () => undefined;
	const gate = new Promise<void>((resolve) => {
		release = resolve;
	});
	const started: string[] = [];
	let previewSignal: AbortSignal | undefined;
	const tui = createTuiHarness();
	const context = createMockContext({ mode: "tui", hasUI: true, custom: tui.custom });
	const running = runLiveChoice(context.ctx, {
		title: "Preset",
		items: choices,
		onSelectionChange: async ({ item, signal }) => {
			started.push(item.id);
			previewSignal = signal;
			await gate;
		},
	});
	await tui.waitForOpen();
	tui.press("tui.select.down");
	tui.press("tui.select.down");
	tui.press("tui.select.cancel");
	let settled = false;
	void running.then(() => {
		settled = true;
	});
	await Promise.resolve();
	assert.equal(settled, false);
	assert.equal(previewSignal?.aborted, true);
	release();
	assert.deepEqual(await running, { kind: "closed", reason: "back" });
	assert.deepEqual(started, ["minimal"]);
});

test("runLiveChoice reports current preview failures without leaking stale failures", async () => {
	const failure = new Error("Preview failed");
	let reported: unknown;
	const tui = createTuiHarness();
	const context = createMockContext({ mode: "tui", hasUI: true, custom: tui.custom });
	assert.deepEqual(
		await runLiveChoice(context.ctx, {
			title: "Preset",
			items: choices,
			onSelectionChange: () => {
				throw failure;
			},
			onError: (_ctx, error) => {
				reported = error;
			},
		}),
		{ kind: "error", error: failure },
	);
	assert.equal(reported, failure);
});

test("runLiveChoice degrades RPC to ordinary selection without preview or shortcuts", async () => {
	let previews = 0;
	const rpc = createRpcHarness([
		{
			kind: "select",
			options: [
				"Minimal — current · Small output",
				"[-] Blocked [31m — unavailable: Missing font · Unavailable profile",
				"Full — Everything",
				"← Back",
			],
			response: "Full — Everything",
		},
	]);
	const base = createMockContext({ mode: "rpc", hasUI: true }).ctx as unknown as {
		ui: Record<string, unknown>;
		[key: string]: unknown;
	};
	const context = { ...base, ui: { ...base.ui, ...rpc.ui } } as never;
	const result = await runLiveChoice(context, {
		title: "Preset",
		items: choices,
		currentItemId: "minimal",
		shortcuts: [{ id: "customize", keys: ["e"], label: "customize" }],
		onSelectionChange: () => {
			previews += 1;
		},
	});
	assert.deepEqual(result, { kind: "selected", itemId: "full" });
	assert.equal(previews, 0);
	rpc.assertConsumed();
});

test("runLiveChoice keeps disabled RPC rows inert and preserves deterministic Back", async () => {
	const options = [
		"Minimal — current · Small output",
		"[-] Blocked [31m — unavailable: Missing font · Unavailable profile",
		"Full — Everything",
		"← Back",
	];
	const rpc = createRpcHarness([
		{ kind: "select", options, response: options[1] },
		{ kind: "select", options, response: "← Back" },
	]);
	const base = createMockContext({ mode: "rpc", hasUI: true }).ctx as unknown as {
		ui: Record<string, unknown>;
		[key: string]: unknown;
	};
	const context = { ...base, ui: { ...base.ui, ...rpc.ui } } as never;
	assert.deepEqual(
		await runLiveChoice(context, {
			title: "Preset",
			items: choices,
			currentItemId: "minimal",
		}),
		{ kind: "closed", reason: "back" },
	);
	rpc.assertConsumed();
});

test("runLiveChoice gives stale ownership precedence over preview and RPC failures", async () => {
	const failure = new Error("Late preview failed");
	const owner = new AbortController();
	let release: () => void = () => undefined;
	const gate = new Promise<void>((resolve) => {
		release = resolve;
	});
	let reports = 0;
	const tui = createTuiHarness();
	const tuiContext = createMockContext({ mode: "tui", hasUI: true, custom: tui.custom });
	const running = runLiveChoice(tuiContext.ctx, {
		title: "Preset",
		items: choices,
		signal: owner.signal,
		onSelectionChange: async () => {
			await gate;
			throw failure;
		},
		onError: () => {
			reports += 1;
		},
	});
	await tui.waitForOpen();
	owner.abort(new DOMException("Session replaced", "AbortError"));
	release();
	assert.deepEqual(await running, { kind: "stale" });
	assert.equal(reports, 0);

	const rpcOwner = new AbortController();
	const rpc = createRpcHarness([{ kind: "select", waitForAbort: true }]);
	const base = createMockContext({ mode: "rpc", hasUI: true }).ctx as unknown as {
		ui: Record<string, unknown>;
		[key: string]: unknown;
	};
	const rpcContext = { ...base, ui: { ...base.ui, ...rpc.ui } } as never;
	const rpcRunning = runLiveChoice(rpcContext, {
		title: "Preset",
		items: choices,
		signal: rpcOwner.signal,
	});
	await rpc.waitForCall();
	rpcOwner.abort(new DOMException("Session replaced", "AbortError"));
	assert.deepEqual(await rpcRunning, { kind: "stale" });
	rpc.assertConsumed();
});

test("runLiveChoice reports unsupported modes and unsupported callback failures", async () => {
	const printContext = createMockContext({ mode: "print", hasUI: false });
	let unsupportedMode = "";
	assert.deepEqual(
		await runLiveChoice(printContext.ctx, {
			title: "Preset",
			items: choices,
			onUnsupportedMode: (_ctx, mode) => {
				unsupportedMode = mode;
			},
		}),
		{ kind: "unsupported", mode: "print" },
	);
	assert.equal(unsupportedMode, "print");

	const failure = new Error("Fallback failed");
	let reported: unknown;
	assert.deepEqual(
		await runLiveChoice(printContext.ctx, {
			title: "Preset",
			items: choices,
			onUnsupportedMode: () => {
				throw failure;
			},
			onError: (_ctx, error) => {
				reported = error;
			},
		}),
		{ kind: "error", error: failure },
	);
	assert.equal(reported, failure);
});
