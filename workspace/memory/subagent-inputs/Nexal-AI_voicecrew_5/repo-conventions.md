# Repo Analysis: Nexal-AI/voicecrew

## Tech Stack
- **Language**: TypeScript
- **Package**: npm
- **Test**: vitest (likely)

## Target
Implement `AnthropicLLMProvider` conforming to `LLMProvider` interface.

## Key Files
- Look at existing providers in `src/providers/llm/` (e.g., OpenAI provider)
- Target: `src/providers/llm/anthropic.ts` (new file)

## Interface Pattern (from OpenAI provider)
```typescript
export class AnthropicLLMProvider implements LLMProvider {
  constructor(options: { apiKey: string; model: string })
  async generate(prompt: string): Promise<string>
  async generateStream(prompt: string): AsyncIterable<string>
}
```

## Dependencies
- Add `@anthropic-ai/sdk` to package.json

## Testing
- Unit tests with mocked API responses
- Follow existing provider test patterns
