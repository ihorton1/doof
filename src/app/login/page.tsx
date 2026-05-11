import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const safeNext =
    next && next.startsWith("/") && !next.startsWith("//") ? next : "/today";

  return (
    <div className="min-h-dvh flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-950">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold text-center mb-1">doof</h1>
        <p className="text-center text-slate-500 mb-8 text-sm">
          your meal plan, dishes, and shopping list
        </p>
        <LoginForm next={safeNext} hasError={Boolean(error)} />
      </div>
    </div>
  );
}
