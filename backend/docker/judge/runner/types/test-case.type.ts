export interface TestCase {
  id: string;
  stdin: string;
  expectedOutput: string;
  isSample: boolean;
}
