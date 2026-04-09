import { redirect } from "next/navigation";

/**
 * Legacy sales route -- the main page (/) now handles role-based rendering.
 * Redirect so bookmarks and direct links still work.
 */
export default function SalesPage() {
  redirect("/");
}
