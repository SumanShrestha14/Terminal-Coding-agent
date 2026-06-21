import {anthropic} from "@ai-sdk/anthropic";
import {openai} from "@ai-sdk/openai";
import {
    findSupportedChatModel,
    type SupportedProvider,
    type SupportedChatModel,
    type SupportedChatModelId,
} from "@kodo/shared"
import type {LanguageModel} from "ai" 
import type {ProviderOptions} from "@ai-sdk/provider-utils"


type AnthropicModelId = Extract<SupportedChatModel, { provider: "anthropic" }>["id"];
type OpenAIModelId = Extract<SupportedChatModel, { provider: "openai" }>["id"];

export type ResolveModel = {
    model : LanguageModel;
    provider: SupportedProvider;
    modelId: SupportedChatModelId;
    providerOptions?: ProviderOptions;
}

const ANTHROPIC_PROVIDER_OPTIONS : Partial<Record<AnthropicModelId , ProviderOptions>> = {
    "clade-opus-4-6":{
        anthropic: {
            thinking :{
                type : "enabled",
                budgetTokens : 10000
            }
        }
    },
    "clade-sonnet-4-6":{
        anthropic: {
            thinking :{
                type : "enabled",
                budgetTokens : 10000
            }
        }
    }
}
const OPENAI_PROVIDER_OPTIONS : Partial<Record<OpenAIModelId , ProviderOptions>> = {
    "gpt-5.4-mini":{
        openai: {
            thinking :{
                reasoningSummary : "detailed"
            }
        }
    },
}

function assertUnsupportedProvider(provider : never): never {
    throw new Error(`Unsupported provider: ${provider}`);
}

function resolveAnthropicModel(modelId: AnthropicModelId): ResolveModel {
    return {
        model: anthropic(modelId),
        provider: "anthropic",
        modelId,
        providerOptions: ANTHROPIC_PROVIDER_OPTIONS[modelId]
    }
}
function resolveOpenAIModel(modelId: OpenAIModelId): ResolveModel {
    return {
        model: openai(modelId),
        provider: "openai",
        modelId,
        providerOptions: OPENAI_PROVIDER_OPTIONS[modelId]
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

