import assert from "node:assert/strict";
import type { ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createMockContext, createMockPi } from "../../../test/support.js";
import { setBrowserManagerOperationsForTests } from "../src/browser-manager.js";
import chromeDevtools from "../src/chrome-devtools.js";
import { state } from "../src/runtime.js";
import { projectSettingsFilePath, settingsFilePath } from "../src/settings.js";

class LifecycleChild extends EventEmitter {
	killCalls = 0;
	kill() {
		this.killCalls += 1;
		queueMicrotask(() => this.emit("exit", 0, null));
		return true;
	}
}

async function withFixture(
	fn: (fixture: {
		cwdA: string;
		cwdB: string;
		extensionA: string;
		extensionB: string;
		executable: string;
	}) => Promise<void>,
) {
	const root = mkdtempSync(path.join(os.tmpdir(), "pi-cdp-lifecycle-"));
	const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
	const agentDir = path.join(root, "agent");
	const cwdA = path.join(root, "project-a");
	const cwdB = path.join(root, "project-b");
	const extensionA = path.join(root, "extension-a");
	const extensionB = path.join(root, "extension-b");
	const executable = path.join(root, "chrome-for-testing");
	for (const directory of [agentDir, cwdA, cwdB, extensionA, extensionB]) {
		mkdirSync(directory, { recursive: true });
	}
	for (const [directory, name] of [
		[extensionA, "A"],
		[extensionB, "B"],
	] as const) {
		writeFileSync(
			path.join(directory, "manifest.json"),
			JSON.stringify({ manifest_version: 3, name, version: "1.0.0" }),
		);
	}
	writeFileSync(executable, "#!/bin/sh\nexit 0\n");
	chmodSync(executable, 0o755);
	process.env.PI_CODING_AGENT_DIR = agentDir;
	try {
		await fn({ cwdA, cwdB, extensionA, extensionB, executable });
	} finally {
		state.sessionController.abort();
		state.sessionGeneration += 1;
		state.managedBrowser = undefined;
		state.launchPromise = undefined;
		if (previousAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
		else process.env.PI_CODING_AGENT_DIR = previousAgentDir;
		rmSync(root, { recursive: true, force: true });
	}
}

function writeJson(filePath: string, value: unknown) {
	mkdirSync(path.dirname(filePath), { recursive: true });
	writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

test("session_start applies trusted project browser settings and status reports effective sources", async () => {
	await withFixture(async ({ cwdA, extensionA, extensionB, executable }) => {
		writeJson(settingsFilePath(), {
			browser: { executablePath: executable, extensionPaths: [extensionA] },
		});
		writeJson(projectSettingsFilePath(cwdA), {
			browser: { extensionPaths: [path.relative(cwdA, extensionB)] },
		});
		const mock = createMockPi();
		const { ctx, notifications } = createMockContext({
			cwd: cwdA,
			mode: "rpc",
			hasUI: true,
			isProjectTrusted: () => true,
		});
		chromeDevtools(mock.pi);

		await mock.events.get("session_start")?.[0]?.({}, ctx);
		await mock.commands.get("chrome-devtools")?.handler("status", ctx);

		assert.deepEqual(state.extensionPaths, [extensionB]);
		assert.equal(state.browserExecutable, executable);
		assert.equal(state.extensionPathsSource, "project");
		const status = notifications.at(-1)?.message ?? "";
		assert.match(status, new RegExp(`Project settings: .*${path.basename(cwdA)}.*trusted`));
		assert.match(status, /Unpacked extensions \(project\)/);
		assert.match(status, /Chrome for Testing or Chromium/);
		assert.match(status, /after \/reload or session replacement/);
	});
});

test("session replacement discards the stale continuation and applies only the latest cwd", async () => {
	await withFixture(async ({ cwdA, cwdB, extensionA, extensionB, executable }) => {
		writeJson(settingsFilePath(), { browser: { executablePath: executable } });
		writeJson(projectSettingsFilePath(cwdA), {
			browser: { extensionPaths: [path.relative(cwdA, extensionA)] },
		});
		writeJson(projectSettingsFilePath(cwdB), {
			browser: { extensionPaths: [path.relative(cwdB, extensionB)] },
		});
		const mock = createMockPi();
		chromeDevtools(mock.pi);
		const first = createMockContext({ cwd: cwdA, isProjectTrusted: () => true }).ctx;
		const second = createMockContext({ cwd: cwdB, isProjectTrusted: () => true }).ctx;

		const firstStart = mock.events.get("session_start")?.[0]?.({}, first);
		const secondStart = mock.events.get("session_start")?.[0]?.({}, second);
		await Promise.all([firstStart, secondStart]);

		assert.deepEqual(state.extensionPaths, [extensionB]);
		assert.equal(state.projectSettingsFilePath, projectSettingsFilePath(cwdB));
	});
});

test("session_shutdown clears status and releases an owned browser once", async () => {
	await withFixture(async () => {
		const child = new LifecycleChild();
		const removed: string[] = [];
		const restore = setBrowserManagerOperationsForTests({
			rm: async (target) => {
				removed.push(target);
			},
		});
		state.managedBrowser = {
			process: child as unknown as ChildProcess,
			userDataDir: "/tmp/lifecycle-profile",
			exited: false,
			ready: true,
			ownerGeneration: state.sessionGeneration,
		};
		const mock = createMockPi();
		const { ctx, statuses } = createMockContext();
		chromeDevtools(mock.pi);
		try {
			await Promise.all([
				mock.events.get("session_shutdown")?.[0]?.({}, ctx),
				mock.events.get("session_shutdown")?.[0]?.({}, ctx),
			]);
			assert.equal(child.killCalls, 1);
			assert.deepEqual(removed, ["/tmp/lifecycle-profile"]);
			assert.equal(statuses.get("chrome-devtools"), undefined);
			assert.equal(state.managedBrowser, undefined);
		} finally {
			restore();
		}
	});
});
