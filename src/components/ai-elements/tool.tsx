"use client";

import type { DynamicToolUIPart, ToolUIPart } from "ai";
import {
  CheckCircleIcon,
  ChevronDownIcon,
  CircleIcon,
  ClockIcon,
  WrenchIcon,
  XCircleIcon,
} from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { isValidElement } from "react";
import z from "zod";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { CodeBlock } from "./code-block";
import { Response } from "./response";

export type ToolProps = ComponentProps<typeof Collapsible>;

export const Tool = ({ className, ...props }: ToolProps) => (
  <Collapsible
    className={cn("not-prose mb-4 w-full rounded-md border", className)}
    {...props}
  />
);

export type ToolHeaderProps = {
  title?: string;
  type?: ToolUIPart["type"];
  state: ToolUIPart["state"];
  className?: string;
  part?: ToolUIPart | DynamicToolUIPart;
};

const getStatusBadge = (status: ToolUIPart["state"]) => {
  const labels = {
    "input-streaming": "Pending",
    "input-available": "Running",
    "output-available": "Completed",
    "output-error": "Error",
  } as const;

  const icons = {
    "input-streaming": <CircleIcon className="size-4" />,
    "input-available": <ClockIcon className="size-4 animate-pulse" />,
    "output-available": <CheckCircleIcon className="size-4 text-green-600" />,
    "output-error": <XCircleIcon className="size-4 text-red-600" />,
  } as const;

  return (
    <Badge className="gap-1.5 rounded-full text-xs" variant="secondary">
      {icons[status]}
      {labels[status]}
    </Badge>
  );
};

export const ToolHeader = ({
  className,
  title,
  type,
  state,
  part,
  ...props
}: ToolHeaderProps) => {
  const resolvedState = part?.state ?? state;
  const resolvedTitle =
    title ??
    (part && "toolName" in part
      ? part.toolName
      : (type ?? part?.type ?? "").split("-").slice(1).join("-"));

  return (
    <CollapsibleTrigger
      className={cn(
        "flex w-full items-center justify-between gap-4 p-3",
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-2">
        <WrenchIcon className="size-4 text-muted-foreground" />
        <span className="font-medium text-sm">{resolvedTitle}</span>
        {getStatusBadge(resolvedState)}
      </div>
      <ChevronDownIcon className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
    </CollapsibleTrigger>
  );
};

export type ToolContentProps = ComponentProps<typeof CollapsibleContent>;

export const ToolContent = ({ className, ...props }: ToolContentProps) => (
  <CollapsibleContent
    className={cn(
      "data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 text-popover-foreground outline-none data-[state=closed]:animate-out data-[state=open]:animate-in",
      className
    )}
    {...props}
  />
);

export type ToolInputProps = ComponentProps<"div"> & {
  input: ToolUIPart["input"];
};

export const ToolInput = ({ className, input, ...props }: ToolInputProps) => (
  <div className={cn("space-y-2 overflow-hidden p-4", className)} {...props}>
    <h4 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
      Parameters
    </h4>
    <div className="rounded-md bg-muted/50">
      <CodeBlock code={JSON.stringify(input, null, 2)} language="json" />
    </div>
  </div>
);

const ToolOutputSchema = z
  .object({
    content: z.array(
      z.object({
        type: z.literal("text"),
        text: z.string(),
      })
    ),
    isError: z.boolean().optional(),
  })
  .optional();

type RenderOutputResult =
  | {
      type: "success";
      content: ReactNode;
    }
  | {
      type: "error";
      content: string;
    }
  | {
      type: "failed-to-parse";
      content: unknown;
    };

function renderRawOutput(output: ToolUIPart["output"]): RenderOutputResult {
  const parseResult = ToolOutputSchema.safeParse(output);
  if (!parseResult.success) {
    return {
      type: "failed-to-parse",
      content: output,
    };
  }
  if (!parseResult.data) {
    return {
      type: "success",
      content: null,
    };
  }
  if (parseResult.data.isError) {
    return {
      type: "error",
      content: parseResult.data.content.map((item) => item.text).join(""),
    };
  }
  return {
    type: "success",
    content: (
      <Response>
        {parseResult.data.content.map((item) => item.text).join("")}
      </Response>
    ),
  };
}

export type ToolOutputProps = ComponentProps<"div"> & {
  part: ToolUIPart | DynamicToolUIPart;
  metadata?: Record<string, unknown>;
};

export const ToolOutput = ({
  className,
  part,
  metadata,
  ...props
}: ToolOutputProps) => {
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.debug("[tool] part received", part);
  }

  const { output, errorText } = part;

  if (!(output || errorText)) {
    return null;
  }

  let resolvedError = errorText;
  let resolvedContent: ReactNode = null;

  if (part.type === "dynamic-tool") {
    const renderResult = renderRawOutput(output);
    if (renderResult.type === "success") {
      resolvedContent = renderResult.content;
    } else if (renderResult.type === "error") {
      resolvedError = renderResult.content;
    } else {
      resolvedContent = (
        <CodeBlock
          code={JSON.stringify(renderResult.content, null, 2)}
          language="json"
        />
      );
    }
  } else if (typeof output === "string") {
    resolvedContent = <CodeBlock code={output} language="json" />;
  } else if (output && typeof output === "object" && !isValidElement(output)) {
    resolvedContent = (
      <CodeBlock code={JSON.stringify(output, null, 2)} language="json" />
    );
  } else {
    resolvedContent = output as ReactNode;
  }

  return (
    <div className={cn("space-y-2 p-4", className)} {...props}>
      <h4 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
        {resolvedError ? "Error" : "Result"}
      </h4>
      <div
        className={cn(
          "overflow-x-auto rounded-md text-xs [&_table]:w-full",
          resolvedError
            ? "bg-destructive/10 text-destructive"
            : "bg-muted/50 text-foreground"
        )}
      >
        {resolvedError && <div>{resolvedError}</div>}
        {resolvedContent}
        {metadata ? (
          <div className="mt-3 rounded-md border border-white/10 bg-background/70 p-3 text-[0.7rem]">
            <div className="mb-1 font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Metadata
            </div>
            <CodeBlock
              code={JSON.stringify(metadata, null, 2)}
              language="json"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
};
