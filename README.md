# cogitlog-mcp

MCP server for [cogitlog](https://github.com/caioldcarvalho/cogitlog) — gives AI agents direct access to session memory via the [Model Context Protocol](https://modelcontextprotocol.io).

## Install

```bash
npm install -g cogitlog cogitlog-mcp
```

## Configure

Add to your MCP settings (e.g. `~/.claude/settings.json` for Claude Code):

```json
{
  "mcpServers": {
    "cogitlog": {
      "command": "cogitlog-mcp",
      "env": {
        "COGITLOG_CWD": "/path/to/your/project"
      }
    }
  }
}
```

> `COGITLOG_CWD` tells the server which project's `.cogitlog/` to use. If omitted, it defaults to the server's working directory.

## Tools

### Reading (query past reasoning)

| Tool | Description |
|------|-------------|
| `cogitlog_why` | Show decisions that reference a file |
| `cogitlog_context` | Show all events related to a file |
| `cogitlog_query` | Search sessions by topic |
| `cogitlog_log` | List recent sessions |
| `cogitlog_show` | Show full details of a session |
| `cogitlog_status` | Show current session status |

### Writing (record reasoning)

| Tool | Description |
|------|-------------|
| `cogitlog_begin` | Open a new session |
| `cogitlog_close` | Close the current session |
| `cogitlog_note` | Add a note |
| `cogitlog_decision` | Record a decision |
| `cogitlog_attempt` | Record an attempt |
| `cogitlog_uncertainty` | Flag an uncertainty |

## How it works

The server wraps the `cogitlog` CLI — each tool call runs the corresponding `cogitlog` command and returns the output. The server's `instructions` field tells the agent to check prior reasoning before modifying files and to open sessions at the start of tasks.

## License

MIT
