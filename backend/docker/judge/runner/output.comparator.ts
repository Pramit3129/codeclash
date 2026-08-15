export class OutputComparator {
  compare(
    actual: string,
    expected: string,
  ): boolean {
    return this.normalize(actual) ===
      this.normalize(expected);
  }

  private normalize(
    output: string,
  ): string {
    return output
      .trim()
      .split(/\s+/)
      .join(" ");
  }
}