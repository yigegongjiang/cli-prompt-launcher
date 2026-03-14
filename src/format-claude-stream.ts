import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { previewValue } from "./format-utils";

type StreamEvent = Extract<SDKMessage, { type: "stream_event" }>["event"];

export class ClaudeStreamFormatter {
  format(raw: unknown): string {
    const msg = raw as SDKMessage;
    switch (msg.type) {
      case "system":
        if ("model" in msg) {
          return `\n---\nmodel: ${msg.model}\ncwd: ${msg.cwd}\ntools: ${msg.tools.length}\n---\n`;
        }
        return "";

      case "stream_event":
        return formatStreamEvent(msg.event);

      case "user":
        if (msg.tool_use_result != null && typeof msg.tool_use_result === "object") {
          const formatted = Object.entries(msg.tool_use_result as Record<string, unknown>)
            .map(([k, v]) => `${k}: ${previewValue(v, 200)}`)
            .join(", ");
          return `\n[tool_result] ${formatted}`;
        }
        return "";

      case "assistant":
        return "";

      case "result": {
        const lines = [
          `type: result`,
          `subtype: ${msg.subtype}`,
          `duration: ${msg.duration_ms / 1000}s`,
          `api_duration: ${msg.duration_api_ms / 1000}s`,
          `turns: ${msg.num_turns}`,
          `cost: $${msg.total_cost_usd.toFixed(4)}`,
        ];
        if (msg.is_error) lines.push(`is_error: true`);
        return `\n\n---\n${lines.join("\n")}\n`;
      }

      default:
        return "";
    }
  }
}

function formatStreamEvent(event: StreamEvent): string {
  switch (event.type) {
    case "content_block_start": {
      const block = event.content_block;
      switch (block.type) {
        case "thinking":
          return "\n[thinking] ";
        case "text":
          return "\n";
        case "tool_use":
          return `\n[tool: ${block.name}] `;
        default:
          return "";
      }
    }

    case "content_block_delta": {
      const delta = event.delta;
      switch (delta.type) {
        case "thinking_delta":
          return delta.thinking;
        case "text_delta":
          return delta.text;
        case "input_json_delta":
          return delta.partial_json;
        default:
          return "";
      }
    }

    case "content_block_stop":
    case "message_start":
    case "message_delta":
    case "message_stop":
      return "";

    default:
      return "";
  }
}
