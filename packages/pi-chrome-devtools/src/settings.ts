import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import {
	access,
	lstat,
	mkdir,
	readFile,
	realpath,
	rename,
	rm,
	stat,
	writeFile,
} from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { CONFIG_DIR_NAME, getAgentDir } from "@earendil-works/pi-coding-agent";
import { CHROME_DEVTOOLS_TOOL_NAMES, type ChromeDevToolsToolName } from "./tool-names.js";

const NEW_SETTINGS_FILE_NAME = "pi-chrome-devtools.json";
const LEGACY_SETTINGS_FILE_NAME = "pi-chrome-devtools-settings.json";

export interface ChromeDevToolsSettings {
	tools: ChromeDevToolsToolName[];
	updatedAt: number;
}

export type BrowserSettingsSource = "default" | "environment" | "project" | "user";

export interface EffectiveBrowserSettings {
	executablePath?: string;
	extensionPaths: string[];
	executablePathSource: BrowserSettingsSource;
	extensionPathsSource: BrowserSettingsSource;
}

export interface ResolvedChromeDevToolsSettings {
	tools?: ChromeDevToolsToolName[];
	updatedAt?: number;
	browser: EffectiveBrowserSettings;
}

export interface SettingsLoadOptions {
	cwd?: string;
	projectTrusted?: boolean;
}

interface SettingsLoadBase {
	effectiveBrowser: EffectiveBrowserSettings;
	paths: { user: string; project?: string };
	warnings: string[];
	notice?: string;
}

export type SettingsLoadResult =
	| (SettingsLoadBase & { kind: "missing"; settings?: undefined })
	| (SettingsLoadBase & { kind: "invalid"; reason: string; settings?: undefined })
	| (SettingsLoadBase & { kind: "loaded"; settings: ResolvedChromeDevToolsSettings });

export interface SettingsFileOperations {
	write(path: string, data: string): Promise<void>;
	rename(source: string, destination: string): Promise<void>;
}

interface NormalizedBrowserSection {
	executablePath?: string;
	extensionPaths?: string[];
}

interface NormalizedSettingsDocument {
	tools?: ChromeDevToolsToolName[];
	updatedAt?: number;
	browser?: NormalizedBrowserSection;
}

interface SettingsDocumentResult {
	kind: "missing" | "invalid" | "valid";
	reason?: string;
	document?: Record<string, unknown>;
	normalized?: NormalizedSettingsDocument;
	warnings: string[];
}

const DEFAULT_FILE_OPERATIONS: SettingsFileOperations = {
	write: (path, data) => writeFile(path, data, "utf8").then(() => undefined),
	rename,
};

let settingsSaveQueue = Promise.resolve();

export async function loadSettings(options: SettingsLoadOptions = {}): Promise<SettingsLoadResult> {
	await settingsSaveQueue;
	const userPath = settingsFilePath();
	const projectPath = options.cwd ? projectSettingsFilePath(options.cwd) : undefined;
	const paths = { user: userPath, ...(projectPath ? { project: projectPath } : {}) };
	const warnings: string[] = [];

	let user = await readSettingsDocument(userPath, "user");
	const legacyExists = await fileExists(legacySettingsFilePath());
	if (user.kind !== "missing" && legacyExists) {
		warnings.push(
			`Chrome DevTools legacy settings ignored: ${legacySettingsFilePath()} exists, but ${userPath} takes precedence. Delete ${LEGACY_SETTINGS_FILE_NAME} after confirming your settings.`,
		);
	}
	if (user.kind === "missing") {
		const legacy = await readSettingsDocument(legacySettingsFilePath(), "user");
		const concurrentlyCreated = await readSettingsDocument(userPath, "user");
		if (concurrentlyCreated.kind !== "missing") {
			user = concurrentlyCreated;
			if (legacy.kind !== "missing") {
				warnings.push(
					`Chrome DevTools legacy settings ignored: ${legacySettingsFilePath()} exists, but ${userPath} takes precedence. Delete ${LEGACY_SETTINGS_FILE_NAME} after confirming your settings.`,
				);
			}
		} else if (legacy.kind !== "missing") {
			user = legacy;
			if (legacy.kind === "valid") {
				warnings.push(
					`Using legacy ${LEGACY_SETTINGS_FILE_NAME}; rename it to ${NEW_SETTINGS_FILE_NAME}. Future saves write ${NEW_SETTINGS_FILE_NAME} without modifying the legacy file.`,
				);
			}
		}
	}
	warnings.push(...user.warnings);

	let project: SettingsDocumentResult = { kind: "missing", warnings: [] };
	if (projectPath && options.projectTrusted) {
		project = await readSettingsDocument(projectPath, "project", options.cwd);
		warnings.push(...project.warnings);
	}

	const effectiveBrowser = resolveEffectiveBrowser(
		user.normalized?.browser,
		project.normalized?.browser,
	);
	const settings = resolveSettings(user.normalized, project.normalized, effectiveBrowser);
	const recognized =
		settings.tools !== undefined ||
		user.normalized?.browser !== undefined ||
		project.normalized?.browser !== undefined;
	const invalidReasons = [user, project]
		.filter((result) => result.kind === "invalid")
		.map((result) => result.reason)
		.filter((reason): reason is string => Boolean(reason));
	const base = {
		effectiveBrowser,
		paths,
		warnings,
		...(warnings.length > 0 ? { notice: warnings.join("\n") } : {}),
	};

	if (recognized) return { ...base, kind: "loaded", settings };
	if (invalidReasons.length > 0) {
		return { ...base, kind: "invalid", reason: invalidReasons.join("; ") };
	}
	return { ...base, kind: "missing" };
}

function resolveSettings(
	user: NormalizedSettingsDocument | undefined,
	_project: NormalizedSettingsDocument | undefined,
	browser: EffectiveBrowserSettings,
): ResolvedChromeDevToolsSettings {
	return {
		...(user?.tools ? { tools: user.tools, updatedAt: user.updatedAt } : {}),
		browser,
	};
}

function resolveEffectiveBrowser(
	user: NormalizedBrowserSection | undefined,
	project: NormalizedBrowserSection | undefined,
): EffectiveBrowserSettings {
	const environmentExecutable = process.env.PI_CHROME_DEVTOOLS_BROWSER;
	const executablePath = environmentExecutable || user?.executablePath;
	const extensionPaths = project?.extensionPaths ?? user?.extensionPaths ?? [];
	return {
		...(executablePath ? { executablePath } : {}),
		extensionPaths: [...extensionPaths],
		executablePathSource: environmentExecutable
			? "environment"
			: user?.executablePath
				? "user"
				: "default",
		extensionPathsSource: project?.extensionPaths
			? "project"
			: user?.extensionPaths
				? "user"
				: "default",
	};
}

async function readSettingsDocument(
	filePath: string,
	scope: "project" | "user",
	cwd?: string,
): Promise<SettingsDocumentResult> {
	let text: string;
	try {
		text = await readFile(filePath, "utf8");
	} catch (error) {
		if (isNodeError(error) && error.code === "ENOENT") return { kind: "missing", warnings: [] };
		const reason = `${filePath}: ${formatError(error)}`;
		return { kind: "invalid", reason, warnings: [`Chrome DevTools settings ignored: ${reason}`] };
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(text) as unknown;
	} catch {
		const reason = `${filePath}: invalid JSON`;
		return { kind: "invalid", reason, warnings: [`Chrome DevTools settings ignored: ${reason}`] };
	}
	if (!isRecord(parsed)) {
		const reason = `${filePath}: expected a JSON object`;
		return { kind: "invalid", reason, warnings: [`Chrome DevTools settings ignored: ${reason}`] };
	}

	const scopeWarnings = projectExecutableWarnings(parsed, scope, filePath);
	try {
		const normalized = await normalizeSettingsDocument(parsed, scope, filePath, cwd);
		return { kind: "valid", document: { ...parsed }, normalized, warnings: scopeWarnings };
	} catch (error) {
		const reason = `${filePath}: ${formatError(error)}`;
		return {
			kind: "invalid",
			reason,
			warnings: [...scopeWarnings, `Chrome DevTools settings ignored: ${reason}`],
		};
	}
}

function projectExecutableWarnings(
	document: Record<string, unknown>,
	scope: "project" | "user",
	filePath: string,
) {
	if (
		scope !== "project" ||
		!isRecord(document.browser) ||
		document.browser.executablePath === undefined
	) {
		return [];
	}
	return [
		`Chrome DevTools project browser.executablePath ignored in ${filePath}; configure the machine-owned executable in ${settingsFilePath()}.`,
	];
}

async function normalizeSettingsDocument(
	document: Record<string, unknown>,
	scope: "project" | "user",
	filePath: string,
	cwd?: string,
): Promise<NormalizedSettingsDocument> {
	const normalized: NormalizedSettingsDocument = {};

	if (scope === "user" && (document.tools !== undefined || document.updatedAt !== undefined)) {
		const toolSettings = normalizeChromeDevtoolsSettings(document);
		if (!toolSettings) {
			throw new Error(
				"expected tools to be an array of Chrome DevTools tool names with numeric updatedAt",
			);
		}
		normalized.tools = toolSettings.tools;
		normalized.updatedAt = toolSettings.updatedAt;
	}

	if (document.browser !== undefined) {
		if (!isRecord(document.browser)) throw new Error("expected browser to be an object");
		normalized.browser = await normalizeBrowserSection(document.browser, scope, filePath, cwd);
	}

	return normalized;
}

async function normalizeBrowserSection(
	browser: Record<string, unknown>,
	scope: "project" | "user",
	_filePath: string,
	cwd?: string,
): Promise<NormalizedBrowserSection> {
	const normalized: NormalizedBrowserSection = {};
	if (scope === "user" && browser.executablePath !== undefined) {
		if (typeof browser.executablePath !== "string" || browser.executablePath.length === 0) {
			throw new Error("expected browser.executablePath to be a non-empty absolute path");
		}
		if (!isAbsolute(browser.executablePath)) {
			throw new Error("browser.executablePath in user settings must be absolute");
		}
		normalized.executablePath = resolve(browser.executablePath);
	}

	if (browser.extensionPaths !== undefined) {
		if (
			!Array.isArray(browser.extensionPaths) ||
			!browser.extensionPaths.every((entry) => typeof entry === "string" && entry.length > 0)
		) {
			throw new Error(`expected ${scope} browser.extensionPaths to be an array of non-empty paths`);
		}
		const resolvedPaths: string[] = [];
		for (const configuredPath of browser.extensionPaths as string[]) {
			if (scope === "user" && !isAbsolute(configuredPath)) {
				throw new Error("browser.extensionPaths in user settings must contain only absolute paths");
			}
			const absolutePath = isAbsolute(configuredPath)
				? resolve(configuredPath)
				: resolve(cwd ?? process.cwd(), configuredPath);
			resolvedPaths.push(await validateUnpackedExtensionPath(absolutePath));
		}
		normalized.extensionPaths = orderedUnique(resolvedPaths);
	}
	return normalized;
}

async function validateUnpackedExtensionPath(extensionPath: string) {
	let canonicalPath: string;
	try {
		canonicalPath = await realpath(extensionPath);
		const extensionStat = await stat(canonicalPath);
		if (!extensionStat.isDirectory()) throw new Error("not a directory");
	} catch (error) {
		throw new Error(`unpacked extension path ${extensionPath} is invalid: ${formatError(error)}`);
	}

	const manifestPath = join(canonicalPath, "manifest.json");
	let manifest: unknown;
	try {
		const manifestStat = await lstat(manifestPath);
		if (!manifestStat.isFile()) throw new Error("not a regular file");
		manifest = JSON.parse(await readFile(manifestPath, "utf8")) as unknown;
	} catch (error) {
		throw new Error(
			`unpacked extension ${canonicalPath} has invalid manifest.json: ${formatError(error)}`,
		);
	}
	if (canonicalPath.includes(",")) {
		throw new Error(
			`unpacked extension path ${canonicalPath} cannot contain a comma because Chrome separates multiple --load-extension paths with commas`,
		);
	}
	if (
		!isRecord(manifest) ||
		![2, 3].includes(manifest.manifest_version as number) ||
		typeof manifest.name !== "string" ||
		typeof manifest.version !== "string"
	) {
		throw new Error(
			`unpacked extension ${canonicalPath} has invalid manifest.json: expected manifest_version, name, and version`,
		);
	}
	return canonicalPath;
}

export function normalizeChromeDevtoolsSettings(
	value: unknown,
): ChromeDevToolsSettings | undefined {
	if (!isRecord(value)) return undefined;
	if (typeof value.updatedAt !== "number" || !Number.isFinite(value.updatedAt)) return undefined;

	if (value.tools === "enabled") {
		return { tools: [...CHROME_DEVTOOLS_TOOL_NAMES], updatedAt: value.updatedAt };
	}
	if (value.tools === "disabled") return { tools: [], updatedAt: value.updatedAt };
	if (!Array.isArray(value.tools) || !value.tools.every(isChromeDevtoolsToolName)) return undefined;
	return { tools: orderedUniqueChromeDevtoolsTools(value.tools), updatedAt: value.updatedAt };
}

function isChromeDevtoolsToolName(value: unknown): value is ChromeDevToolsToolName {
	return typeof value === "string" && CHROME_DEVTOOLS_TOOL_NAMES.includes(value as never);
}

function orderedUniqueChromeDevtoolsTools(tools: readonly ChromeDevToolsToolName[]) {
	const selectedTools = new Set(tools);
	return CHROME_DEVTOOLS_TOOL_NAMES.filter((toolName) => selectedTools.has(toolName));
}

function orderedUnique(values: readonly string[]) {
	return [...new Set(values)];
}

export function saveSettings(
	settings: ChromeDevToolsSettings,
	operations: Partial<SettingsFileOperations> = {},
): Promise<void> {
	const operation = settingsSaveQueue.then(() => saveSettingsNow(settings, operations));
	settingsSaveQueue = operation.catch(() => undefined);
	return operation;
}

async function saveSettingsNow(
	settings: ChromeDevToolsSettings,
	operations: Partial<SettingsFileOperations>,
): Promise<void> {
	const filePath = settingsFilePath();
	let current = await readSettingsDocument(filePath, "user");
	const replaceCanonical = current.kind !== "missing";
	if (!replaceCanonical) current = await readSettingsDocument(legacySettingsFilePath(), "user");
	if (current.kind === "invalid") {
		throw new Error(`Cannot save Chrome DevTools settings until you repair ${current.reason}`);
	}
	const nextDocument = {
		...(current.document ?? {}),
		tools: [...settings.tools],
		updatedAt: settings.updatedAt,
	};
	await mkdir(dirname(filePath), { recursive: true });
	const tempFile = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
	try {
		await (operations.write ?? DEFAULT_FILE_OPERATIONS.write)(
			tempFile,
			`${JSON.stringify(nextDocument, null, 2)}\n`,
		);
		if (!replaceCanonical && (await pathEntryExists(filePath))) {
			throw new Error(
				`${NEW_SETTINGS_FILE_NAME} was created concurrently; reopen settings and retry.`,
			);
		}
		await (operations.rename ?? DEFAULT_FILE_OPERATIONS.rename)(tempFile, filePath);
	} catch (error) {
		await rm(tempFile, { force: true }).catch(() => undefined);
		throw error;
	}
}

export function settingsFilePath() {
	return join(getAgentDir(), NEW_SETTINGS_FILE_NAME);
}

export function projectSettingsFilePath(cwd: string) {
	return join(cwd, CONFIG_DIR_NAME, NEW_SETTINGS_FILE_NAME);
}

function legacySettingsFilePath() {
	return join(getAgentDir(), LEGACY_SETTINGS_FILE_NAME);
}

async function fileExists(filePath: string) {
	try {
		await access(filePath, constants.F_OK);
		return true;
	} catch {
		return false;
	}
}

async function pathEntryExists(filePath: string) {
	try {
		await lstat(filePath);
		return true;
	} catch (error) {
		if (isNodeError(error) && error.code === "ENOENT") return false;
		throw error;
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
	return error instanceof Error && "code" in error;
}

function formatError(error: unknown) {
	return error instanceof Error ? error.message : String(error);
}
