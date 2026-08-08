import { basename } from "node:path";
import type { ImageContent } from "@earendil-works/pi-ai";
import type {
	ExtensionAPI,
	ExtensionCommandContext,
	ExtensionContext,
	InputEvent,
	InputEventResult,
} from "@earendil-works/pi-coding-agent";
import type {
	MenuActionResult,
	RunConfirmationOptions,
	RunConfirmationResult,
} from "@narumitw/pi-tui-kit";
import { BatchError, BatchStore, digestImages, type ProcessedImage } from "./batch.js";
import { formatBytes } from "./format.js";
import type { ImageProcessor } from "./images.js";
import type { ImageDropLimitsMenuState, LimitSettingAction, MenuLoadResult } from "./menu.js";
import { readEffectivePiImageSettings } from "./pi-settings.js";
import type { ImageDropServer, ImageDropServerOptions } from "./server.js";
import {
	DEFAULT_SETTINGS,
	type ImageDropSettings,
	loadSettings,
	settingsFilePath,
	updateSettings,
} from "./settings.js";

const WIDGET_KEY = "image-drop";

type InteractiveUi = typeof import("./interactive-ui.js");
let defaultInteractiveUiPromise: Promise<InteractiveUi> | undefined;

function loadDefaultInteractiveUi(): Promise<InteractiveUi> {
	if (!defaultInteractiveUiPromise) {
		defaultInteractiveUiPromise = import("./interactive-ui.js").catch((error) => {
			defaultInteractiveUiPromise = undefined;
			throw error;
		});
	}
	return defaultInteractiveUiPromise;
}

type LatestEventHandler = (event: unknown, ctx: ExtensionContext) => void | Promise<void>;
type LatestExtensionAPI = ExtensionAPI & {
	on(event: "agent_settled", handler: LatestEventHandler): void;
};

type ServerControl = Pick<ImageDropServer, "issueLink" | "broadcastState" | "close"> & {
	hasUnusedLink?: () => boolean;
};
type ProcessorControl = Pick<ImageProcessor, "process">;

export interface RuntimeDependencies {
	loadSettings: typeof loadSettings;
	readPiSettings: typeof readEffectivePiImageSettings;
	startServer(options: ImageDropServerOptions): Promise<ServerControl>;
	createProcessor(): ProcessorControl | Promise<ProcessorControl>;
	loadInteractiveUi(): Promise<InteractiveUi>;
	/** Focused-test observer for the pure limits projection. */
	observeLimits?: (state: ImageDropLimitsMenuState) => void;
	loadStatus<T>(
		ctx: ExtensionCommandContext,
		label: string,
		task: (signal: AbortSignal) => Promise<T>,
	): Promise<MenuLoadResult<T>>;
	showConfirm(
		ctx: ExtensionContext,
		options: RunConfirmationOptions<ExtensionContext>,
	): Promise<RunConfirmationResult>;
	updateSettings: typeof updateSettings;
	settingsFilePath: typeof settingsFilePath;
}

const DEFAULT_DEPENDENCIES: RuntimeDependencies = {
	loadSettings,
	readPiSettings: readEffectivePiImageSettings,
	startServer: async (options) => (await import("./server.js")).ImageDropServer.start(options),
	createProcessor: async () => new (await import("./images.js")).ImageProcessor(2),
	loadInteractiveUi: loadDefaultInteractiveUi,
	loadStatus: async (ctx, label, task) =>
		(await loadDefaultInteractiveUi()).runImageDropMenuLoad(ctx, label, task),
	showConfirm: async (ctx, options) =>
		(await loadDefaultInteractiveUi()).runConfirmation(ctx, options),
	updateSettings,
	settingsFilePath,
};

// Cohesion justification: session lifecycle, batch reservation, browser service ownership, and
// message attachment form one ordering-sensitive state machine; splitting them would duplicate the
// generation, cancellation, and byte-ownership invariants.
export class ImageDropRuntime {
	private readonly dependencies: RuntimeDependencies;
	private batch?: BatchStore;
	private settings?: ImageDropSettings;
	private context?: ExtensionContext;
	private server?: ServerControl;
	private serverStarting?: Promise<ServerControl>;
	private processor?: ProcessorControl;
	private processorStarting?: Promise<ProcessorControl>;
	private sessionAbort = new AbortController();
	private generation = 0;
	private closed = true;
	private lastPiSettingsWarning = "";

	constructor(
		private readonly pi: ExtensionAPI,
		dependencies: Partial<RuntimeDependencies> = {},
	) {
		this.dependencies = { ...DEFAULT_DEPENDENCIES, ...dependencies };
	}

	register(): void {
		this.pi.registerCommand("image-drop", {
			description: "Open the Image Drop menu",
			handler: async (args, ctx) => {
				if (args.trim()) {
					const message = "Usage: /image-drop";
					if (ctx.hasUI) {
						ctx.ui.notify(message, "warning");
						return;
					}
					throw new Error(message);
				}
				if (ctx.mode !== "tui") {
					const message = "The Image Drop menu is available in TUI mode only.";
					if (ctx.hasUI) {
						ctx.ui.notify(message, "warning");
						return;
					}
					throw new Error(message);
				}
				const generation = this.generation;
				this.context = ctx;
				await this.recoverOrphanedReservation(ctx);
				if (!this.isCurrentMenu(generation)) return;
				try {
					await this.showMenu(ctx, generation);
				} catch (error) {
					if (!this.isCurrentMenu(generation)) return;
					ctx.ui.notify(`Image Drop menu could not open: ${formatError(error)}`, "error");
				}
			},
		});

		this.pi.on("session_start", async (_event, ctx) => this.start(ctx));
		this.pi.on("session_shutdown", async (_event, ctx) => this.shutdown(ctx));
		this.pi.on("input", async (event, ctx) => this.handleInput(event, ctx));
		this.pi.on("before_agent_start", async () => this.batch?.markPreflightStarted());
		this.pi.on("message_start", async (event, ctx) => this.handleMessageStart(event, ctx));
		(this.pi as LatestExtensionAPI).on("agent_settled", async (_event, ctx) => {
			if (!ctx.isIdle() || ctx.hasPendingMessages()) return;
			await this.recoverReservation(ctx, "Queued image message was not delivered; restored it.");
		});
	}

	async start(ctx: ExtensionContext): Promise<void> {
		const generation = ++this.generation;
		const previousBatch = this.batch;
		this.closed = true;
		this.sessionAbort.abort();
		await this.releaseServer();
		previousBatch?.close();
		if (generation !== this.generation) return;
		this.sessionAbort = new AbortController();
		let result: Awaited<ReturnType<typeof loadSettings>>;
		try {
			result = await this.dependencies.loadSettings(undefined, this.sessionAbort.signal);
		} catch (error) {
			if (generation !== this.generation || this.sessionAbort.signal.aborted) return;
			throw error;
		}
		if (generation !== this.generation) return;
		this.settings = result.settings;
		this.batch = new BatchStore(result.settings);
		this.processor = undefined;
		this.processorStarting = undefined;
		this.context = ctx;
		this.closed = false;
		this.lastPiSettingsWarning = "";
		const warning = "warning" in result ? result.warning : undefined;
		if (result.kind === "invalid" || warning) {
			ctx.ui.notify(warning ?? "Image Drop settings ignored.", "warning");
		}
		this.updateWidget(ctx);
		if (!result.settings.startOnSessionStart) return;
		try {
			await this.presentLink(ctx);
		} catch (error) {
			if (generation !== this.generation || this.closed) return;
			ctx.ui.notify(`Image Drop could not start: ${formatError(error)}`, "error");
		}
	}

	async shutdown(ctx: ExtensionContext): Promise<void> {
		const generation = ++this.generation;
		const previousBatch = this.batch;
		this.closed = true;
		this.sessionAbort.abort();
		await this.releaseServer();
		previousBatch?.close();
		if (generation !== this.generation) return;
		this.batch = undefined;
		this.settings = undefined;
		this.processor = undefined;
		this.processorStarting = undefined;
		this.context = undefined;
		ctx.ui.setWidget(WIDGET_KEY, undefined);
	}

	getBatchForTesting(): BatchStore | undefined {
		return this.batch;
	}

	async handleInput(event: InputEvent, ctx: ExtensionContext): Promise<InputEventResult> {
		this.context = ctx;
		if (this.closed || event.source !== "interactive" || !event.text.trim() || !this.batch) {
			return { action: "continue" };
		}
		if (this.batch.currentReservation()) {
			await this.recoverOrphanedReservation(ctx);
			if (this.batch.currentReservation()) return { action: "continue" };
			// The current input arrived at the recovery boundary. Preserve it alongside the
			// restored text and require an explicit resubmission rather than consuming it.
			this.restoreEditor(ctx, event.text);
			return { action: "handled" };
		}
		const state = this.batch.publicState();
		if (state.phase === "empty") return { action: "continue" };
		if (state.phase !== "ready") {
			this.restoreEditor(ctx, event.text);
			ctx.ui.notify(this.blockedReason(state.phase), "warning");
			return { action: "handled" };
		}
		if (!supportsImages(ctx)) {
			this.restoreEditor(ctx, event.text);
			ctx.ui.notify("The current model does not support image input.", "warning");
			return { action: "handled" };
		}
		const generation = this.generation;
		const batch = this.batch;
		const piSettings = await this.dependencies.readPiSettings(ctx.cwd, ctx.isProjectTrusted());
		if (generation !== this.generation || batch !== this.batch || this.closed) {
			return { action: "handled" };
		}
		this.notifyPiSettingsWarnings(ctx, piSettings.warnings);
		if (piSettings.blockImages) {
			this.restoreEditor(ctx, event.text);
			ctx.ui.notify("Pi image sending is disabled. Enable images in /settings first.", "warning");
			return { action: "handled" };
		}
		if (!(await this.reprocessForAutoResize(piSettings.autoResize, ctx, event.text))) {
			return { action: "handled" };
		}

		try {
			const reservation = batch.reserveMessage(event.text, event.streamingBehavior);
			this.server?.broadcastState();
			this.updateWidget(ctx);
			return {
				action: "transform",
				text: event.text,
				images: [...(event.images ?? []), ...reservation.images],
			};
		} catch (error) {
			this.restoreEditor(ctx, event.text);
			ctx.ui.notify(formatError(error), "warning");
			return { action: "handled" };
		}
	}

	addReadyImageForTesting(
		id: string,
		name: string,
		source: Buffer,
		processed: ProcessedImage,
	): void {
		if (!this.batch) throw new Error("Runtime has not started");
		this.batch.reserveItems([{ id, name, size: source.byteLength }]);
		this.batch.startProcessing(id, source);
		this.batch.complete(id, processed, true);
		this.server?.broadcastState();
		if (this.context) this.updateWidget(this.context);
	}

	private async reprocessForAutoResize(
		autoResize: boolean,
		ctx: ExtensionContext,
		text: string,
	): Promise<boolean> {
		const batch = this.batch;
		const settings = this.settings;
		if (!batch || !settings) return false;
		let jobs: Array<{ id: string; source: Buffer }>;
		try {
			jobs = batch.beginAutoResizeReprocessing(autoResize);
		} catch (error) {
			this.restoreEditor(ctx, text);
			ctx.ui.notify(formatError(error), "warning");
			return false;
		}
		if (jobs.length === 0) return true;
		const generation = this.generation;
		const signal = this.sessionAbort.signal;
		let processor: ProcessorControl;
		try {
			processor = await this.ensureProcessor();
		} catch (error) {
			if (generation === this.generation && !signal.aborted) {
				this.restoreEditor(ctx, text);
				ctx.ui.notify(formatError(error), "warning");
			}
			return false;
		}
		if (generation !== this.generation || signal.aborted || batch !== this.batch) return false;
		this.server?.broadcastState();
		this.updateWidget(ctx);
		await Promise.all(
			jobs.map(async ({ id, source }) => {
				try {
					const processed = await processor.process(source, {
						autoResize,
						maxImagePixels: settings.maxImagePixels,
						signal,
					});
					if (generation === this.generation) batch.complete(id, processed, autoResize);
				} catch (error) {
					if (generation !== this.generation || signal.aborted) return;
					try {
						batch.fail(id, formatError(error));
					} catch (failure) {
						if (!(failure instanceof BatchError) || failure.code !== "not-found") throw failure;
					}
				} finally {
					if (generation === this.generation) this.server?.broadcastState();
				}
			}),
		);
		if (generation !== this.generation) return false;
		if (batch.publicState().phase !== "ready") {
			this.restoreEditor(ctx, text);
			ctx.ui.notify("Images could not be updated for the current auto-resize setting.", "warning");
			this.updateWidget(ctx);
			return false;
		}
		this.updateWidget(ctx);
		return true;
	}

	private isCurrentMenu(generation: number): boolean {
		return generation === this.generation && !this.closed;
	}

	private async showMenu(ctx: ExtensionCommandContext, generation: number): Promise<void> {
		const ui = await this.dependencies.loadInteractiveUi();
		if (!this.isCurrentMenu(generation)) return;
		const {
			createLimitInputScreen,
			createLimitReviewScreen,
			defineMenu,
			isLimitSettingAction,
			limitChanges,
			limitMenuDescription,
			limitMenuState,
			limitSettingsPatch,
			menuSummary,
			runMenu,
			usesSafeLimits,
			validateLimitInput,
		} = ui;
		let statusLines: string[] = [];
		let previousPiSettings: Awaited<ReturnType<typeof readEffectivePiImageSettings>> | undefined;
		let loadedSettings: ImageDropSettings | undefined;
		let originalLimits: ImageDropSettings | undefined;
		let limitDraft: ImageDropSettings | undefined;
		let selectedLimit: LimitSettingAction | undefined;
		let settingsLines: string[] = [];
		type Screen =
			| "main"
			| "status"
			| "settings"
			| "limits"
			| "limit-input"
			| "limit-review"
			| "help"
			| "invalid-settings";
		type Action =
			| "open"
			| "load-status"
			| "refresh-status"
			| "status-open"
			| "load-settings"
			| "set-start"
			| "to-limits"
			| "limit"
			| "submit-limit"
			| "save-limits"
			| "back";
		const menu = defineMenu<undefined, Screen, Action, ExtensionCommandContext>({
			start: "main",
			screens: {
				main: () => {
					const batch = this.batch;
					const state = batch
						? {
								batch: batch.publicState(),
								history: batch.publicHistoryState(),
								serverRunning: Boolean(this.server),
							}
						: undefined;
					return {
						kind: "actions",
						title: "Image Drop",
						lines: state
							? [menuSummary(state), `Service: ${state.serverRunning ? "Running" : "Not started"}`]
							: ["Image Drop is not initialized."],
						items: [
							{
								id: "open",
								label: "Add images in browser",
								description: "Stage and arrange images for your next Pi message",
								action: "open",
							},
							{
								id: "status",
								label: "Check image status",
								description: "See what is ready and whether Pi can send images",
								action: "load-status",
							},
							{
								id: "settings",
								label: "Change Image Drop settings",
								description: "Choose automatic startup and image limits",
								action: "load-settings",
							},
							{
								id: "help",
								label: "How Image Drop works",
								description: "Learn how images are attached, stored, and forwarded",
								to: "help",
							},
							{ id: "close", label: "Close menu", close: true },
						],
						hint: "close",
					};
				},
				status: () => ({
					kind: "actions",
					title: "Image Drop Status",
					lines: statusLines,
					items: [
						{ id: "open", label: "Open staging page", action: "status-open" },
						{ id: "refresh", label: "Refresh status", action: "refresh-status" },
						{ id: "back", label: "Back", action: "back" },
						{ id: "close", label: "Close", close: true },
					],
					hint: "back",
				}),
				settings: () => ({
					kind: "settings",
					title: "Image Drop Settings",
					lines: settingsLines,
					items: loadedSettings
						? [
								{
									id: "automatic-start",
									label: "Start with each Pi session",
									description: "Default: Off · Starts Image Drop and shows a staging link",
									currentValue: loadedSettings.startOnSessionStart ? "On" : "Off",
									values: ["Off", "On"],
									action: "set-start" as const,
								},
								{
									id: "limits",
									label: "Image limits",
									description: "Open current, default, and pending image limits",
									currentValue: usesSafeLimits(loadedSettings) ? "Recommended" : "Custom",
									action: "to-limits" as const,
								},
							]
						: [],
				}),
				"invalid-settings": () => ({
					kind: "detail",
					title: "Image Drop Settings",
					lines: settingsLines,
					hint: "back",
				}),
				limits: () => {
					const draft = limitDraft;
					const original = originalLimits;
					const state = draft && original ? limitMenuState(draft, original) : undefined;
					if (state) this.dependencies.observeLimits?.(state);
					const item = (id: LimitSettingAction, label: string) => ({
						id,
						label,
						description: state ? limitMenuDescription(state.values[id]) : "Unavailable",
						action: "limit" as const,
					});
					return {
						kind: "actions",
						title: "Image limits",
						lines: [
							"Choose a limit to change. Saved changes apply when your next Pi session starts.",
							state && state.unsavedChanges > 0
								? `${state.unsavedChanges} unsaved change(s)`
								: "No unsaved changes",
						],
						items: [
							item("maxImages", "Images per message"),
							item("maxImageBytes", "Max file size per image"),
							item("maxBatchBytes", "Max total size per message"),
							item("maxImagePixels", "Max image resolution"),
							item("maxRetainedImages", "Staged + sent image count"),
							item("maxRetainedBytes", "Staged + sent image memory"),
							{ id: "save", label: "Review changes before saving", action: "limit" },
							{ id: "defaults", label: "Restore recommended defaults", action: "limit" },
							{ id: "back", label: "Back to Settings", action: "back" },
							{ id: "close", label: "Close Image Drop", close: true },
						],
						hint: "back",
					};
				},
				"limit-input": () => {
					if (!selectedLimit || !limitDraft || !originalLimits) {
						return {
							kind: "detail",
							title: "Image limit unavailable",
							lines: ["Return to Image limits and choose a value again."],
							hint: "back",
						};
					}
					return createLimitInputScreen(selectedLimit, limitDraft, originalLimits);
				},
				"limit-review": () => {
					if (!limitDraft || !originalLimits) {
						return {
							kind: "detail",
							title: "Resource-limit review unavailable",
							lines: ["Return to Image limits and reload settings."],
							hint: "back",
						};
					}
					return createLimitReviewScreen(originalLimits, limitDraft);
				},
				help: () => ({
					kind: "detail",
					title: "How Image Drop works",
					lines: [
						"1. Open the staging page.",
						"2. Paste, drop, or choose images and review their order.",
						"3. Return to Pi and send a non-empty interactive message.",
						"4. Ready images are attached automatically in browser order.",
						"Images stay in this Pi process until removed, evicted, or the session ends.",
						"For SSH or containers, forward the printed 127.0.0.1 port without changing the Host value.",
					],
					hint: "back",
				}),
			},
			actions: {
				open: async () => this.openFromMenu(ctx, generation),
				"load-status": async () => {
					const outcome = await this.refreshMenuStatus(ctx, generation, previousPiSettings);
					if (outcome.kind === "closed") return { kind: "close" };
					if (outcome.kind === "cancelled") return { kind: "stay" };
					previousPiSettings = outcome.previous;
					statusLines = outcome.lines;
					return { kind: "to", screen: "status" };
				},
				"refresh-status": async () => {
					const outcome = await this.refreshMenuStatus(ctx, generation, previousPiSettings);
					if (outcome.kind === "closed") return { kind: "close" };
					if (outcome.kind === "cancelled") return { kind: "stay" };
					previousPiSettings = outcome.previous;
					statusLines = outcome.lines;
					return { kind: "stay" };
				},
				"status-open": async () => this.openFromMenu(ctx, generation),
				"load-settings": async () => {
					const outcome = await this.loadMenuSettings(ctx, generation);
					if (outcome.kind === "closed") return { kind: "close" };
					if (outcome.kind === "cancelled" || outcome.kind === "error") return { kind: "stay" };
					loadedSettings = outcome.settings;
					originalLimits = { ...outcome.settings };
					limitDraft = { ...outcome.settings };
					settingsLines = outcome.lines;
					return { kind: "to", screen: outcome.invalid ? "invalid-settings" : "settings" };
				},
				"set-start": async ({ value, signal }) => {
					if (signal.aborted || !loadedSettings) return { kind: "rejected" };
					const enabled = value === "On";
					try {
						await this.dependencies.updateSettings({ startOnSessionStart: enabled });
						if (signal.aborted || !this.isCurrentMenu(generation)) return { kind: "rejected" };
						loadedSettings = { ...loadedSettings, startOnSessionStart: enabled };
						if (originalLimits) originalLimits.startOnSessionStart = enabled;
						if (limitDraft) limitDraft.startOnSessionStart = enabled;
						ctx.ui.notify(
							`Saved. Automatic start is ${enabled ? "on" : "off"} for future Pi sessions.`,
							"info",
						);
						return { kind: "stay" };
					} catch (error) {
						if (!signal.aborted && this.isCurrentMenu(generation)) {
							ctx.ui.notify(
								`Image Drop settings were not saved; the previous settings remain active: ${formatError(error)}`,
								"error",
							);
						}
						return { kind: "rejected" };
					}
				},
				"to-limits": async () => ({ kind: "to", screen: "limits" }),
				limit: async ({ itemId }) => {
					if (!originalLimits || !limitDraft) return { kind: "rejected" };
					if (itemId === "defaults") {
						limitDraft = {
							...limitDraft,
							...DEFAULT_SETTINGS,
							startOnSessionStart: originalLimits.startOnSessionStart,
						};
						return { kind: "stay" };
					}
					if (itemId === "save") {
						if (limitChanges(originalLimits, limitDraft).length === 0) {
							ctx.ui.notify("No resource-limit changes to save.", "info");
							return { kind: "stay" };
						}
						return { kind: "to", screen: "limit-review" };
					}
					if (!isLimitSettingAction(itemId)) return { kind: "rejected" };
					selectedLimit = itemId;
					return { kind: "to", screen: "limit-input" };
				},
				"submit-limit": async ({ value, signal }) => {
					if (signal.aborted || !selectedLimit || !limitDraft || value === undefined) {
						return { kind: "rejected" };
					}
					const validation = validateLimitInput(selectedLimit, value, limitDraft);
					if (validation.kind === "invalid") {
						ctx.ui.notify(validation.message, "warning");
						return { kind: "rejected" };
					}
					limitDraft = { ...limitDraft, [selectedLimit]: validation.value };
					return { kind: "back" };
				},
				"save-limits": async ({ signal }) => {
					if (signal.aborted || !loadedSettings || !originalLimits || !limitDraft) {
						return { kind: "rejected" };
					}
					const patch = limitSettingsPatch(originalLimits, limitDraft);
					if (Object.keys(patch).length === 0) {
						ctx.ui.notify("No resource-limit changes to save.", "info");
						return { kind: "back" };
					}
					const committed = { ...limitDraft };
					try {
						await this.dependencies.updateSettings(patch);
						if (signal.aborted || !this.isCurrentMenu(generation)) {
							return { kind: "rejected" };
						}
						loadedSettings = { ...loadedSettings, ...patch };
						originalLimits = committed;
						limitDraft = { ...committed };
						ctx.ui.notify("Resource limits saved for future Pi sessions.", "info");
						return { kind: "back" };
					} catch (error) {
						if (!signal.aborted && this.isCurrentMenu(generation)) {
							ctx.ui.notify(
								`Resource limits were not saved; the previous settings remain active: ${formatError(error)}`,
								"error",
							);
						}
						return { kind: "rejected" };
					}
				},
				back: async () => ({ kind: "back" }),
			},
		});
		await runMenu(ctx, menu, {
			getState: () => undefined,
			signal: this.sessionAbort.signal,
			isCurrent: () => this.isCurrentMenu(generation),
		});
	}

	private async openFromMenu(
		ctx: ExtensionCommandContext,
		generation: number,
	): Promise<MenuActionResult<"main" | "status">> {
		try {
			const opened = await this.presentLink(ctx, true);
			if (!this.isCurrentMenu(generation)) return { kind: "close" };
			return opened === "cancelled" ? { kind: "stay" } : { kind: "close" };
		} catch (error) {
			if (this.isCurrentMenu(generation)) {
				ctx.ui.notify(`Image Drop could not start: ${formatError(error)}`, "error");
			}
			return { kind: "stay" };
		}
	}

	private async refreshMenuStatus(
		ctx: ExtensionCommandContext,
		generation: number,
		previous: Awaited<ReturnType<typeof readEffectivePiImageSettings>> | undefined,
	): Promise<
		| { kind: "closed" }
		| { kind: "cancelled" }
		| {
				kind: "completed";
				previous: Awaited<ReturnType<typeof readEffectivePiImageSettings>> | undefined;
				lines: string[];
		  }
	> {
		const batch = this.batch;
		if (!batch || !this.isCurrentMenu(generation)) return { kind: "closed" };
		const sessionSignal = this.sessionAbort.signal;
		const loaded = await this.dependencies.loadStatus(
			ctx,
			"Refreshing Image Drop status…",
			(signal) =>
				this.dependencies.readPiSettings(
					ctx.cwd,
					ctx.isProjectTrusted(),
					AbortSignal.any([signal, sessionSignal]),
				),
		);
		if (!this.isCurrentMenu(generation) || loaded.kind === "closed") return { kind: "closed" };
		if (loaded.kind === "cancelled") return { kind: "cancelled" };
		let settingsError = "";
		if (loaded.kind === "completed") previous = loaded.value;
		else settingsError = `Pi image settings refresh failed — ${formatError(loaded.error)}`;
		const state = batch.publicState();
		const retained = batch.retainedCapacityUsage();
		return {
			kind: "completed",
			previous,
			lines: [
				`Service: ${this.server ? "Running" : "Not started"}`,
				this.batchStatusLine(state),
				`Retained capacity: ${retained.images}/${retained.maxImages} images · ${formatBytes(retained.bytes)}/${formatBytes(retained.maxBytes)} (draft + sent history)`,
				`Current model: ${supportsImages(ctx) ? "Supports images" : "Text only — sending disabled"}`,
				...(previous
					? [
							`Pi image sending: ${previous.blockImages ? "Disabled in /settings" : "Enabled"}`,
							`Auto-resize: ${previous.autoResize ? "On" : "Off"}`,
							...previous.warnings.map((warning) => `Warning: ${warning}`),
							...(settingsError
								? [`Warning: ${settingsError}; showing the previous valid state.`]
								: []),
						]
					: [settingsError]),
			],
		};
	}

	private async loadMenuSettings(
		ctx: ExtensionCommandContext,
		generation: number,
	): Promise<
		| { kind: "closed" }
		| { kind: "cancelled" }
		| { kind: "error" }
		| { kind: "completed"; settings: ImageDropSettings; lines: string[]; invalid: boolean }
	> {
		const sessionSignal = this.sessionAbort.signal;
		const loaded = await this.dependencies.loadStatus(
			ctx,
			"Loading Image Drop settings…",
			(signal) =>
				this.dependencies.loadSettings(undefined, AbortSignal.any([signal, sessionSignal])),
		);
		if (!this.isCurrentMenu(generation) || loaded.kind === "closed") return { kind: "closed" };
		if (loaded.kind === "cancelled") return { kind: "cancelled" };
		if (loaded.kind === "error") {
			ctx.ui.notify(
				`Image Drop settings could not be loaded: ${formatError(loaded.error)}`,
				"error",
			);
			return { kind: "error" };
		}
		const result = loaded.value;
		const invalid = result.kind === "invalid";
		const path = this.dependencies.settingsFilePath();
		return {
			kind: "completed",
			settings: { ...result.settings },
			invalid,
			lines: invalid
				? [
						"Settings file: Invalid — editing is disabled",
						"Fix the file and reopen Settings.",
						path,
						result.warning,
					]
				: [`Settings file: ${result.kind === "missing" ? "Defaults (not created)" : path}`],
		};
	}

	private batchStatusLine(state: ReturnType<BatchStore["publicState"]>): string {
		const ready = state.items.filter((item) => item.status === "ready").length;
		const processing = state.items.filter(
			(item) => item.status === "uploading" || item.status === "processing",
		).length;
		const errors = state.items.filter((item) => item.status === "error").length;
		if (state.phase === "empty") return "Draft: No images staged";
		if (state.phase === "reserved") return `Draft: ${state.items.length} images queued with Pi`;
		return `Draft: ${ready}/${state.items.length} ready · ${processing} processing · ${errors} need attention · ${formatBytes(state.totalSourceBytes)}`;
	}

	private async presentLink(
		ctx: ExtensionContext,
		confirmRotation = false,
	): Promise<"opened" | "cancelled" | "closed"> {
		const generation = this.generation;
		const server = await this.ensureServer(ctx);
		if (generation !== this.generation || this.closed) {
			throw new Error("the Pi session changed while opening Image Drop");
		}
		if (confirmRotation && server.hasUnusedLink?.()) {
			const confirmation = await this.dependencies.showConfirm(ctx, {
				title: "Create a new staging link?",
				message: "The previous unused Image Drop link will stop working.",
				signal: this.sessionAbort.signal,
				isCurrent: () => this.isCurrentMenu(generation),
				// Preserve Image Drop's domain-level startup error instead of notifying twice.
				onError: () => undefined,
			});
			if (!this.isCurrentMenu(generation)) {
				throw new Error("the Pi session changed while opening Image Drop");
			}
			if (confirmation.kind === "closed") {
				return confirmation.reason === "close" ? "closed" : "cancelled";
			}
			if (confirmation.kind === "stale") {
				throw new Error("the Pi session changed while opening Image Drop");
			}
			if (confirmation.kind === "unsupported") {
				throw new Error(`Image Drop confirmation is unavailable in ${confirmation.mode} mode`);
			}
			if (confirmation.kind === "error") throw confirmation.error;
		}
		const link = server.issueLink();
		if (this.batch?.publicState().phase === "empty") {
			ctx.ui.setWidget(WIDGET_KEY, [`🖼️ Image Drop: ${link}`]);
		} else {
			this.updateWidget(ctx);
		}
		ctx.ui.notify(`Image Drop: ${link}`, "info");
		return "opened";
	}

	private async ensureServer(ctx: ExtensionContext): Promise<ServerControl> {
		if (this.closed || !this.batch || !this.settings) {
			throw new Error("the Pi session is not ready");
		}
		if (this.server) return this.server;
		const processor = await this.ensureProcessor();
		if (this.closed || !this.batch || !this.settings) {
			throw new Error("the Pi session changed while image processing was loading");
		}
		if (!this.serverStarting) {
			const generation = this.generation;
			const starting = this.dependencies.startServer({
				batch: this.batch,
				settings: this.settings,
				projectName: basename(ctx.cwd) || ctx.cwd,
				sessionName: ctx.sessionManager.getSessionName(),
				cwd: ctx.cwd,
				process: (source, options) => processor.process(source, options),
				getAutoResize: () => this.processingSettings(),
				onStateChange: () => {
					if (generation === this.generation && this.context) this.updateWidget(this.context);
				},
			});
			this.serverStarting = starting.then(async (server) => {
				if (generation !== this.generation || this.closed) {
					await server.close();
					throw new Error("the Pi session changed while the server was starting");
				}
				this.server = server;
				return server;
			});
		}
		const starting = this.serverStarting;
		try {
			return await starting;
		} finally {
			if (this.serverStarting === starting) this.serverStarting = undefined;
		}
	}

	private async ensureProcessor(): Promise<ProcessorControl> {
		if (this.processor) return this.processor;
		if (!this.processorStarting) {
			const generation = this.generation;
			const starting = Promise.resolve(this.dependencies.createProcessor()).then((processor) => {
				if (generation !== this.generation || this.closed) {
					throw new Error("the Pi session changed while image processing was loading");
				}
				this.processor = processor;
				return processor;
			});
			this.processorStarting = starting;
		}
		const starting = this.processorStarting;
		try {
			return await starting;
		} finally {
			if (this.processorStarting === starting) this.processorStarting = undefined;
		}
	}

	private async processingSettings(): Promise<boolean> {
		const ctx = this.context;
		if (!ctx || this.closed) throw new Error("The Pi session has ended.");
		if (!supportsImages(ctx)) throw new Error("The current model does not support image input.");
		const settings = await this.dependencies.readPiSettings(ctx.cwd, ctx.isProjectTrusted());
		this.notifyPiSettingsWarnings(ctx, settings.warnings);
		if (settings.blockImages) {
			throw new Error("Pi image sending is disabled. Enable images in /settings first.");
		}
		return settings.autoResize;
	}

	private async releaseServer(): Promise<void> {
		const server = this.server;
		const starting = this.serverStarting;
		this.server = undefined;
		this.serverStarting = undefined;
		if (server) await server.close();
		if (starting) {
			try {
				await (await starting).close();
			} catch {
				// A failed or stale startup has no live server left to release.
			}
		}
	}

	private async handleMessageStart(event: unknown, ctx: ExtensionContext): Promise<void> {
		this.context = ctx;
		const reservation = this.batch?.currentReservation();
		if (!reservation) return;
		const images = userMessageImages(event);
		if (!containsImageSequence(images, reservation.images.length, reservation.digest)) return;
		this.batch?.commitReservation(reservation.digest);
		this.server?.broadcastState();
		this.updateWidget(ctx);
	}

	private async recoverOrphanedReservation(ctx: ExtensionContext): Promise<void> {
		if (!this.batch?.currentReservation()) return;
		if (!ctx.isIdle() || ctx.hasPendingMessages()) return;
		await this.recoverReservation(ctx, "Restored an image message that did not start.");
	}

	private async recoverReservation(ctx: ExtensionContext, notice: string): Promise<void> {
		const restored = this.batch?.restoreReservation();
		if (!restored) return;
		this.restoreEditor(ctx, restored.text);
		this.server?.broadcastState();
		this.updateWidget(ctx);
		ctx.ui.notify(notice, "warning");
	}

	private restoreEditor(ctx: ExtensionContext, text: string): void {
		try {
			const current = ctx.ui.getEditorText();
			const restored = !current.trim() || current === text ? text : `${current}\n\n${text}`;
			ctx.ui.setEditorText(restored);
		} catch {
			// Session replacement can invalidate a captured UI context; state cleanup still proceeds.
		}
	}

	private updateWidget(ctx: ExtensionContext): void {
		const state = this.batch?.publicState();
		if (!state || state.phase === "empty" || state.phase === "closed") {
			ctx.ui.setWidget(WIDGET_KEY, undefined);
			return;
		}
		const ready = state.items.filter((item) => item.status === "ready").length;
		const uploading = state.items.filter(
			(item) => item.status === "uploading" || item.status === "processing",
		).length;
		const errors = state.items.filter((item) => item.status === "error").length;
		let text = `🖼️ ${ready}/${state.items.length} images ready`;
		if (uploading > 0) text += ` · ${uploading} uploading`;
		if (errors > 0) text += ` · ${errors} need attention`;
		if (state.phase === "reserved") text = `🖼️ ${state.items.length} images queued`;
		ctx.ui.setWidget(WIDGET_KEY, [text]);
	}

	private notifyPiSettingsWarnings(ctx: ExtensionContext, warnings: string[]): void {
		const message = warnings.join("\n");
		if (!message) {
			this.lastPiSettingsWarning = "";
			return;
		}
		if (message === this.lastPiSettingsWarning) return;
		this.lastPiSettingsWarning = message;
		ctx.ui.notify(message, "warning");
	}

	private blockedReason(phase: string): string {
		return phase === "blocked"
			? "Resolve or delete failed images before sending."
			: "Wait for every image to finish uploading before sending.";
	}
}

function supportsImages(ctx: ExtensionContext): boolean {
	return ctx.model?.input.includes("image") ?? false;
}

function userMessageImages(event: unknown): ImageContent[] {
	if (!isRecord(event) || !isRecord(event.message) || event.message.role !== "user") return [];
	const content = event.message.content;
	if (!Array.isArray(content)) return [];
	return content.filter(isImageContent);
}

function containsImageSequence(images: ImageContent[], length: number, digest: string): boolean {
	for (let start = 0; start + length <= images.length; start += 1) {
		if (digestImages(images.slice(start, start + length)) === digest) return true;
	}
	return false;
}

function isImageContent(value: unknown): value is ImageContent {
	return (
		isRecord(value) &&
		value.type === "image" &&
		typeof value.data === "string" &&
		typeof value.mimeType === "string"
	);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatError(error: unknown): string {
	if (error instanceof BatchError || error instanceof Error) return error.message;
	return String(error);
}
