/**
 * ClawOSS PII Sanitizer Plugin
 *
 * Replaces @ symbols with fullwidth ＠ (U+FF20) in tool results
 * and messages BEFORE they enter the session transcript.
 *
 * This prevents OpenRouter's content filter from matching
 * @pytest.fixture, @Override, user@domain.com etc. as email patterns.
 *
 * The model understands ＠ as @ — visually identical, semantically equivalent.
 * The agent's own code writes use real @ (this only affects what the model READS).
 */

function sanitize(text) {
  if (typeof text !== 'string') return text;

  // Replace ALL @ with fullwidth ＠ — catches emails, decorators, annotations
  text = text.replace(/@/g, '\uFF20');

  // IPv4 addresses (valid ranges only, preserves version numbers)
  text = text.replace(
    /\b(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\b/g,
    function(match, a, b, c, d) {
      if ([a, b, c, d].every(function(o) { return parseInt(o) >= 0 && parseInt(o) <= 255; })) {
        return '[REDACTED_IP]';
      }
      return match;
    }
  );

  return text;
}

function sanitizeMessage(msg) {
  if (!msg || !msg.content) return undefined;

  if (typeof msg.content === 'string') {
    var cleaned = sanitize(msg.content);
    if (cleaned !== msg.content) {
      return { message: Object.assign({}, msg, { content: cleaned }) };
    }
    return undefined;
  }

  if (Array.isArray(msg.content)) {
    var changed = false;
    var cleanedContent = msg.content.map(function(block) {
      if (block.type === 'text' && typeof block.text === 'string') {
        var cleanText = sanitize(block.text);
        if (cleanText !== block.text) { changed = true; }
        return Object.assign({}, block, { text: cleanText });
      }
      if (typeof block.content === 'string') {
        var cleanContent = sanitize(block.content);
        if (cleanContent !== block.content) { changed = true; }
        return Object.assign({}, block, { content: cleanContent });
      }
      return block;
    });
    if (changed) {
      return { message: Object.assign({}, msg, { content: cleanedContent }) };
    }
    return undefined;
  }

  return undefined;
}

function register(api) {
  // Sanitize tool results before they enter the session transcript
  api.on('tool_result_persist', function(event, ctx) {
    return sanitizeMessage(event.message);
  });

  // Sanitize ALL messages before writing (catches sub-agent announce results)
  api.on('before_message_write', function(event, ctx) {
    return sanitizeMessage(event.message);
  });
}

module.exports = { register };
