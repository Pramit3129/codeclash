import { OutputComparator } from "../output.comparator.ts";

const comparator = new OutputComparator();

console.log(
  comparator.compare(
    "10\n",
    "10\n",
  ),
);

console.log(
  comparator.compare(
    "10   20\n30 40\n",
    "10 20\n30 40\n",
  ),
);

console.log(
  comparator.compare(
    "11\n",
    "10\n",
  ),
);