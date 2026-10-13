import { LoginForm } from "@/components/auth/login-form";

export default function Home() {
  return (
    <div className="login-stage relative flex flex-1 items-center justify-center overflow-hidden px-6 py-16">
      <div className="login-atmosphere" aria-hidden="true" />
      <div className="relative z-10">
        <LoginForm />
      </div>
    </div>
  );
}
