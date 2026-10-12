import { NA, NA_SHORT } from "@/lib/format";

/** Renders a formatted number; the short "—" placeholder carries the full explanation for hover and screen readers. */
const NumText = ({ text }: { text: string }) =>
  text === NA_SHORT ? <span role="img" aria-label={NA} title={NA}>{NA_SHORT}</span> : <>{text}</>;

export default NumText;
