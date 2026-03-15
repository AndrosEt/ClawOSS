# Issue #5: feat: Add Anthropic Claude LLM provider

## What
Add Anthropic Claude as a native LLM provider option.

## Motivation
Claude (claude-3-5-sonnet, claude-3-haiku) offers strong conversational quality and is widely used.

## Proposed API
```typescript
import { AnthropicLLMProvider } from "voicecrew/providers/llm";
const agent = new VoiceAgent({
  llm: { provider: new AnthropicLLMProvider({ apiKey: "...", model: "claude-3-5-haiku-20241022" }) },
});
```

## Acceptance Criteria
- [ ] Implement `AnthropicLLMProvider` conforming to `LLMProvider` interface
- [ ] Support streaming responses for low-latency turn-taking
- [ ] System prompt and conversation history support
- [ ] Unit tests with mocked Anthropic API responses
- [ ] Update README provider table

## References
- [Anthropic API docs](https://docs.anthropic.com/en/api)
