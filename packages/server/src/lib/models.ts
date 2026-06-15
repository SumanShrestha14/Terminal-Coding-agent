import {anthropic} from "@ai-sdk/anthropic";
import {openai} from "@ai-sdk/openai";
import {
    findSupportedChatModel,
    type SupportedProvider,
    type SupportedChatModel,
    type SupportedChatModelId,
} from "@kodo/shared"
import type {LanguageModel} from "ai" 

type AnthropicModelId = Extract<SupportedChatModel, { provider: "anthropic" }>["id"];
type OpenAIModelId = Extract<SupportedChatModel, { provider: "openai" }>["id"];

export type ResolveModel = {
    model : LanguageModel;
    provider: SupportedProvider;
    modelId: SupportedChatModelId;
}

function assertUnsupportedProvider(provider : never): never {
    throw new Error(`Unsupported provider: ${provider}`);
}

function resolveAnthropicModel(modelId: AnthropicModelId): ResolveModel {
    return {
        model: anthropic(modelId),
        provider: "anthropic",
        modelId,
    }
}
function resolveOpenAIModel(modelId: OpenAIModelId): ResolveModel {
    return {
        model: openai(modelId),
        provider: "openai",
        modelId,
    }
}

function resolveSupportedChatModel(model : SupportedChatModel): ResolveModel {
    const provider = model.provider;
    switch(provider){
        case "anthropic":
            return resolveAnthropicModel(model.id as AnthropicModelId);
        case "openai":
            return resolveOpenAIModel(model.id as OpenAIModelId);
        default:
            assertUnsupportedProvider(provider);
    }
}

export function isSupportedChatModel(modelId : string) : modelId is SupportedChatModelId {
    return findSupportedChatModel(modelId) != null;
}

export function resolveChatModel(modelId : string) : ResolveModel {
    const model = findSupportedChatModel(modelId);
    if(!model){
        throw new Error(`Unsupported model id: ${modelId}`);
    }
    return resolveSupportedChatModel(model);
}

