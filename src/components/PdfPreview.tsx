"use client";

import { useState } from "react";
import { Button } from "./ui";
import { Icon } from "./icons";

/**
 * The contract itself, beside its review.
 *
 * This is the one screen where two things have to be visible at once. Every
 * finding carries a clause reference and a quote, and the first thing a lawyer
 * does with either is check it against the page — a review you have to trust
 * without being able to look is a review you have to redo.
 *
 * `<iframe>` and the browser's own PDF viewer rather than a rendering library:
 * the viewer is already there, it has search and page navigation and text
 * selection, and shipping a megabyte of PDF.js to reproduce it worse is not a
 * trade worth making. The route it points at serves the bytes with
 * `content-disposition: inline` for exactly this.
 *
 * It is collapsed by default. Loading a PDF the reader has not asked for costs
 * a download on every page view, and most visits are to read the findings.
 */
export function PdfPreview({
  contractId,
  filename,
  /** Rendered sticky beside the review on wide screens rather than inline. */
  sticky = false,
}: {
  contractId: string;
  filename: string;
  sticky?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const url = `/api/contracts/${contractId}/file`;

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        <Icon name="documents" className="size-3.5" />
        Show the document
      </Button>
    );
  }

  return (
    <div className={sticky ? "sticky top-4" : ""}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          <Icon name="close" className="size-3.5" />
          Hide
        </Button>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 text-[12.5px] font-medium transition hover:bg-sunken"
        >
          <Icon name="external" className="size-3.5" />
          Open in a new tab
        </a>
        <span className="truncate text-[12px] text-ink-3">{filename}</span>
      </div>

      <iframe
        src={url}
        title={filename}
        className="h-[70vh] w-full rounded-xl border border-border bg-sunken"
      />

      {/* A browser that cannot render a PDF inline shows an empty frame and no
          error, so the way out is stated rather than left to be discovered. */}
      <p className="mt-1.5 text-[11.5px] text-ink-3">
        Nothing showing? Some browsers will not display a PDF inline — use{" "}
        <a href={url} target="_blank" rel="noreferrer" className="text-brand-ink underline">
          open in a new tab
        </a>
        .
      </p>
    </div>
  );
}
