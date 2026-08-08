import { BorderedLoader, type ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { Key, matchesKey } from "@earendil-works/pi-tui";
import type { PublicBatchState, PublicHistoryState } from "./batch.js";
import { formatBytes } from "./format.js";
import { DEFAULT_SETTINGS, HARD_LIMITS, type ImageDropSettings } from "./settings.js";

export type LimitSettingAction =
	| "maxImages"
	| "maxImageBytes"
	| "maxBatchBytes"
	| "maxImagePixels"
	| "maxRetainedImages"
	| "maxRetainedBytes";

export interface LimitMenuValue {
	current: string;
	defaultValue: string;
	pending?: string;
}

export interface ImageDropLimitsMenuState {
	unsavedChanges: number;
	values: Record<LimitSettingAction, LimitMenuValue>;
}

export type MenuLoadResult<T> =
	| { kind: "completed"; value: T }
	| { kind: "cancelled" }
	| { kind: "closed" }
	| { kind: "error"; error: unknown };

export interface ImageDropMenuState {
	batch: PublicBatchState;
	history: PublicHistoryState;
	serverRunning: boolean;
}

const MIB = 1024 * 1024;
export const LIMIT_SETTING_ACTIONS = [
	"maxImages",
	"maxImageBytes",
	"maxBatchBytes",
	"maxImagePixels",
	"maxRetainedImages",
	"maxRetainedBytes",
] as const satisfies readonly LimitSettingAction[];

export function isLimitSettingAction(value: string): value is LimitSettingAction {
	return (LIMIT_SETTING_ACTIONS as readonly string[]).includes(value);
}

export function createLimitInputScreen(
	key: LimitSettingAction,
	draft: ImageDropSettings,
	original: ImageDropSettings,
) {
	return {
		kind: "input" as const,
		title: limitPrompt(key),
		lines: [
			`Current: ${formatLimit(key, draft[key])} · Saved: ${formatLimit(key, original[key])} · Default: ${formatLimit(key, DEFAULT_SETTINGS[key])}`,
			`Allowed: ${limitRange(key)}.`,
		],
		placeholder: limitInputValue(key, draft),
		action: "submit-limit" as const,
		hint: "back" as const,
	};
}

export function createLimitReviewScreen(original: ImageDropSettings, draft: ImageDropSettings) {
	return {
		kind: "review" as const,
		title: "Review resource-limit changes",
		content: [
			...limitChanges(original, draft),
			"",
			"These limits apply when the next Pi session starts.",
			"Higher limits may increase memory use or provider failures.",
		].join("\n"),
		format: { kind: "text" as const },
		confirm: {
			id: "save",
			label: "Save resource limits",
			action: "save-limits" as const,
		},
		hint: "back" as const,
	};
}

export type LimitInputValidation =
	| { kind: "valid"; value: number }
	| { kind: "invalid"; message: string };

export function validateLimitInput(
	key: LimitSettingAction,
	input: string,
	draft: ImageDropSettings,
): LimitInputValidation {
	const value = parseLimitInput(key, input);
	if (value === undefined || value > HARD_LIMITS[key]) {
		return { kind: "invalid", message: `Enter ${limitRange(key)}.` };
	}
	const next = { ...draft, [key]: value };
	if (next.maxImageBytes > next.maxBatchBytes) {
		return {
			kind: "invalid",
			message: "Size per image cannot exceed the combined draft size.",
		};
	}
	return { kind: "valid", value };
}

export function limitMenuDescription(
	value: ImageDropLimitsMenuState["values"][LimitSettingAction],
): string {
	return value.pending === undefined
		? `Current: ${value.current} · Default: ${value.defaultValue}`
		: `Pending: ${value.pending} · Current: ${value.current} · Default: ${value.defaultValue}`;
}

export function usesSafeLimits(settings: ImageDropSettings): boolean {
	return LIMIT_SETTING_ACTIONS.every((key) => settings[key] === DEFAULT_SETTINGS[key]);
}

export function limitMenuState(
	draft: ImageDropSettings,
	original: ImageDropSettings,
): ImageDropLimitsMenuState {
	const value = (key: LimitSettingAction) => ({
		current: formatLimitValue(key, original[key]),
		defaultValue: formatLimitValue(key, DEFAULT_SETTINGS[key]),
		...(draft[key] === original[key] ? {} : { pending: formatLimitValue(key, draft[key]) }),
	});
	return {
		unsavedChanges: limitChanges(original, draft).length,
		values: {
			maxImages: value("maxImages"),
			maxImageBytes: value("maxImageBytes"),
			maxBatchBytes: value("maxBatchBytes"),
			maxImagePixels: value("maxImagePixels"),
			maxRetainedImages: value("maxRetainedImages"),
			maxRetainedBytes: value("maxRetainedBytes"),
		},
	};
}

export function limitChanges(original: ImageDropSettings, draft: ImageDropSettings): string[] {
	return LIMIT_SETTING_ACTIONS.filter((key) => original[key] !== draft[key]).map(
		(key) =>
			`${limitLabel(key)}: ${formatLimit(key, original[key])} → ${formatLimit(key, draft[key])}`,
	);
}

export function limitSettingsPatch(
	original: ImageDropSettings,
	draft: ImageDropSettings,
): Partial<ImageDropSettings> {
	const patch: Partial<ImageDropSettings> = {};
	for (const key of LIMIT_SETTING_ACTIONS) {
		if (original[key] !== draft[key]) patch[key] = draft[key];
	}
	return patch;
}

function formatLimitValue(key: LimitSettingAction, value: number): string {
	if (key === "maxImageBytes" || key === "maxBatchBytes" || key === "maxRetainedBytes") {
		return formatBytes(value);
	}
	if (key === "maxImagePixels" && value % 1_000_000 === 0) {
		return `${value / 1_000_000} MP`;
	}
	return formatCount(value);
}

function limitPrompt(key: LimitSettingAction): string {
	const unit = byteLimit(key) ? "MiB" : key === "maxImagePixels" ? "megapixels" : "images";
	return `${limitLabel(key)} (${unit})`;
}

function limitInputValue(key: LimitSettingAction, settings: ImageDropSettings): string {
	const value = settings[key];
	if (byteLimit(key)) return String(value / MIB);
	if (key === "maxImagePixels") return String(value / 1_000_000);
	return String(value);
}

function parseLimitInput(key: LimitSettingAction, input: string): number | undefined {
	const value = Number(input.trim());
	if (!Number.isFinite(value) || value <= 0) return undefined;
	const scaled = byteLimit(key)
		? value * MIB
		: key === "maxImagePixels"
			? value * 1_000_000
			: value;
	return Number.isSafeInteger(scaled) ? scaled : undefined;
}

function limitRange(key: LimitSettingAction): string {
	return `a positive value no greater than ${formatLimit(key, HARD_LIMITS[key])}`;
}

function limitLabel(key: LimitSettingAction): string {
	return {
		maxImages: "Images for next message",
		maxImageBytes: "Per-image upload size",
		maxBatchBytes: "Total upload size",
		maxImagePixels: "Maximum image resolution",
		maxRetainedImages: "Staged + sent image count",
		maxRetainedBytes: "Staged + sent image memory",
	}[key];
}

function formatLimit(key: LimitSettingAction, value: number): string {
	if (byteLimit(key)) return formatBytes(value);
	return key === "maxImagePixels" ? formatCount(value) : String(value);
}

function byteLimit(key: LimitSettingAction): boolean {
	return key === "maxImageBytes" || key === "maxBatchBytes" || key === "maxRetainedBytes";
}

function formatCount(value: number): string {
	return value >= 1_000_000
		? `${Number((value / 1_000_000).toFixed(1))} megapixels`
		: String(value);
}

export function runImageDropMenuLoad<T>(
	ctx: ExtensionCommandContext,
	label: string,
	task: (signal: AbortSignal) => Promise<T>,
): Promise<MenuLoadResult<T>> {
	return ctx.ui.custom<MenuLoadResult<T>>((tui, theme, _keybindings, done) => {
		const loader = new BorderedLoader(tui, theme, label);
		const taskAbort = new AbortController();
		let settled = false;
		const finish = (result: MenuLoadResult<T>) => {
			if (settled) return;
			settled = true;
			done(result);
		};
		loader.onAbort = () => {
			taskAbort.abort();
			finish({ kind: "cancelled" });
		};
		void task(taskAbort.signal).then(
			(value) => finish({ kind: "completed", value }),
			(error: unknown) => finish({ kind: "error", error }),
		);
		return {
			render: (width: number) => loader.render(width),
			invalidate: () => loader.invalidate(),
			handleInput(data: string) {
				if (matchesKey(data, Key.ctrl("c"))) {
					taskAbort.abort();
					finish({ kind: "closed" });
					loader.handleInput(data);
					return;
				}
				loader.handleInput(data);
			},
			dispose() {
				taskAbort.abort();
				loader.dispose();
			},
		};
	});
}

export function menuSummary(state: ImageDropMenuState): string {
	const total = state.batch.items.length;
	if (state.batch.phase === "empty" || total === 0) return "Draft: No images staged";
	if (state.batch.phase === "reserved") {
		return `Draft: ${total} ${total === 1 ? "image" : "images"} queued with Pi`;
	}
	const ready = state.batch.items.filter((item) => item.status === "ready").length;
	const processing = state.batch.items.filter(
		(item) => item.status === "uploading" || item.status === "processing",
	).length;
	const errors = state.batch.items.filter((item) => item.status === "error").length;
	const parts = [`Draft: ${ready}/${total} ready`];
	if (processing > 0) parts.push(`${processing} processing`);
	if (errors > 0) parts.push(`${errors} need attention`);
	return parts.join(" · ");
}

export function safeMenuText(value: string): string {
	return [...value]
		.map((character) => {
			const code = character.codePointAt(0) ?? 0;
			return code <= 0x1f || (code >= 0x7f && code <= 0x9f) ? " " : character;
		})
		.join("")
		.replace(/\s+/g, " ")
		.trim();
}
