import { lineDiff } from "./diff.js?h=52ba9aad";
import { detectDelimitedPair, gridDiff } from "./grid.js?h=611eb787";

onmessage = (event) => {
  const { action, original, modified, options, mode = "auto" } = event.data;
  if (action === "diff") {
    try {
      const detected = detectDelimitedPair(original, modified);
      const resolvedMode =
        mode === "grid" && detected.available
          ? "grid"
          : mode === "text"
            ? "text"
            : detected.available
              ? detected.defaultMode
              : "text";
      const result =
        resolvedMode === "grid"
          ? gridDiff(original, modified, options, detected)
          : lineDiff(original, modified, options);
      const detection = detected.available
        ? {
            available: true,
            delimiter: detected.delimiter,
            label: detected.label,
            confidence: detected.confidence,
            defaultMode: detected.defaultMode,
          }
        : { available: false };
      postMessage({
        action: "diff",
        status: "ok",
        result,
        mode: resolvedMode,
        detection,
      });
    } catch (error) {
      postMessage({ action: "diff", status: "failed", error: String(error) });
    }
  }
};
