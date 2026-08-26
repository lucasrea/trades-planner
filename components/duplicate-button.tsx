export function DuplicateButton({
  action,
  id,
  className = "btn btn-ghost",
}: {
  action: (formData: FormData) => void | Promise<void>;
  id: string;
  className?: string;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <button className={className}>Duplicate</button>
    </form>
  );
}
