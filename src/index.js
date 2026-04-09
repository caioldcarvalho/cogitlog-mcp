#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import { z } from "zod";

const exec = promisify(execFile);

const CWD = process.env.COGITLOG_CWD || process.cwd();
const TIMEOUT = 30_000;

// Verify cogitlog is available before starting
try {
  await exec("cogitlog", ["--version"], { timeout: 5_000 });
} catch {
  console.error(
    "cogitlog-mcp: 'cogitlog' not found on PATH. Install it first: npm install -g cogitlog"
  );
  process.exit(1);
}

async function run(args) {
  try {
    const { stdout, stderr } = await exec("cogitlog", args, {
      cwd: CWD,
      timeout: TIMEOUT,
    });
    return { content: [{ type: "text", text: (stdout + stderr).trim() }] };
  } catch (err) {
    const output = ((err.stdout || "") + (err.stderr || "")).trim();
    return {
      content: [{ type: "text", text: output || err.message }],
      isError: true,
    };
  }
}

const pkg = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8")
);

const server = new McpServer({
  name: "cogitlog",
  version: pkg.version,
  instructions: `You have access to cogitlog — a semantic session memory that records AI agent reasoning alongside git history.

IMPORTANT — before modifying any file, call cogitlog_context or cogitlog_why to check prior reasoning about that file. Before investigating bugs or understanding past decisions, call cogitlog_query to search for related sessions.

At the start of every task, call cogitlog_begin to open a session. Record meaningful decisions with cogitlog_decision. Close with cogitlog_close when done.`,
});

// ── Reading tools ──

server.tool(
  "cogitlog_why",
  "Show decisions that reference a file. Call this BEFORE modifying any file to understand why it was changed previously.",
  { file: z.string().describe("File path to check"), mentions: z.boolean().optional().describe("Show all events, not just decisions") },
  async ({ file, mentions }) => {
    const args = ["why", file];
    if (mentions) args.push("--mentions");
    return run(args);
  }
);

server.tool(
  "cogitlog_context",
  "Show all events (decisions, attempts, notes, uncertainties) related to a file. Use this for a complete picture of reasoning around a file.",
  { file: z.string().describe("File path to check"), brief: z.boolean().optional().describe("Concise output — last 3 sessions, one line per event") },
  async ({ file, brief }) => {
    const args = ["context", file];
    if (brief) args.push("--brief");
    return run(args);
  }
);

server.tool(
  "cogitlog_query",
  "Search sessions by topic. Use this before investigating bugs or understanding past decisions.",
  { text: z.string().describe("Search text"), deep: z.boolean().optional().describe("Also search event body fields") },
  async ({ text, deep }) => {
    const args = ["query", text];
    if (deep) args.push("--deep");
    return run(args);
  }
);

server.tool(
  "cogitlog_log",
  "List recent sessions.",
  { limit: z.number().optional().describe("Max sessions to show (default 20)") },
  async ({ limit }) => {
    const args = ["log"];
    if (limit != null) args.push("-n", String(limit));
    return run(args);
  }
);

server.tool(
  "cogitlog_show",
  "Show full details of a session.",
  { session_id: z.string().optional().describe("Session ID (defaults to current session)") },
  async ({ session_id }) => {
    const args = ["show"];
    if (session_id) args.push(session_id);
    return run(args);
  }
);

server.tool(
  "cogitlog_status",
  "Show the current session status.",
  {},
  async () => run(["status"])
);

// ── Writing tools ──

server.tool(
  "cogitlog_begin",
  "Open a new session. Call this at the start of every task.",
  {
    intent: z.string().describe("What you intend to do"),
    context: z.string().optional().describe("Additional context"),
    resume: z.string().optional().describe("Session ID to resume from"),
    tags: z.array(z.string()).optional().describe("Tags for this session"),
  },
  async ({ intent, context, resume, tags }) => {
    const args = ["begin", intent];
    if (context) args.push("-c", context);
    if (resume) args.push("-r", resume);
    if (tags) for (const t of tags) args.push("-t", t);
    return run(args);
  }
);

server.tool(
  "cogitlog_close",
  "Close the current session.",
  {
    outcome: z.enum(["completed", "partial", "abandoned", "interrupted"]).describe("Session outcome"),
    note: z.string().optional().describe("Outcome summary"),
    tags: z.array(z.string()).optional().describe("Additional tags"),
  },
  async ({ outcome, note, tags }) => {
    const args = ["close", "--outcome", outcome];
    if (note) args.push("--note", note);
    if (tags) for (const t of tags) args.push("-t", t);
    return run(args);
  }
);

server.tool(
  "cogitlog_note",
  "Add a note to the current session.",
  {
    text: z.string().describe("Note text"),
    files: z.array(z.string()).optional().describe("File references"),
  },
  async ({ text, files }) => {
    const args = ["note", text];
    if (files) for (const f of files) args.push("-f", f);
    return run(args);
  }
);

server.tool(
  "cogitlog_decision",
  "Record a decision in the current session.",
  {
    text: z.string().describe("What you decided and why"),
    files: z.array(z.string()).optional().describe("File references"),
    alternatives: z.array(z.string()).optional().describe("Rejected alternatives in 'option:reason' format"),
  },
  async ({ text, files, alternatives }) => {
    const args = ["decision", text];
    if (files) for (const f of files) args.push("-f", f);
    if (alternatives) for (const a of alternatives) args.push("-a", a);
    return run(args);
  }
);

server.tool(
  "cogitlog_attempt",
  "Record an attempt in the current session.",
  {
    text: z.string().describe("What you tried"),
    outcome: z.enum(["succeeded", "failed", "partial"]).optional().describe("Attempt outcome"),
    reason: z.string().optional().describe("Why it failed or was partial"),
    files: z.array(z.string()).optional().describe("File references"),
  },
  async ({ text, outcome, reason, files }) => {
    const args = ["attempt", text];
    if (outcome) args.push("--outcome", outcome);
    if (reason) args.push("--reason", reason);
    if (files) for (const f of files) args.push("-f", f);
    return run(args);
  }
);

server.tool(
  "cogitlog_uncertainty",
  "Flag an uncertainty in the current session.",
  {
    text: z.string().describe("What you're uncertain about"),
    files: z.array(z.string()).optional().describe("File references"),
  },
  async ({ text, files }) => {
    const args = ["uncertainty", text];
    if (files) for (const f of files) args.push("-f", f);
    return run(args);
  }
);

// ── Start ──

const transport = new StdioServerTransport();
await server.connect(transport);
