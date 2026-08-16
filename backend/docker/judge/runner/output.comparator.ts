export class OutputComparator {
  compare(
    actual: string,
    expected: string,
  ): boolean {
    return this.normalize(actual) ===
      this.normalize(expected);
  }

  /**
   * Collapses a program's output to its canonical comparable form:
   * leading/trailing whitespace removed and every internal whitespace
   * run (spaces, tabs, LF, CRLF) reduced to a single space.
   *
   * Public only so it can be unit tested directly; `compare` is the
   * intended entry point.
   */
  normalize(
    output: string,
  ): string {
    return output
      .trim()
      .split(/\s+/)
      .join(" ");
  }
}