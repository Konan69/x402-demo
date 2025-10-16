"use client";

import { useChat } from "@ai-sdk/react";
import { useState } from "react";
import { toast } from "sonner";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Loader } from "@/components/ai-elements/loader";
import { Message, MessageContent } from "@/components/ai-elements/message";
import {
  PromptInput,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
} from "@/components/ai-elements/prompt-input";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import { Response } from "@/components/ai-elements/response";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import {
  WalletProgressTimeline,
  WalletRail,
} from "@/components/wallet-flow-panel";
import { useWalletFlowSync } from "@/hooks/use-wallet-flow-sync";
import { useWalletFlowStore } from "@/lib/stores/use-wallet-flow-store";

const MAX_MESSAGE_LENGTH = 256;

const suggestions = [
  "what are some cool projects onchain",
  "Can you tell me more about the projects?",
  "How do micropayments work here?",
];

const ChatBotDemo = () => {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status } = useChat({
    onError: (error) => {
      if (error.message?.includes("Rate limit exceeded")) {
        toast.error("Rate limit exceeded. Please try again later.");
        useWalletFlowStore.getState().failFlow("Rate limit exceeded");
        return;
      }

      if (error.message?.includes("Message too long")) {
        toast.error(
          `Message too long. Please keep it under ${MAX_MESSAGE_LENGTH} characters.`
        );
        return;
      }

      useWalletFlowStore.getState().failFlow(error.message);
    },
  });

  const handleSubmit = (message: PromptInputMessage) => {
    if (!message.text?.trim()) {
      return;
    }

    if (input.length > MAX_MESSAGE_LENGTH) {
      toast.error(
        `Message too long. Please keep it under ${MAX_MESSAGE_LENGTH} characters.`
      );
      return;
    }

    sendMessage({ text: input });
    setInput("");
  };

  const handleSuggestionClick = (suggestion: string) => {
    sendMessage({ text: suggestion });
  };

  useWalletFlowSync(messages);

  return (
    <div className="flex h-full w-full items-stretch gap-6 overflow-hidden px-12 py-6">
      <div className="min-w-[260px] shrink-0 basis-[20%] overflow-hidden">
        <WalletRail />
      </div>

      <div className="flex min-w-0 flex-1 basis-[60%] flex-col gap-4 overflow-hidden border border-white/10 bg-background/75 p-4">
        <Conversation className="flex-1 overflow-y-auto border border-white/10 bg-background/80">
          <ConversationContent>
            {messages.map((message) => (
              <Message from={message.role} key={message.id}>
                <MessageContent>
                  {message.parts.map((part, index) => {
                    if (part.type === "text") {
                      return (
                        <Response key={`${message.id}-${index}`}>
                          {part.text}
                        </Response>
                      );
                    }

                    if (part.type === "reasoning") {
                      return (
                        <Reasoning
                          className="w-full"
                          isStreaming={status === "streaming"}
                          key={`${message.id}-${index}`}
                        >
                          <ReasoningTrigger />
                          <ReasoningContent>{part.text}</ReasoningContent>
                        </Reasoning>
                      );
                    }

                    if (
                      part.type === "dynamic-tool" ||
                      part.type.startsWith("tool-")
                    ) {
                      return (
                        <Tool
                          defaultOpen={false}
                          key={`${message.id}-${index}`}
                        >
                          {/* @ts-expect-error */}
                          <ToolHeader part={part} />
                          <ToolContent>
                            {/* @ts-expect-error */}
                            <ToolInput input={part.input} />
                            <ToolOutput
                              // @ts-expect-error
                              metadata={message.metadata ?? undefined}
                              // @ts-expect-error
                              part={part}
                            />
                          </ToolContent>
                        </Tool>
                      );
                    }

                    return null;
                  })}
                </MessageContent>
              </Message>
            ))}
            {status === "submitted" && <Loader />}
            {status === "error" && <div>Something went wrong</div>}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
        <Suggestions className="justify-center gap-2">
          {suggestions.map((suggestion) => (
            <Suggestion
              key={suggestion}
              onClick={() => handleSuggestionClick(suggestion)}
              size="sm"
              suggestion={suggestion}
              variant="outline"
            />
          ))}
        </Suggestions>
        <PromptInput className="mt-2" onSubmit={handleSubmit}>
          <PromptInputTextarea
            maxLength={MAX_MESSAGE_LENGTH}
            onChange={(event) =>
              setInput(event.target.value.slice(0, MAX_MESSAGE_LENGTH))
            }
            placeholder="Type your message"
            ref={(ref) => {
              if (ref) {
                ref.focus();
              }
            }}
            value={input}
          />
          <PromptInputToolbar>
            <div className="flex w-full items-center justify-between">
              <div className="pl-2 text-muted-foreground text-xs">
                {input.length}/{MAX_MESSAGE_LENGTH} characters
              </div>
              <PromptInputSubmit
                disabled={!input || input.length > MAX_MESSAGE_LENGTH}
                status={status}
              />
            </div>
          </PromptInputToolbar>
        </PromptInput>
      </div>
      <div className="min-w-[240px] shrink-0 basis-[20%] overflow-hidden">
        <WalletProgressTimeline />
      </div>
    </div>
  );
};

export default ChatBotDemo;
