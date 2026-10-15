export type MistralModel = 'mistral-large-latest' | 'codestral-latest' | 'pixtral-large-latest';
export interface InterpreterState { readonly available: boolean; readonly model: string; readonly consent: boolean; readonly generation: number; readonly provider?: string }
export interface InterpreterClient {
  available(): boolean; model(): string; getState(): InterpreterState;
  subscribe(listener: () => void): () => void;
  setConsent(value: boolean): void; complete(prompt: string, image?: string | null, options?: {schema?: object|null}): Promise<string>;
}
export interface MistralClient extends InterpreterClient {
  configure(key: string, model?: MistralModel, options?: {proxy?: string; remember?: boolean}): void;
  chooseModel(model: MistralModel): void;
  disconnect(): void;
}
export const MISTRAL_MODELS: MistralModel[];
export const MISTRAL_KEY_STORAGE: string;
export function createMistral(fetcher?: typeof fetch, storage?: Pick<Storage, 'getItem'|'setItem'|'removeItem'> | null): MistralClient;
export function createInterpreter(openrouter: InterpreterClient, mistral: MistralClient): InterpreterClient & { select(name: 'OpenRouter'|'Mistral'): void; provider(): string };
