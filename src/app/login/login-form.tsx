import { loginAction } from "./actions";

export function LoginForm({
  next,
  hasError,
}: {
  next: string;
  hasError: boolean;
}) {
  return (
    <form action={loginAction} className="space-y-3">
      <input type="hidden" name="next" value={next} />
      <input
        type="password"
        name="password"
        autoFocus
        required
        autoComplete="current-password"
        placeholder="Password"
        className="w-full h-12 px-4 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
      />
      {hasError && <p className="text-sm text-rose-600">Wrong password</p>}
      <button
        type="submit"
        className="w-full h-12 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition"
      >
        Sign in
      </button>
    </form>
  );
}
