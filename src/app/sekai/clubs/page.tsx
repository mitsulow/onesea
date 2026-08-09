import { redirect } from "next/navigation";

/** 部活はMOAIに統合されました。旧URLはMOAIへ転送。 */
export default function ClubsRedirect() {
  redirect("/moai");
}
