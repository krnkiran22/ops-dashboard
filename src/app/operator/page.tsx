import { redirect } from "next/navigation";

/**
 * Legacy operator route -- the main page (/) now handles role-based rendering.
 * Redirect so bookmarks and direct links still work.
 */
export default function OperatorPage() {
  redirect("/");
}
