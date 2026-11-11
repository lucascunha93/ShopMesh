import { useState, type FormEvent } from 'react';
import { ArrowRight, KeyRound, LockKeyhole, UserRound } from 'lucide-react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { AxiosError } from 'axios';
import AuthShell, { AuthField, authButtonClassName, authInputClassName } from '../components/AuthShell';
import { ErrorMessage } from '../components/PageMessage';
import { useAuth } from '../context/AuthContext';
import { useRedirectTarget } from '../hooks/useRedirectTarget';

const MIN_PASSWORD_LENGTH = 8;

export default function RegisterPage() {
  const { register, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const redirectTo = useRedirectTarget();
  const [name, setName] = useState('');
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

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }

    setSubmitting(true);
    try {
      await register(name, email, password);
      navigate(redirectTo, { replace: true });
    } catch (requestError) {
      if (requestError instanceof AxiosError && requestError.response?.status === 409) {
        setError('Este email já está cadastrado. Tente entrar com ele.');
      } else if (requestError instanceof AxiosError && requestError.response?.status === 400) {
        setError('Confira os dados informados.');
      } else {
        setError('Não foi possível criar a conta. Tente novamente.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Crie sua conta"
      title="Boas-vindas à ShopMesh."
      subtitle="Leva menos de um minuto para começar a comprar."
      footer={(
        <>
          Já tem conta?{' '}
          <Link to="/login" state={{ from: redirectTo }} className="font-bold text-ink underline underline-offset-4">Entrar</Link>
        </>
      )}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && <ErrorMessage message={error} />}
        <AuthField label="Nome" icon={<UserRound size={17} />}>
          <input
            type="text"
            autoComplete="name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Seu nome"
            className={authInputClassName}
          />
        </AuthField>
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
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={`Mínimo de ${MIN_PASSWORD_LENGTH} caracteres`}
            className={authInputClassName}
          />
        </AuthField>
        <button type="submit" disabled={submitting} className={authButtonClassName}>
          {submitting ? 'Criando conta...' : 'Criar conta'}
          {!submitting && <ArrowRight size={17} />}
        </button>
      </form>
    </AuthShell>
  );
}
