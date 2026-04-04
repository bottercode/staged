"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getModel = getModel;
const anthropic_1 = require("@ai-sdk/anthropic");
const google_1 = require("@ai-sdk/google");
const mistral_1 = require("@ai-sdk/mistral");
const openai_1 = require("@ai-sdk/openai");
const xai_1 = require("@ai-sdk/xai");
const MODEL_ALIASES = {
    sonnet: "claude-sonnet-4-20250514",
    opus: "claude-opus-4-20250514",
    haiku: "claude-haiku-4-20250414",
};
const OPENAI_PREFIXES = ["gpt-", "o1", "o3", "o4", "chatgpt-", "deepseek-", "qwen-", "llama-"];
const GOOGLE_PREFIXES = ["gemini-"];
const MISTRAL_PREFIXES = ["mistral-", "codestral"];
const XAI_PREFIXES = ["grok-"];
function resolveProviderAndModel(modelId) {
    // Explicit provider prefix e.g. "google:gemini-2.5-flash"
    if (modelId.includes(":")) {
        const [provider, ...rest] = modelId.split(":");
        return { provider: provider, model: rest.join(":").trim() };
    }
    // Alias e.g. "sonnet" → full model id
    const resolved = MODEL_ALIASES[modelId] ?? modelId;
    if (resolved.startsWith("claude-"))
        return { provider: "anthropic", model: resolved };
    if (OPENAI_PREFIXES.some((p) => resolved.startsWith(p)))
        return { provider: "openai", model: resolved };
    if (GOOGLE_PREFIXES.some((p) => resolved.startsWith(p)))
        return { provider: "google", model: resolved };
    if (MISTRAL_PREFIXES.some((p) => resolved.startsWith(p)))
        return { provider: "mistral", model: resolved };
    if (XAI_PREFIXES.some((p) => resolved.startsWith(p)))
        return { provider: "xai", model: resolved };
    // Default to anthropic for unknown models
    return { provider: "anthropic", model: resolved };
}
function getModel(modelId, keys) {
    const { provider, model } = resolveProviderAndModel(modelId);
    switch (provider) {
        case "anthropic":
            return (0, anthropic_1.createAnthropic)({ apiKey: keys.anthropicApiKey })(model);
        case "openai":
            return (0, openai_1.createOpenAI)({ apiKey: keys.openaiApiKey })(model);
        case "google":
            return (0, google_1.createGoogleGenerativeAI)({ apiKey: keys.googleApiKey })(model);
        case "mistral":
            return (0, mistral_1.createMistral)({ apiKey: keys.mistralApiKey })(model);
        case "xai":
            return (0, xai_1.createXai)({ apiKey: keys.xaiApiKey })(model);
        default:
            throw new Error(`Unknown provider: ${provider}`);
    }
}
