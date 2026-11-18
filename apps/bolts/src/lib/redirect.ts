import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { actionRedirectUrl } from "./paths";

export async function redirectAfterAction(path: string): Promise<never> {
  // Absolute URLs work for both hydrated and plain-HTML actions with Next's basePath.
  redirect(actionRedirectUrl(path, (await headers()).get("origin")));
}
