/**
 * PII Sanitizer Hook — tool_result_persist
 *
 * Strips emails, phone numbers, IPs, SSNs, and credit card numbers from
 * tool results BEFORE they enter the session transcript. This prevents
 * OpenRouter's content filter from triggering 403 errors on [EMAIL]/[PHONE]
 * patterns found in package.json, pyproject.toml, lock files, etc.
 *
 * Only sanitizes tool RESULTS (file contents, exec output).
 * Never modifies tool CALLS (the agent's own writes are untouched).
 */

interface ContentBlock {
  type: string;
  text?: string;
  content?: string | ContentBlock[];
  [key: string]: unknown;
}

interface AgentMessage {
  role?: string;
  content?: string | ContentBlock[];
  [key: string]: unknown;
}

interface ToolResultPersistEvent {
  toolName: string;
  toolCallId: string;
  message: AgentMessage;
  isSynthetic?: boolean;
}

interface ToolResultPersistContext {
  agentId: string;
  sessionKey: string;
  toolName: string;
  toolCallId: string;
}

function sanitize(text: string): string {
  // Email addresses (the #1 trigger for OpenRouter 403)
  // Matches: user@domain.tld, user+tag@domain.tld, "Name <email>" patterns
  text = text.replace(
    /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,
    "[REDACTED_EMAIL]"
  );

  // Phone numbers (various international formats)
  // Matches: +1-234-567-8901, (234) 567-8901, 234.567.8901, +44 20 7123 4567
  text = text.replace(
    /(\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{4}/g,
    "[REDACTED_PHONE]"
  );

  // IPv4 addresses — only valid IPs (all octets 0-255)
  // Preserves version numbers like 1.2.3 (3 octets) and semver 1.2.3-beta
  text = text.replace(
    /\b(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\b/g,
    (match: string, a: string, b: string, c: string, d: string) => {
      if (
        [a, b, c, d].every(
          (o: string) => parseInt(o) >= 0 && parseInt(o) <= 255
        )
      ) {
        return "[REDACTED_IP]";
      }
      return match;
    }
  );

  // SSN patterns (XXX-XX-XXXX)
  text = text.replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[REDACTED_SSN]");

  // Credit card patterns (XXXX-XXXX-XXXX-XXXX or XXXX XXXX XXXX XXXX)
  text = text.replace(
    /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
    "[REDACTED_CC]"
  );

  return text;
}

function sanitizeContent(
  content: string | ContentBlock[]
): string | ContentBlock[] {
  if (typeof content === "string") {
    return sanitize(content);
  }

  if (Array.isArray(content)) {
    return content.map((block: ContentBlock) => {
      if (block.type === "text" && typeof block.text === "string") {
        return { ...block, text: sanitize(block.text) };
      }
      if (block.type === "tool_result" && typeof block.content === "string") {
        return { ...block, content: sanitize(block.content) };
      }
      if (block.type === "tool_result" && Array.isArray(block.content)) {
        return {
          ...block,
          content: sanitizeContent(block.content) as ContentBlock[],
        };
      }
      return block;
    });
  }

  return content;
}

const handler = async (
  event: ToolResultPersistEvent,
  _ctx: ToolResultPersistContext
) => {
  const msg = event.message;
  if (!msg || !msg.content) return;

  const sanitizedContent = sanitizeContent(msg.content);

  // Only return modified message if content actually changed
  if (sanitizedContent !== msg.content) {
    return { message: { ...msg, content: sanitizedContent } };
  }
};

export default handler;
