import { redirect } from "next/navigation";

/** 部活はMoAIに統合されました。旧URLはMoAIへ転送。 */
export default function ClubsRedirect() {
  redirect("/moai");
}
