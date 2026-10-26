import { useState } from 'react';
import { MailCheck } from 'lucide-react';

import { errorMessage, http } from '@/shared/api/http';
import { Button } from '@/shared/ui/Button';

/** Pede um novo link de confirmação (o anterior deixa de valer). */
export function ReenviarLink({ email }: { email: string }) {
  const [estado, setEstado] = useState<'parado' | 'enviando' | 'enviado'>('parado');
  const [erro, setErro] = useState<string | null>(null);

  async function reenviar() {
    setEstado('enviando');
    setErro(null);
    try {
      await http.post('/api/auth/reenviar-verificacao', { email });
      setEstado('enviado');
    } catch (e) {
      setErro(errorMessage(e));
      setEstado('parado');
    }
  }

  if (estado === 'enviado') {
    return (
      <p className="flex items-center gap-2 text-sm text-ink-muted" role="status">
        <MailCheck className="h-4 w-4 text-secondary" aria-hidden />
        Novo link enviado para {email}. O anterior não vale mais.
      </p>
    );
  }

  return (
    <div className="space-y-1">
      <Button variant="secondary" size="sm" loading={estado === 'enviando'} onClick={() => void reenviar()}>
        Reenviar link de confirmação
      </Button>
      {erro && <p className="text-sm text-danger-700">{erro}</p>}
    </div>
  );
}
