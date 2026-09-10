import { LoginForm } from "@/components/auth/login-form";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <LoginForm />
    </div>
  );
}
