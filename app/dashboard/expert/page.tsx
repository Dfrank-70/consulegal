import { redirect } from "next/navigation";

export default async function ExpertHomePage() {
  redirect("/dashboard/expert/cases");
}
