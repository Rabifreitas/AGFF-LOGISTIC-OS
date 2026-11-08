import { removeOrgChildAction } from "@/modules/org/actions";

export function RemoveButton({ id, kind, label }: { id: string; kind: string; label: string }) {
  return (
    <form action={removeOrgChildAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="kind" value={kind} />
      <button className="text-xs text-red-700 hover:underline">{label}</button>
    </form>
  );
}
