import assert from "node:assert/strict";
import test from "node:test";
import { initTheme } from "@earendil-works/pi-coding-agent";
import { createTuiHarness } from "@narumitw/pi-tui-kit/testing";
import { createMockContext } from "../../../test/support.js";
import {
	createLimitInputScreen,
	createLimitReviewScreen,
	type ImageDropMenuState,
	menuSummary,
	runImageDropMenuLoad,
	safeMenuText,
	validateLimitInput,
} from "../src/menu.js";
import { DEFAULT_SETTINGS } from "../src/settings.js";

initTheme("dark", false);

const EMPTY_STATE: ImageDropMenuState = {
	batch: { revision: 0, phase: "empty", items: [], totalSourceBytes: 0 },
	history: { revision: 0, items: [], totalBytes: 0, maxImages: 128, maxBytes: 512 },
	serverRunning: false,
};

test("menu summaries expose empty, partial, and queued state without relying on color", () => {
	assert.equal(menuSummary(EMPTY_STATE), "Draft: No images staged");
	const partial: ImageDropMenuState = {
		...EMPTY_STATE,
		batch: {
			revision: 3,
			phase: "blocked",
			totalSourceBytes: 30,
			items: [
				{ id: "one", name: "one", size: 10, status: "ready", notes: [] },
				{ id: "two", name: "two", size: 10, status: "processing", notes: [] },
				{ id: "three", name: "three", size: 10, status: "error", notes: [] },
			],
		},
	};
	assert.equal(menuSummary(partial), "Draft: 1/3 ready · 1 processing · 1 need attention");
	assert.match(
		menuSummary({ ...partial, batch: { ...partial.batch, phase: "reserved" } }),
		/queued/,
	);
	assert.equal(safeMenuText("unsafe\u001b]8;;bad\u0007 value"), "unsafe ]8;;bad value");
});

test("limit input and review projections preserve exact domain values", () => {
	const original = { ...DEFAULT_SETTINGS };
	const draft = { ...original, maxRetainedImages: 120 };
	const input = createLimitInputScreen("maxRetainedImages", draft, original);
	assert.equal(input.kind, "input");
	assert.equal(input.action, "submit-limit");
	assert.match((input.lines ?? []).join("\n"), /Current: 120.*Default: 128/u);

	assert.deepEqual(validateLimitInput("maxImages", "0", draft), {
		kind: "invalid",
		message: "Enter a positive value no greater than 32.",
	});
	assert.deepEqual(validateLimitInput("maxImages", "33", draft), {
		kind: "invalid",
		message: "Enter a positive value no greater than 32.",
	});
	assert.deepEqual(validateLimitInput("maxImageBytes", "41", draft), {
		kind: "invalid",
		message: "Size per image cannot exceed the combined draft size.",
	});
	assert.deepEqual(validateLimitInput("maxImageBytes", "5", draft), {
		kind: "valid",
		value: 5 * 1024 * 1024,
	});

	const review = createLimitReviewScreen(original, draft);
	assert.equal(review.kind, "review");
	assert.match(review.content, /Staged \+ sent image count: 128 → 120/u);
	assert.match(review.content, /next Pi session/u);
	assert.deepEqual(review.confirm, {
		id: "save",
		label: "Save resource limits",
		action: "save-limits",
	});
});

test("status loading distinguishes Escape back from Ctrl+C close", async () => {
	async function loadWith(key: "tui.select.cancel" | "ctrl+c") {
		const tui = createTuiHarness({ width: 40, rows: 24 });
		const context = createMockContext({ mode: "tui", custom: tui.custom });
		const running = runImageDropMenuLoad(
			context.ctx,
			"Refreshing Image Drop status…",
			async () => new Promise<never>(() => undefined),
		);
		await tui.waitForOpen();
		tui.press(key);
		const result = await running;
		assert.equal(tui.isOpen, false);
		return result;
	}
	assert.equal((await loadWith("tui.select.cancel")).kind, "cancelled");
	assert.equal((await loadWith("ctrl+c")).kind, "closed");
});

test("Ctrl+C aborts loader work before closing its UI", async () => {
	let uiClosed = false;
	let abortedBeforeClose = false;
	const tui = createTuiHarness();
	const context = createMockContext({ mode: "tui", custom: tui.custom });
	const running = runImageDropMenuLoad(context.ctx, "Loading…", async (signal) => {
		signal.addEventListener("abort", () => {
			abortedBeforeClose = !uiClosed;
		});
		return new Promise<never>(() => undefined);
	});
	void running.then(() => {
		uiClosed = true;
	});
	await tui.waitForOpen();
	tui.press("ctrl+c");
	const result = await running;
	assert.equal(result.kind, "closed");
	assert.equal(abortedBeforeClose, true);
	assert.equal(tui.isOpen, false);
});
