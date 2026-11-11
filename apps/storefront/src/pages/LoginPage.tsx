import { useState, type FormEvent } from 'react';
import { ArrowRight, KeyRound, LockKeyhole } from 'lucide-react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { AxiosError } from 'axios';
import AuthShell, { AuthField, authButtonClassName, authInputClassName } from '../components/AuthShell';
import { ErrorMessage } from '../components/PageMessage';
import { useAuth } from '../context/AuthContext';
import { useRedirectTarget } from '../hooks/useRedirectTarget';

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const redirectTo = useRedirectTarget();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await login(email, password);
      navigate(redirectTo, { replace: true });
    } catch (requestError) {
      if (requestError instanceof AxiosError && requestError.response?.status === 401) {
        setError('Credenciais inválidas. Confira seu email e sua senha.');
      } else {
        setError('Não foi possível entrar. Verifique sua conexão e tente novamente.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Acesse sua conta"
      title="Que bom ter você de volta."
      subtitle="Use seus dados para entrar na loja."
      footer={(
        <>
          Ainda não tem conta?{' '}
          <Link to="/register" state={{ from: redirectTo }} className="font-bold text-ink underline underline-offset-4">Criar conta</Link>
        </>
      )}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && <ErrorMessage message={error} />}
        <AuthField label="Email" icon={<KeyRound size={17} />}>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="voce@exemplo.com"
            className={authInputClassName}
          />
        </AuthField>
        <AuthField label="Senha" icon={<LockKeyhole size={17} />}>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Sua senha"
            className={authInputClassName}
          />
        </AuthField>
        <button type="submit" disabled={submitting} className={authButtonClassName}>
          {submitting ? 'Entrando...' : 'Entrar'}
          {!submitting && <ArrowRight size={17} />}
        </button>
      </form>
    </AuthShell>
  );
}
