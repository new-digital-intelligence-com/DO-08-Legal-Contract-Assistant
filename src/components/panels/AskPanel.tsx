"use client";

import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  Empty,
  ErrorNote,
  InfoNote,
  Loading,
  Note,
  Section,
  textareaClass,
} from "../ui";
import { Markdown } from "../Markdown";
import { request, useAction, useApi, when } from "../api";
import type { Answer } from "@/lib/types";

/**
 * Policy and compliance questions, answered from the workspace only.
 *
 * The `incomplete` marker is rendered prominently rather than as a footnote,
 * because it is the difference between "this is our position" and "we have no
 * recorded position and here is what is missing". Those two answers lead to
 * opposite actions, and only one of them is safe to repeat to a counterparty.
 */
export function AskPanel() {
  const history = useApi<{ answers: Answer[] }>("/api/ask?limit=25");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<Answer>();

  const ask = useAction(async () => {
    const result = await request<{ answer: Answer }>("/api/ask", {
      method: "POST",
      body: JSON.stringify({ question }),
    });
    setAnswer(result.answer);
    setQuestion("");
    history.reload();
  });

  return (
    <div className="space-y-6">
      <InfoNote>
        Answered from this workspace — the playbook, the contract register and past findings.
        Anything the workspace does not hold comes back marked incomplete rather than filled in
        from general knowledge.
      </InfoNote>

      <Card>
        <div className="space-y-3">
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            rows={3}
            placeholder="What is our position on uncapped indemnities? Do we have anything signed with Acme?"
            className={textareaClass}
          />
          {ask.error && <ErrorNote>{ask.error}</ErrorNote>}
          <Button
            variant="primary"
            busy={ask.busy}
            disabled={!question.trim()}
            onClick={() => ask.go()}
          >
            Ask
          </Button>
        </div>
      </Card>

      {answer && (
        <Section title="Answer">
          <div className="space-y-3">
            {answer.incomplete && (
              <Note>
                <strong>The workspace did not hold everything needed to answer this.</strong> What
                follows is limited to what is actually recorded here.
              </Note>
            )}
            <Card>
              <p className="mb-3 text-[12.5px] text-ink-3">{answer.question}</p>
              <Markdown text={answer.answer} />
              {answer.citations.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1 border-t border-border pt-3">
                  {answer.citations.map((citation) => (
                    <Badge key={citation} tone="neutral" label={citation} />
                  ))}
                </div>
              )}
            </Card>
          </div>
        </Section>
      )}

      <Section title="Earlier questions">
        {history.loading && !history.data ? (
          <Loading rows={3} />
        ) : history.error ? (
          <ErrorNote>{history.error}</ErrorNote>
        ) : !history.data || history.data.answers.length === 0 ? (
          <Empty title="Nothing asked yet." />
        ) : (
          <div className="space-y-2">
            {history.data.answers.map((entry) => (
              <Card key={entry.id} padded={false}>
                <button
                  type="button"
                  onClick={() => setAnswer(entry)}
                  className="flex w-full items-start justify-between gap-3 p-3 text-left"
                >
                  <div className="min-w-0">
                    <div className="truncate text-[13px]">{entry.question}</div>
                    <div className="text-[11.5px] text-ink-3">
                      {when(entry.at)} · {entry.by}
                    </div>
                  </div>
                  {entry.incomplete && <Badge tone="warn" label="incomplete" dot />}
                </button>
              </Card>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
