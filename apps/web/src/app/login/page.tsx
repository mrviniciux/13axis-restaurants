import { auth } from "@/auth";
import { LoginForm } from "@/components/login-form";
import { redirect } from "next/navigation";

type LoginPageProps = {
  searchParams: Promise<{ redirectTo?: string | string[] }>;
};

function getSafeRedirect(value: string | string[] | undefined): string {
  if (
    typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\") &&
    !value.startsWith("/login")
  ) {
    return value;
  }
  return "/";
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await auth();
  if (session?.user?.id) redirect("/");

  const params = await searchParams;
  return <LoginForm redirectTo={getSafeRedirect(params.redirectTo)} />;
}
