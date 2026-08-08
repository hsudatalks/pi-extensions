#!/usr/bin/env node

import { chmodSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_FORK_REF = "main";
const MANAGED_PACKAGE_ROOT = "univers/node_modules/@narumitw";
const DELEGATION_START = "<!-- univers-pi-delegation:start -->";
const DELEGATION_END = "<!-- univers-pi-delegation:end -->";
const DELEGATION_GUIDANCE = `${DELEGATION_START}
## Delegation policy

You are the primary implementation agent. Own normal investigation, editing, testing, and delivery yourself. Delegate only when a specialist has a clear comparative advantage:

- Use the explorer for unfamiliar or cross-cutting code, visual or image evidence, broad reconnaissance, or when key facts remain uncertain.
- Use the advisor for consequential architecture, difficult root-cause analysis, security or reliability risk, or a real choice between competing designs. When the advisor needs to implement or repair the result, use stateful delegation so it retains its full read, write, edit, and command tools; reserve subagent_consult for analysis that must remain read-only.
- Use the GLM specialist for an independent implementation path, Chinese-language or China-ecosystem work, or when the primary model is stuck and a materially different model is likely to help.
- Use the validator after user-visible, release-bound, cross-module, or otherwise high-risk changes when independent acceptance evidence is valuable.
- Do not delegate short, obvious, well-localized work; do not ask a specialist to repeat evidence already established; do not delegate merely to consume subscription capacity.
- Run at most one specialist at a time. Give it a bounded question and concrete acceptance criteria, then integrate its evidence yourself. Do not delegate recursively.
${DELEGATION_END}`;

const AGENTS = {
	"advisor.md": `---
name: advisor
description: High-reasoning Sol advisor for architecture, diagnosis, implementation, and review
tools: read,grep,find,ls,bash,edit,write
model: openai-codex/gpt-5.6-sol:high
---

Act as a senior technical advisor and implementation specialist. Analyze architecture, risks, evidence, and proposed changes.
When the delegated task asks for implementation or repair, edit the files, run focused verification, and leave the workspace in a coherent state. Otherwise return a decisive recommendation with exact evidence.
`,
	"glm-specialist.md": `---
name: glm-specialist
description: GLM-5.2 specialist for independent analysis, implementation, and verification
tools: read,grep,find,ls,bash,edit,write
model: zai-coding-cn/glm-5.2:high
---

Act as an independent senior implementation specialist. Investigate the task from first principles, edit files when implementation is requested, and run focused verification.
Return a concise account of decisions, changed files, verification evidence, and remaining risks. Do not delegate recursively.
`,
	"explorer.md": `---
name: explorer
description: Multimodal Luna explorer for fast source, screenshot, image, and UI reconnaissance
tools: read,grep,find,ls,bash
model: openai-codex/gpt-5.6-luna:medium
---

Explore the requested area and return compact, source-grounded findings for the parent agent.
Do not modify files. Use bash only for read-only inspection. Read supplied image or screenshot paths directly and report concrete visual evidence when present.
Include exact paths, observations, and open questions.
`,
	"validator.md": `---
name: validator
description: Multimodal high-reasoning Luna validator for independent functional and visual acceptance
tools: read,grep,find,ls,bash
model: openai-codex/gpt-5.6-luna:high
---

Independently validate the requested result against its acceptance criteria.
Do not modify files. Use bash only for read-only verification. Inspect supplied screenshots and image files directly when visual behavior matters.
Return PASS, FAIL, or PARTIAL with exact evidence, missing proof, regressions, and the smallest next action.
`,
};

export function configureUniversProfile({
	agentDir,
	codexAuthPath,
	forkRef = DEFAULT_FORK_REF,
	opencodeKey,
	zaiCodingCnKey,
}) {
	if (!agentDir) throw new Error("agentDir is required");
	if (!codexAuthPath) throw new Error("codexAuthPath is required");
	if (!/^[A-Za-z0-9._/-]+$/.test(forkRef))
		throw new Error("forkRef contains unsupported characters");

	mkdirSync(agentDir, { recursive: true, mode: 0o700 });
	chmodSync(agentDir, 0o700);

	const settingsPath = join(agentDir, "settings.json");
	const authPath = join(agentDir, "auth.json");
	const settings = readJsonObject(settingsPath, {});
	const auth = readJsonObject(authPath, {});
	const codexAuth = readJsonObject(codexAuthPath);

	const codexCredential = codexOAuthCredential(codexAuth);
	const existingCodexCredential = auth["openai-codex"];
	auth["openai-codex"] = newerMatchingOAuth(existingCodexCredential, codexCredential);
	if (opencodeKey !== undefined) {
		if (!opencodeKey.trim()) throw new Error("OpenCode Go key is empty");
		auth["opencode-go"] = { type: "api_key", key: opencodeKey.trim() };
	}
	if (!validApiKeyCredential(auth["opencode-go"])) {
		throw new Error("OpenCode Go authentication is missing; provide --opencode-key-stdin");
	}
	if (zaiCodingCnKey !== undefined) {
		if (!zaiCodingCnKey.trim()) throw new Error("Z.AI Coding CN key is empty");
		auth["zai-coding-cn"] = { type: "api_key", key: zaiCodingCnKey.trim() };
	}
	if (!validApiKeyCredential(auth["zai-coding-cn"])) {
		throw new Error("Z.AI Coding CN authentication is missing; provide --zai-coding-cn-key-stdin");
	}

	settings.defaultProvider = "opencode-go";
	settings.defaultModel = "deepseek-v4-flash";
	settings.defaultThinkingLevel = "high";
	settings.packages = mergePackages(settings.packages, agentDir);

	atomicWriteJson(settingsPath, settings, 0o600);
	atomicWriteJson(authPath, auth, 0o600);
	atomicWrite(join(agentDir, "univers", "fork-ref"), `${forkRef}\n`, 0o600);

	const agentsDir = join(agentDir, "agents");
	mkdirSync(agentsDir, { recursive: true, mode: 0o700 });
	chmodSync(agentsDir, 0o700);
	for (const [name, contents] of Object.entries(AGENTS)) {
		atomicWrite(join(agentsDir, name), contents, 0o600);
	}
	rmSync(join(agentsDir, "executor.md"), { force: true });
	atomicWrite(
		join(agentDir, "APPEND_SYSTEM.md"),
		mergeManagedSection(readText(join(agentDir, "APPEND_SYSTEM.md")), DELEGATION_GUIDANCE),
		0o600,
	);

	atomicWriteJson(
		join(agentDir, "pi-subagents.json"),
		{
			agents: {
				advisor: { thinkingLevel: "high", timeoutMs: 1_800_000 },
				explorer: { thinkingLevel: "medium", timeoutMs: 900_000 },
				"glm-specialist": { thinkingLevel: "high", timeoutMs: 1_800_000 },
				validator: { thinkingLevel: "high", timeoutMs: 900_000 },
			},
			blocking: { enabled: true },
			stateful: {
				enabled: true,
				transport: "subprocess",
				completionDelivery: "auto-resume",
				maxAgents: 4,
				maxActiveTurns: 1,
				maxChildrenPerAgent: 1,
				maxDepth: 0,
				idleTtlMs: 300_000,
				maxStoredAgents: 8,
				retentionDays: 3,
			},
			consult: { resources: "project-context" },
			cwdPolicy: {
				consultation: "anywhere",
				delegation: "trusted-targets",
			},
		},
		0o600,
	);

	atomicWriteJson(
		join(agentDir, "pi-goal.json"),
		{
			toolVisibility: "always",
			experimental: { goals: false },
			rpc: { enabled: false },
			continuationLimits: { automaticTurns: 50, noProgressTurns: 3 },
		},
		0o600,
	);

	return inspectUniversProfile({ agentDir, forkRef });
}

export function inspectUniversProfile({ agentDir, forkRef = DEFAULT_FORK_REF }) {
	const settings = readJsonObject(join(agentDir, "settings.json"), {});
	const auth = readJsonObject(join(agentDir, "auth.json"), {});
	const subagents = readJsonObject(join(agentDir, "pi-subagents.json"), {});
	const goal = readJsonObject(join(agentDir, "pi-goal.json"), {});
	const packageSources = universPackageSources(agentDir);
	const packageEntries = Array.isArray(settings.packages)
		? settings.packages.filter(
				(entry) => entry && typeof entry === "object" && packageSources.includes(entry.source),
			)
		: [];
	return {
		mainModel:
			settings.defaultProvider === "opencode-go" && settings.defaultModel === "deepseek-v4-flash",
		forkPackage:
			packageEntries.length === 2 &&
			packageSources.every((source) => fileExists(join(source, "src", "index.ts"))) &&
			packageEntries.every(
				(entry) =>
					JSON.stringify(entry.extensions) === '["src/index.ts"]' &&
					JSON.stringify(entry.skills) === "[]" &&
					JSON.stringify(entry.prompts) === "[]" &&
					JSON.stringify(entry.themes) === "[]",
			) &&
			fileContentEquals(join(agentDir, "univers", "fork-ref"), `${forkRef}\n`),
		openCodeAuth: validApiKeyCredential(auth["opencode-go"]),
		zaiCodingCnAuth: validApiKeyCredential(auth["zai-coding-cn"]),
		codexAuth: validOAuthCredential(auth["openai-codex"]),
		agents:
			Object.entries(AGENTS).every(([name, contents]) =>
				fileContentEquals(join(agentDir, "agents", name), contents),
			) && !fileExists(join(agentDir, "agents", "executor.md")),
		delegationPolicy: readText(join(agentDir, "APPEND_SYSTEM.md")).includes(DELEGATION_GUIDANCE),
		subagents:
			JSON.stringify(Object.keys(subagents.agents ?? {}).sort()) ===
				JSON.stringify(["advisor", "explorer", "glm-specialist", "validator"]) &&
			subagents.stateful?.enabled === true &&
			subagents.stateful?.transport === "subprocess" &&
			subagents.stateful?.completionDelivery === "auto-resume" &&
			subagents.stateful?.maxAgents === 4 &&
			subagents.stateful?.maxActiveTurns === 1 &&
			subagents.stateful?.maxDepth === 0 &&
			subagents.stateful?.maxStoredAgents === 8,
		goal:
			goal.toolVisibility === "always" &&
			goal.experimental?.goals === false &&
			goal.rpc?.enabled === false &&
			goal.continuationLimits?.automaticTurns === 50 &&
			goal.continuationLimits?.noProgressTurns === 3,
	};
}

export function mergePackages(value, agentDir) {
	const packages = Array.isArray(value) ? value : [];
	const retained = packages.filter((entry) => {
		const source = typeof entry === "string" ? entry : entry?.source;
		if (typeof source !== "string") return true;
		if (source.startsWith("git:github.com/hsudatalks/pi-extensions")) return false;
		if (source.includes(`/${MANAGED_PACKAGE_ROOT}/`)) return false;
		return !/^npm:@narumitw\/(pi-goal|pi-subagents)(?:@[^/]+)?$/.test(source);
	});
	for (const source of universPackageSources(agentDir)) {
		retained.push({ source, extensions: ["src/index.ts"], skills: [], prompts: [], themes: [] });
	}
	return retained;
}

function universPackageSources(agentDir) {
	return ["pi-goal", "pi-subagents"].map((name) => join(agentDir, MANAGED_PACKAGE_ROOT, name));
}

export function codexOAuthCredential(codexAuth) {
	if (codexAuth.auth_mode !== "chatgpt")
		throw new Error("Codex auth is not a ChatGPT subscription");
	const tokens = codexAuth.tokens;
	if (!tokens || typeof tokens !== "object") throw new Error("Codex auth tokens are missing");
	for (const key of ["access_token", "refresh_token", "account_id"]) {
		if (typeof tokens[key] !== "string" || !tokens[key]) throw new Error(`Codex ${key} is missing`);
	}
	return {
		type: "oauth",
		access: tokens.access_token,
		refresh: tokens.refresh_token,
		expires: jwtExpiryMs(tokens.access_token),
		accountId: tokens.account_id,
	};
}

export function newerMatchingOAuth(existing, imported) {
	if (
		validOAuthCredential(existing) &&
		existing.accountId === imported.accountId &&
		existing.expires > imported.expires
	) {
		return existing;
	}
	return imported;
}

export function jwtExpiryMs(token) {
	const payload = token.split(".")[1];
	if (!payload) throw new Error("Codex access token is not a JWT");
	let decoded;
	try {
		decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
	} catch {
		throw new Error("Codex access token JWT payload is invalid");
	}
	if (!Number.isSafeInteger(decoded.exp) || decoded.exp <= 0) {
		throw new Error("Codex access token JWT expiry is missing");
	}
	return decoded.exp * 1000;
}

function readJsonObject(path, fallback) {
	try {
		const value = JSON.parse(readFileSync(path, "utf8"));
		if (!value || typeof value !== "object" || Array.isArray(value)) {
			throw new Error(`${path} must contain a JSON object`);
		}
		return value;
	} catch (error) {
		if (fallback !== undefined && error?.code === "ENOENT") return fallback;
		throw error;
	}
}

function readText(path) {
	try {
		return readFileSync(path, "utf8");
	} catch (error) {
		if (error?.code === "ENOENT") return "";
		throw error;
	}
}

function mergeManagedSection(existing, managed) {
	const escapedStart = DELEGATION_START.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const escapedEnd = DELEGATION_END.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const withoutManaged = existing
		.replace(new RegExp(`${escapedStart}[\\s\\S]*?${escapedEnd}\\s*`, "g"), "")
		.trimEnd();
	return `${withoutManaged ? `${withoutManaged}\n\n` : ""}${managed}\n`;
}

function validApiKeyCredential(value) {
	return value?.type === "api_key" && typeof value.key === "string" && value.key.length > 0;
}

function validOAuthCredential(value) {
	return (
		value?.type === "oauth" &&
		typeof value.access === "string" &&
		typeof value.refresh === "string" &&
		Number.isSafeInteger(value.expires) &&
		typeof value.accountId === "string"
	);
}

function fileContentEquals(path, expected) {
	try {
		return readFileSync(path, "utf8") === expected;
	} catch (error) {
		if (error?.code === "ENOENT") return false;
		throw error;
	}
}

function fileExists(path) {
	try {
		readFileSync(path);
		return true;
	} catch (error) {
		if (error?.code === "ENOENT") return false;
		throw error;
	}
}

function atomicWriteJson(path, value, mode) {
	atomicWrite(path, `${JSON.stringify(value, null, 2)}\n`, mode);
}

function atomicWrite(path, contents, mode) {
	mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
	const temporary = `${path}.${process.pid}.tmp`;
	writeFileSync(temporary, contents, { encoding: "utf8", mode });
	chmodSync(temporary, mode);
	renameSync(temporary, path);
	chmodSync(path, mode);
}

function parseArgs(argv) {
	const options = {
		agentDir: join(homedir(), ".pi", "agent"),
		codexAuthPath: join(homedir(), ".codex", "auth.json"),
		forkRef: DEFAULT_FORK_REF,
		check: false,
		opencodeKeyStdin: false,
		zaiCodingCnKeyStdin: false,
	};
	for (let index = 0; index < argv.length; index += 1) {
		const argument = argv[index];
		if (argument === "--check") options.check = true;
		else if (argument === "--opencode-key-stdin") options.opencodeKeyStdin = true;
		else if (argument === "--zai-coding-cn-key-stdin") options.zaiCodingCnKeyStdin = true;
		else if (argument === "--agent-dir") options.agentDir = argv[++index];
		else if (argument === "--codex-auth") options.codexAuthPath = argv[++index];
		else if (argument === "--ref") options.forkRef = argv[++index];
		else throw new Error(`Unknown argument: ${argument}`);
	}
	return options;
}

async function main() {
	const options = parseArgs(process.argv.slice(2));
	if (options.opencodeKeyStdin && options.zaiCodingCnKeyStdin) {
		throw new Error("Only one key may be read from stdin per invocation");
	}
	const stdinKey =
		options.opencodeKeyStdin || options.zaiCodingCnKeyStdin ? await readStdin() : undefined;
	const result = options.check
		? inspectUniversProfile(options)
		: configureUniversProfile({
				...options,
				opencodeKey: options.opencodeKeyStdin ? stdinKey : undefined,
				zaiCodingCnKey: options.zaiCodingCnKeyStdin ? stdinKey : undefined,
			});
	process.stdout.write(`${JSON.stringify(result)}\n`);
	if (!Object.values(result).every(Boolean)) process.exitCode = 1;
}

async function readStdin() {
	const chunks = [];
	for await (const chunk of process.stdin) chunks.push(chunk);
	return Buffer.concat(chunks).toString("utf8").trim();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
	main().catch((error) => {
		process.stderr.write(
			`univers-profile: ${error instanceof Error ? error.message : String(error)}\n`,
		);
		process.exitCode = 1;
	});
}
