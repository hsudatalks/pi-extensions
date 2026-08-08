#!/usr/bin/env node

import { chmodSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_FORK_REF = "main";
export const FORK_SOURCE_PREFIX = "git:github.com/hsudatalks/pi-extensions@";

const EXTENSIONS = ["packages/pi-goal/src/index.ts", "packages/pi-subagents/src/index.ts"];

const AGENTS = {
	"advisor.md": `---
name: advisor
description: High-reasoning Sol consultant for architecture, diagnosis, planning, and review
tools: read,grep,find,ls,bash
model: openai-codex/gpt-5.6-sol:high
---

Act as a senior technical advisor. Analyze architecture, risks, evidence, and proposed changes.
Do not modify files. Use bash only for read-only inspection. Return a decisive recommendation with exact evidence.
`,
	"executor.md": `---
name: executor
description: DeepSeek implementation worker for one bounded task at a time; never delegates further
tools: read,bash,edit,write,grep,find,ls
model: opencode-go/deepseek-v4-flash
---

Execute exactly one bounded implementation task from the parent agent.
Follow repository instructions, inspect before editing, make the smallest coherent change, and run focused verification.
Do not spawn or delegate to other agents. Report files changed, verification results, and remaining risks.
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

	auth["openai-codex"] = codexOAuthCredential(codexAuth);
	if (opencodeKey !== undefined) {
		if (!opencodeKey.trim()) throw new Error("OpenCode Go key is empty");
		auth["opencode-go"] = { type: "api_key", key: opencodeKey.trim() };
	}
	if (!validApiKeyCredential(auth["opencode-go"])) {
		throw new Error("OpenCode Go authentication is missing; provide --opencode-key-stdin");
	}

	settings.defaultProvider = "opencode-go";
	settings.defaultModel = "deepseek-v4-flash";
	settings.defaultThinkingLevel = "high";
	settings.packages = mergePackages(settings.packages, forkRef);

	atomicWriteJson(settingsPath, settings, 0o600);
	atomicWriteJson(authPath, auth, 0o600);

	const agentsDir = join(agentDir, "agents");
	mkdirSync(agentsDir, { recursive: true, mode: 0o700 });
	chmodSync(agentsDir, 0o700);
	for (const [name, contents] of Object.entries(AGENTS)) {
		atomicWrite(join(agentsDir, name), contents, 0o600);
	}

	atomicWriteJson(
		join(agentDir, "pi-subagents.json"),
		{
			agents: {
				advisor: { thinkingLevel: "high", timeoutMs: 1_800_000 },
				executor: { timeoutMs: 1_800_000 },
				explorer: { thinkingLevel: "medium", timeoutMs: 900_000 },
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
	const expectedSource = `${FORK_SOURCE_PREFIX}${forkRef}`;
	const packageEntry = Array.isArray(settings.packages)
		? settings.packages.find(
				(entry) => entry && typeof entry === "object" && entry.source === expectedSource,
			)
		: undefined;
	return {
		mainModel:
			settings.defaultProvider === "opencode-go" && settings.defaultModel === "deepseek-v4-flash",
		forkPackage:
			packageEntry !== undefined &&
			JSON.stringify(packageEntry.extensions) === JSON.stringify(EXTENSIONS) &&
			JSON.stringify(packageEntry.skills) === "[]" &&
			JSON.stringify(packageEntry.prompts) === "[]" &&
			JSON.stringify(packageEntry.themes) === "[]",
		openCodeAuth: validApiKeyCredential(auth["opencode-go"]),
		codexAuth: validOAuthCredential(auth["openai-codex"]),
		agents: Object.entries(AGENTS).every(([name, contents]) =>
			fileContentEquals(join(agentDir, "agents", name), contents),
		),
		subagents:
			subagents.stateful?.enabled === true &&
			subagents.stateful?.transport === "subprocess" &&
			subagents.stateful?.completionDelivery === "auto-resume" &&
			subagents.stateful?.maxActiveTurns === 1 &&
			subagents.stateful?.maxDepth === 0,
		goal:
			goal.toolVisibility === "always" &&
			goal.experimental?.goals === false &&
			goal.rpc?.enabled === false &&
			goal.continuationLimits?.automaticTurns === 50 &&
			goal.continuationLimits?.noProgressTurns === 3,
	};
}

export function mergePackages(value, forkRef) {
	const packages = Array.isArray(value) ? value : [];
	const retained = packages.filter((entry) => {
		const source = typeof entry === "string" ? entry : entry?.source;
		if (typeof source !== "string") return true;
		if (source.startsWith("git:github.com/hsudatalks/pi-extensions")) return false;
		return !/^npm:@narumitw\/(pi-goal|pi-subagents)(?:@[^/]+)?$/.test(source);
	});
	retained.push({
		source: `${FORK_SOURCE_PREFIX}${forkRef}`,
		extensions: [...EXTENSIONS],
		skills: [],
		prompts: [],
		themes: [],
	});
	return retained;
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
	};
	for (let index = 0; index < argv.length; index += 1) {
		const argument = argv[index];
		if (argument === "--check") options.check = true;
		else if (argument === "--opencode-key-stdin") options.opencodeKeyStdin = true;
		else if (argument === "--agent-dir") options.agentDir = argv[++index];
		else if (argument === "--codex-auth") options.codexAuthPath = argv[++index];
		else if (argument === "--ref") options.forkRef = argv[++index];
		else throw new Error(`Unknown argument: ${argument}`);
	}
	return options;
}

async function main() {
	const options = parseArgs(process.argv.slice(2));
	const result = options.check
		? inspectUniversProfile(options)
		: configureUniversProfile({
				...options,
				opencodeKey: options.opencodeKeyStdin ? await readStdin() : undefined,
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
