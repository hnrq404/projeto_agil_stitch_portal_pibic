import type { Email } from '@shared/email/email.sender';

/** Escapa texto para o HTML do e-mail (o nome vem do cadastro). */
function html(texto: string): string {
  return texto.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function corpoHtml(paragrafos: string[], botao: { texto: string; link: string }, rodape: string): string {
  return `<!doctype html>
<html lang="pt-BR"><body style="margin:0;padding:24px;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
<div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:28px">
<p style="margin:0 0 20px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#475569">Portal PIBIC · UNICAP</p>
${paragrafos.map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6">${p}</p>`).join('\n')}
<p style="margin:24px 0"><a href="${html(botao.link)}" style="display:inline-block;background:#0f294a;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:bold">${html(botao.texto)}</a></p>
<p style="margin:0 0 8px;font-size:13px;color:#475569">Se o botão não funcionar, copie este endereço no navegador:</p>
<p style="margin:0 0 20px;font-size:13px;word-break:break-all"><a href="${html(botao.link)}">${html(botao.link)}</a></p>
<p style="margin:0;font-size:13px;color:#475569">${rodape}</p>
</div></body></html>`;
}

export function emailConfirmacao(nome: string, para: string, link: string): Email {
  const primeiroNome = nome.split(' ')[0] ?? nome;
  return {
    para,
    assunto: 'Confirme seu e-mail no Portal PIBIC',
    texto: [
      `Olá, ${primeiroNome}.`,
      '',
      'Para ativar sua conta no Portal PIBIC da UNICAP, confirme seu e-mail pelo link abaixo (válido por 48 horas):',
      link,
      '',
      'Se você não criou esta conta, ignore esta mensagem.',
    ].join('\n'),
    html: corpoHtml(
      [`Olá, ${html(primeiroNome)}.`, 'Para ativar sua conta no Portal PIBIC da UNICAP, confirme seu e-mail.'],
      { texto: 'Confirmar meu e-mail', link },
      'O link vale por 48 horas. Se você não criou esta conta, ignore esta mensagem.',
    ),
  };
}

export function emailRedefinicaoSenha(nome: string, para: string, link: string): Email {
  const primeiroNome = nome.split(' ')[0] ?? nome;
  return {
    para,
    assunto: 'Redefinição de senha do Portal PIBIC',
    texto: [
      `Olá, ${primeiroNome}.`,
      '',
      'Recebemos um pedido para redefinir a senha da sua conta no Portal PIBIC. Use o link abaixo (válido por 1 hora):',
      link,
      '',
      'Se não foi você, ignore esta mensagem: sua senha continua a mesma.',
    ].join('\n'),
    html: corpoHtml(
      [`Olá, ${html(primeiroNome)}.`, 'Recebemos um pedido para redefinir a senha da sua conta no Portal PIBIC.'],
      { texto: 'Criar nova senha', link },
      'O link vale por 1 hora. Se não foi você, ignore esta mensagem: sua senha continua a mesma.',
    ),
  };
}
