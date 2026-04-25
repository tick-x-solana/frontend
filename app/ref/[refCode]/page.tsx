import { redirect } from "next/navigation";

type RefPageProps = PageProps<"/ref/[refCode]">;

export default async function RefPage({ params }: RefPageProps) {
  const { refCode } = await params;
  redirect(`/?followRef=${encodeURIComponent(refCode)}`);
}
