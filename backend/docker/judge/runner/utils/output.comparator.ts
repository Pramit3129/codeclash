export class OutputComparator {
  compare(actual: string, expected: string): boolean {
    return this.normalize(actual) === this.normalize(expected);
  }

  /**
   * Normalizes output by trimming and collapsing internal whitespace runs.
   */
  normalize(output: string): string {
    return output.trim().split(/\s+/).join(" ");
  }
}
