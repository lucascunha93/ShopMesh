import { AlertCircle, LoaderCircle } from 'lucide-react';

export function LoadingMessage({ label = 'Carregando' }: { label?: string }) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-ink/60" role="status">
      <LoaderCircle className="animate-spin text-coral" size={26} />
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}

export function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 border-l-[3px] border-coral bg-[#f8e8e1] px-4 py-3 text-sm text-[#713d32]" role="alert">
      <AlertCircle className="mt-0.5 shrink-0" size={17} />
      <span>{message}</span>
    </div>
  );
}
