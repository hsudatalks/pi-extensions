import { stripVTControlCharacters } from "node:util";
import {
	DynamicBorder,
	type ExtensionCommandContext,
	type KeybindingsManager,
} from "@earendil-works/pi-coding-agent";
import {
	Container,
	Key,
	matchesKey,
	type SelectItem,
	SelectList,
	Text,
} from "@earendil-works/pi-tui";
import { runCustomInteraction } from "@narumitw/pi-tui-kit";
import type { StarshipPreset } from "./presets/catalog.js";

export type PresetPickerResult =
	| { kind: "apply"; presetId: StarshipPreset["id"] }
	| { kind: "customize"; presetId: StarshipPreset["id"] }
	| { kind: "back" }
	| { kind: "close" };

export interface PresetPickerOptions {
	presets: readonly StarshipPreset[];
	activePresetId?: StarshipPreset["id"];
	initialPresetId?: StarshipPreset["id"];
	signal: AbortSignal;
	isCurrent(): boolean;
	preview(preset: StarshipPreset): void;
}

export async function showPresetPicker(
	ctx: ExtensionCommandContext,
	options: PresetPickerOptions,
): Promise<PresetPickerResult> {
	const items: SelectItem[] = options.presets.map((preset) => ({
		value: preset.id,
		label: `${preset.id === options.activePresetId ? "[-] " : ""}${preset.label}`,
		description:
			preset.id === options.activePresetId
				? `Currently applied · ${preset.description}`
				: preset.description,
	}));
	const initialIndex = Math.max(
		0,
		options.presets.findIndex(
			(preset) => preset.id === (options.initialPresetId ?? options.activePresetId),
		),
	);
	const result = await runCustomInteraction<PresetPickerResult>(ctx, {
		signal: options.signal,
		isCurrent: options.isCurrent,
		create({ tui, theme, keybindings, complete }) {
			const container = new Container();
			const topBorder = new DynamicBorder((text: string) => theme.fg("accent", text));
			const bottomBorder = new DynamicBorder((text: string) => theme.fg("accent", text));
			const title = new Text("", 1, 0);
			const detail = new Text("", 1, 0);
			const hint = new Text("", 1, 0);
			const viewportSize = Math.min(items.length, 10);
			const list = new SelectList(items, viewportSize, {
				selectedPrefix: (text) => theme.fg("accent", text),
				selectedText: (text) => theme.fg("accent", text),
				description: (text) => theme.fg("muted", text),
				scrollInfo: (text) => theme.fg("dim", text),
				noMatch: (text) => theme.fg("warning", text),
			});
			const selectedPreset = () => {
				const id = list.getSelectedItem()?.value;
				return options.presets.find((preset) => preset.id === id);
			};
			const updateSelectedText = () => {
				const preset = selectedPreset();
				if (!preset) return;
				detail.setText(
					theme.fg(
						"muted",
						`Selected: ${preset.label} · ${preset.requiresNerdFont ? "requires Nerd Font" : "font-safe"}`,
					),
				);
			};
			const previewSelected = () => {
				const preset = selectedPreset();
				if (!preset) return;
				updateSelectedText();
				options.preview(preset);
			};
			const updateThemedText = () => {
				const current =
					options.presets.find((preset) => preset.id === options.activePresetId)?.label ??
					"Custom configuration";
				title.setText(theme.fg("accent", theme.bold(`Presets · current: ${current}`)));
				hint.setText(theme.fg("dim", pickerHint(keybindings)));
			};

			let selectedIndex = initialIndex;
			const select = (index: number) => {
				if (items.length === 0) return;
				selectedIndex = Math.max(0, Math.min(index, items.length - 1));
				list.setSelectedIndex(selectedIndex);
				previewSelected();
			};
			const move = (delta: number) => {
				if (items.length === 0) return;
				select((selectedIndex + delta + items.length) % items.length);
			};
			const applySelected = () => {
				const preset = selectedPreset();
				if (preset && preset.id !== options.activePresetId) {
					complete({ kind: "apply", presetId: preset.id });
				}
			};
			list.setSelectedIndex(initialIndex);
			container.addChild(topBorder);
			container.addChild(title);
			container.addChild(list);
			container.addChild(detail);
			container.addChild(hint);
			container.addChild(bottomBorder);
			updateThemedText();
			previewSelected();

			return {
				render: (width: number) => container.render(width),
				invalidate() {
					container.invalidate();
					updateThemedText();
					updateSelectedText();
				},
				handleInput(data: string) {
					if (matchesKey(data, Key.ctrl("c"))) {
						complete({ kind: "close" });
					} else if (keybindings.matches(data, "tui.select.cancel")) {
						complete({ kind: "back" });
					} else if (keybindings.matches(data, "tui.select.up")) {
						move(-1);
					} else if (keybindings.matches(data, "tui.select.down")) {
						move(1);
					} else if (keybindings.matches(data, "tui.select.pageUp")) {
						select(selectedIndex - Math.max(1, viewportSize));
					} else if (keybindings.matches(data, "tui.select.pageDown")) {
						select(selectedIndex + Math.max(1, viewportSize));
					} else if (matchesKey(data, Key.home)) {
						select(0);
					} else if (matchesKey(data, Key.end)) {
						select(items.length - 1);
					} else if (data === "e" || data === "E") {
						const preset = selectedPreset();
						if (preset) complete({ kind: "customize", presetId: preset.id });
					} else if (keybindings.matches(data, "tui.select.confirm")) {
						applySelected();
					}
					tui.requestRender();
				},
			};
		},
	});
	return result.kind === "completed" ? result.value : { kind: "close" };
}

function pickerHint(keybindings: Pick<KeybindingsManager, "getKeys">): string {
	const up = bindingText(keybindings, "tui.select.up");
	const down = bindingText(keybindings, "tui.select.down");
	const confirm = bindingText(keybindings, "tui.select.confirm");
	const cancel = bindingText(keybindings, "tui.select.cancel", "ctrl+c");
	const pageUp = bindingText(keybindings, "tui.select.pageUp");
	const pageDown = bindingText(keybindings, "tui.select.pageDown");
	return [
		...(up || down ? [`${[up, down].filter(Boolean).join("/")} live preview`] : []),
		...(confirm ? [`${confirm} apply`] : []),
		"e customize",
		...(cancel ? [`${cancel} back`] : []),
		"ctrl+c close",
		...(pageUp || pageDown ? [`${[pageUp, pageDown].filter(Boolean).join("/")} page preview`] : []),
	].join(" • ");
}

function bindingText(
	keybindings: Pick<KeybindingsManager, "getKeys">,
	binding: Parameters<KeybindingsManager["getKeys"]>[0],
	excluded?: string,
): string {
	return keybindings
		.getKeys(binding)
		.filter((key) => key !== excluded)
		.map((key) => {
			if (key === "up") return "↑";
			if (key === "down") return "↓";
			if (key === "escape") return "esc";
			if (key === "return") return "enter";
			return safeDisplayText(key);
		})
		.join("/");
}

function safeDisplayText(value: string): string {
	return Array.from(stripVTControlCharacters(value), (character) => {
		const codePoint = character.codePointAt(0) ?? 0;
		const control = codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f);
		return control ? "" : character;
	}).join("");
}
