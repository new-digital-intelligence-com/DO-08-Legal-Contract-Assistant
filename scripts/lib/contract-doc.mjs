/**
 * A flowing-text layer over `pdf-lite`, shared by the contract generators.
 *
 * `pdf-lite` has no layout engine on purpose — coordinates are given, not
 * computed. That is right for an invoice, where every element is hand-placed,
 * and wrong for a contract, which is thousands of words of running prose that
 * has to break across pages. This module adds exactly the two things a
 * contract needs: word wrapping against the writer's own font metrics, and a
 * page break when the next line would cross the bottom margin.
 *
 * It is deliberately not a general typesetter. There is no justification, no
 * widow control, no hyphenation. A contract fixture that reads like a contract
 * is the bar; anything past that is effort spent on documents whose only reader
 * is a language model and a test.
 */
import Pdf from "../../src/lib/pdf-lite.mjs";

const PAGE = { width: 612, height: 792 };
const MARGIN = { left: 64, right: 548, top: 72, bottom: 740 };
const INK = [0.09, 0.09, 0.1];
const SOFT = [0.36, 0.36, 0.4];

/**
 * A tiny flowing-text layer over the fixed-coordinate writer.
 *
 * It tracks a cursor and starts a new page when the next line would cross the
 * bottom margin. That page break is the only reason this exists: a contract is
 * long enough that hand-placing every line would make each fixture unreadable
 * to edit, and a fixture nobody will edit stops matching the thing it tests.
 */
class Doc {
  constructor(title) {
    this.pdf = new Pdf({ title });
    this.newPage();
  }

  newPage() {
    this.pdf.page(PAGE);
    this.y = MARGIN.top;
  }

  space(amount = 10) {
    this.y += amount;
  }

  /** Break if the next `height` points would run past the bottom margin. */
  ensure(height) {
    if (this.y + height > MARGIN.bottom) this.newPage();
  }

  /** Wrap `value` to the text column, at the given font and size. */
  wrap(value, font, size) {
    const width = MARGIN.right - MARGIN.left;
    const words = String(value).split(/\s+/).filter(Boolean);
    const lines = [];
    let line = "";

    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (this.pdf.widthOf(candidate, { font, size }) <= width || !line) {
        line = candidate;
      } else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  para(value, { font = "Helvetica", size = 9.5, leading = 13, indent = 0, color = INK } = {}) {
    for (const line of this.wrap(value, font, size)) {
      this.ensure(leading);
      this.pdf.text(MARGIN.left + indent, this.y, line, { font, size, color });
      this.y += leading;
    }
  }

  /** A numbered clause: "10.2  Limitation of Liability. <body>" */
  clause(number, heading, body) {
    this.ensure(30);
    this.space(6);
    const label = `${number}   ${heading}.`;
    this.pdf.text(MARGIN.left, this.y, label, { font: "Helvetica-Bold", size: 9.5, color: INK });
    const used = this.pdf.widthOf(`${label} `, { font: "Helvetica-Bold", size: 9.5 });

    // The first body line continues on the heading's line; the rest wrap full
    // width. Done by hand because the writer places, it does not flow.
    const width = MARGIN.right - MARGIN.left;
    const words = String(body).split(/\s+/).filter(Boolean);
    let line = "";
    let first = true;
    const available = () => (first ? width - used : width);

    const flush = () => {
      if (!line) return;
      if (first) {
        this.pdf.text(MARGIN.left + used, this.y, line, { font: "Helvetica", size: 9.5, color: INK });
        first = false;
      } else {
        this.ensure(13);
        this.pdf.text(MARGIN.left, this.y, line, { font: "Helvetica", size: 9.5, color: INK });
      }
      this.y += 13;
      line = "";
    };

    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (this.pdf.widthOf(candidate, { font: "Helvetica", size: 9.5 }) <= available() || !line) {
        line = candidate;
      } else {
        flush();
        line = word;
      }
    }
    flush();
  }

  heading(text) {
    this.ensure(34);
    this.space(12);
    this.pdf.text(MARGIN.left, this.y, text.toUpperCase(), {
      font: "Helvetica-Bold",
      size: 10.5,
      color: INK,
      charSpace: 0.6,
    });
    this.y += 8;
    this.pdf.line(MARGIN.left, this.y, MARGIN.right, this.y, { color: [0.8, 0.8, 0.82] });
    this.y += 12;
  }

  title(text, subtitle) {
    this.pdf.textCentre(PAGE.width / 2, this.y, text.toUpperCase(), {
      font: "Helvetica-Bold",
      size: 13,
      color: INK,
      charSpace: 1,
    });
    this.y += 20;
    if (subtitle) {
      this.pdf.textCentre(PAGE.width / 2, this.y, subtitle, {
        font: "Helvetica",
        size: 9,
        color: SOFT,
      });
      this.y += 16;
    }
    this.pdf.line(MARGIN.left, this.y, MARGIN.right, this.y, { color: [0.8, 0.8, 0.82] });
    this.y += 16;
  }

  signature(parties, { unsigned = false } = {}) {
    this.ensure(120);
    this.heading("Signatures");
    if (unsigned) {
      this.para(
        "[SIGNATURE BLOCK TO BE ADDED PRIOR TO EXECUTION]",
        { font: "Helvetica-Bold", color: SOFT },
      );
      return;
    }
    for (const party of parties) {
      this.ensure(56);
      this.space(10);
      this.pdf.text(MARGIN.left, this.y, party, { font: "Helvetica-Bold", size: 9, color: INK });
      this.y += 26;
      this.pdf.line(MARGIN.left, this.y, MARGIN.left + 200, this.y, { color: [0.6, 0.6, 0.64] });
      this.y += 11;
      this.pdf.text(MARGIN.left, this.y, "Name / Title / Date", { font: "Helvetica", size: 7.5, color: SOFT });
      this.y += 12;
    }
  }

  toBuffer() {
    return this.pdf.toBuffer();
  }
}

export { Doc, PAGE, MARGIN, INK, SOFT };
export default Doc;
