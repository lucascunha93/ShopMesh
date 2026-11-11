import { useLocation } from 'react-router-dom';

// Destino após login/cadastro. Só aceita caminhos internos para evitar
// redirecionamentos abertos.
export function useRedirectTarget() {
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  return from && from.startsWith('/') && !from.startsWith('//') ? from : '/';
}
