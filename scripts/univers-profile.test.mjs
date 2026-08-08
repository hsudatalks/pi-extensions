import assert from "node:assert/strict";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
	codexOAuthCredential,
	configureUniversProfile,
	inspectUniversProfile,
	mergePackages,
	newerMatchingOAuth,
} from "./univers-profile.mjs";

function jwt(exp) {
	return `header.${Buffer.from(JSON.stringify({ exp })).toString("base64url")}.signature`;
}

function fixture() {
	const root = mkdtempSync(join(tmpdir(), "univers-pi-profile-"));
	const agentDir = join(root, "agent");
	for (const name of ["pi-goal", "pi-subagents"]) {
		const sourceDir = join(agentDir, "univers", "node_modules", "@narumitw", name, "src");
		mkdirSync(sourceDir, { recursive: true });
		writeFileSync(join(sourceDir, "index.ts"), "export {};\n");
	}
	const codexAuthPath = join(root, "codex-auth.json");
	writeFileSync(
		codexAuthPath,
		JSON.stringify({
			auth_mode: "chatgpt",
			tokens: {
				access_token: jwt(2_000_000_000),
				refresh_token: "refresh",
				account_id: "account",
			},
		}),
	);
	return { root, agentDir, codexAuthPath };
}

test("configures a complete filtered Univers profile without leaking credentials", () => {
	const { agentDir, codexAuthPath } = fixture();
	const result = configureUniversProfile({
		agentDir,
		codexAuthPath,
		forkRef: "abc123",
		opencodeKey: "opencode-secret",
		zaiCodingCnKey: "zai-secret",
	});
	assert.deepEqual(result, {
		mainModel: true,
		forkPackage: true,
		openCodeAuth: true,
		zaiCodingCnAuth: true,
		codexAuth: true,
		agents: true,
		delegationPolicy: true,
		subagents: true,
		goal: true,
	});
	const settings = JSON.parse(readFileSync(join(agentDir, "settings.json"), "utf8"));
	assert.equal(settings.defaultProvider, "opencode-go");
	assert.equal(settings.defaultModel, "deepseek-v4-flash");
	assert.equal(settings.packages.length, 2);
	assert.deepEqual(settings.packages[0].extensions, ["src/index.ts"]);
	assert.equal(settings.packages[0].source.endsWith("/@narumitw/pi-goal"), true);
	assert.equal(settings.packages[1].source.endsWith("/@narumitw/pi-subagents"), true);
	const auth = JSON.parse(readFileSync(join(agentDir, "auth.json"), "utf8"));
	assert.equal(auth["openai-codex"].accountId, "account");
	assert.equal(auth["openai-codex"].expires, 2_000_000_000_000);
	assert.equal(auth["zai-coding-cn"].type, "api_key");
	assert.equal(auth["zai-coding-cn"].key, "zai-secret");
	assert.equal(statSync(join(agentDir, "auth.json")).mode & 0o777, 0o600);
	assert.equal(
		readFileSync(join(agentDir, "agents", "validator.md"), "utf8").includes("luna:high"),
		true,
	);
	const advisor = readFileSync(join(agentDir, "agents", "advisor.md"), "utf8");
	assert.equal(advisor.includes("tools: read,grep,find,ls,bash,edit,write"), true);
	assert.equal(advisor.includes("Do not modify files"), false);
	assert.equal(advisor.includes("edit the files, run focused verification"), true);
	const glmSpecialist = readFileSync(join(agentDir, "agents", "glm-specialist.md"), "utf8");
	assert.equal(glmSpecialist.includes("model: zai-coding-cn/glm-5.2:high"), true);
	assert.equal(glmSpecialist.includes("tools: read,grep,find,ls,bash,edit,write"), true);
	assert.equal(
		readFileSync(join(agentDir, "APPEND_SYSTEM.md"), "utf8").includes(
			"use stateful delegation so it retains its full read, write, edit, and command tools",
		),
		true,
	);
	assert.equal(JSON.stringify(settings).includes("opencode-secret"), false);
	assert.equal(JSON.stringify(settings).includes("zai-secret"), false);
	writeFileSync(join(agentDir, "agents", "validator.md"), "stale");
	assert.equal(inspectUniversProfile({ agentDir, forkRef: "abc123" }).agents, false);
});

test("preserves unrelated packages and credentials across idempotent upgrades", () => {
	const { agentDir, codexAuthPath } = fixture();
	configureUniversProfile({
		agentDir,
		codexAuthPath,
		forkRef: "old",
		opencodeKey: "key",
		zaiCodingCnKey: "zai-key",
	});
	const settingsPath = join(agentDir, "settings.json");
	writeFileSync(join(agentDir, "APPEND_SYSTEM.md"), "Keep this user instruction.\n");
	writeFileSync(join(agentDir, "agents", "executor.md"), "stale executor\n");
	const settings = JSON.parse(readFileSync(settingsPath, "utf8"));
	settings.packages.unshift("npm:other-extension");
	writeFileSync(settingsPath, JSON.stringify(settings));
	chmodSync(settingsPath, 0o600);
	configureUniversProfile({ agentDir, codexAuthPath, forkRef: "new" });
	const upgraded = JSON.parse(readFileSync(settingsPath, "utf8"));
	assert.equal(upgraded.packages[0], "npm:other-extension");
	assert.equal(upgraded.packages.length, 3);
	assert.equal(upgraded.packages[1].source.endsWith("/@narumitw/pi-goal"), true);
	assert.equal(upgraded.packages[2].source.endsWith("/@narumitw/pi-subagents"), true);
	assert.equal(inspectUniversProfile({ agentDir, forkRef: "new" }).openCodeAuth, true);
	assert.equal(inspectUniversProfile({ agentDir, forkRef: "new" }).zaiCodingCnAuth, true);
	assert.equal(
		readFileSync(join(agentDir, "APPEND_SYSTEM.md"), "utf8").includes(
			"Keep this user instruction.",
		),
		true,
	);
	assert.equal(
		readFileSync(join(agentDir, "APPEND_SYSTEM.md"), "utf8").match(/univers-pi-delegation:start/g)
			?.length,
		1,
	);
	assert.throws(() => readFileSync(join(agentDir, "agents", "executor.md")), /ENOENT/);
});

test("rejects non-subscription Codex auth and missing OpenCode auth", () => {
	assert.throws(() => codexOAuthCredential({ auth_mode: "apikey" }), /ChatGPT subscription/);
	const { agentDir, codexAuthPath } = fixture();
	assert.throws(
		() => configureUniversProfile({ agentDir, codexAuthPath, forkRef: "main" }),
		/OpenCode Go authentication is missing/,
	);
	assert.throws(
		() =>
			configureUniversProfile({
				agentDir,
				codexAuthPath,
				forkRef: "main",
				opencodeKey: "key",
			}),
		/Z.AI Coding CN authentication is missing/,
	);
});

test("replaces only managed goal, subagent, and fork package entries", () => {
	assert.deepEqual(
		mergePackages(
			[
				"npm:@narumitw/pi-goal",
				"npm:@narumitw/pi-subagents@0.1.0",
				"npm:@narumitw/pi-usage",
				{ source: "git:github.com/hsudatalks/pi-extensions@old" },
			],
			"/home/test/.pi/agent",
		).map((entry) => (typeof entry === "string" ? entry : entry.source)),
		[
			"npm:@narumitw/pi-usage",
			"/home/test/.pi/agent/univers/node_modules/@narumitw/pi-goal",
			"/home/test/.pi/agent/univers/node_modules/@narumitw/pi-subagents",
		],
	);
});

test("preserves a newer Pi OAuth credential only for the same ChatGPT account", () => {
	const imported = {
		type: "oauth",
		access: "old-access",
		refresh: "old-refresh",
		expires: 100,
		accountId: "account-a",
	};
	const newer = { ...imported, access: "new-access", refresh: "new-refresh", expires: 200 };
	assert.equal(newerMatchingOAuth(newer, imported), newer);
	assert.equal(newerMatchingOAuth({ ...newer, accountId: "account-b" }, imported), imported);
	assert.equal(newerMatchingOAuth({ ...newer, expires: 50 }, imported), imported);
});
