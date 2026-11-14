import { Alert } from "@/components/ui/alert";
import type { ActionResult } from "@/lib/admin/admin-data";

export function ActionFeedback({ state }: { state?: ActionResult }) {
  if (!state) return null;
  return (
    <Alert tone={state.ok ? "success" : "danger"} title={state.message}>
      {state.errors?.length ? (
        <ul className="list-disc pl-4 text-ink">
          {state.errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      ) : null}
      {state.warnings?.length ? (
        <ul className="list-disc pl-4 text-warn">
          {state.warnings.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      ) : null}
    </Alert>
  );
}
