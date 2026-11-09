"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export function LoginForm({ redirectTo }: Readonly<{ redirectTo: string }>) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    setPending(true);
    setError(false);
    const formData = new FormData(event.currentTarget);
    try {
      const result = await signIn("credentials", {
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? ""),
        redirect: false,
        redirectTo,
      });

      if (result?.error || !result?.ok) {
        setError(true);
        return;
      }

      router.replace(redirectTo);
      router.refresh();
    } catch {
      // Credentials/authentication internals must not be disclosed in the UI.
      setError(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="login-page">
      <section aria-labelledby="login-title" className="login-card">
        <Link aria-label="13axis" className="login-brand" href="/">
          <span aria-hidden="true" className="brand-mark">M</span>
          <span className="brand-name">13axis</span>
        </Link>
        <p className="eyebrow">Acesso ao back-office</p>
        <h1 id="login-title">Entrar na sua conta</h1>
        <p className="login-description">
          Use seu e-mail e senha cadastrados para acessar o painel do restaurante.
        </p>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="email">E-mail</label>
            <input
              autoComplete="username"
              autoCapitalize="none"
              autoFocus
              id="email"
              name="email"
              placeholder="nome@restaurante.com.br"
              required
              type="email"
            />
          </div>
          <div className="form-field">
            <label htmlFor="password">Senha</label>
            <input
              autoComplete="current-password"
              id="password"
              name="password"
              required
              type="password"
            />
          </div>

          {error ? (
            <p className="form-error" id="login-error" role="alert">
              Não foi possível entrar. Verifique seu e-mail e senha e tente novamente.
            </p>
          ) : null}
          <button className="primary-button login-submit" disabled={pending} type="submit">
            {pending ? "Entrando…" : "Entrar"}
          </button>
          <p aria-live="polite" className="sr-only">
            {pending ? "Autenticando." : ""}
          </p>
        </form>
        <p className="login-security-note">
          A autenticação é validada pelo servidor. Nenhum dado de acesso é armazenado nesta tela.
        </p>
      </section>
    </main>
  );
}
