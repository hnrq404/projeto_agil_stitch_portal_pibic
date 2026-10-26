import nodemailer, { type Transporter } from 'nodemailer';

import { ServicoIndisponivelError } from '../errors/domain.errors';

export interface Email {
  para: string;
  assunto: string;
  texto: string;
  html: string;
}

/**
 * Porta de envio de e-mail (hexagonal): SMTP em produção (ex.: Gmail do projeto
 * com senha de app), memória no dev e nos testes.
 */
export interface EmailSender {
  /** false quando o envio não está configurado: o cadastro avisa em vez de criar conta sem link. */
  readonly disponivel: boolean;
  enviar(email: Email): Promise<void>;
}

/**
 * Dev e testes: guarda as mensagens (os testes leem o link daqui) e, no dev,
 * mostra o link no terminal, para dar para confirmar a conta sem caixa de entrada.
 */
export class MemoryEmailSender implements EmailSender {
  readonly disponivel = true;
  readonly enviados: Email[] = [];

  constructor(private readonly mostrarNoTerminal = false) {}

  async enviar(email: Email): Promise<void> {
    this.enviados.push(email);
    if (this.enviados.length > 50) this.enviados.shift();
    if (this.mostrarNoTerminal) {
      console.log(`[email] Para: ${email.para} | ${email.assunto}\n${email.texto}\n`);
    }
  }
}

/** Produção sem SMTP configurado: falha de forma clara em vez de "enviar" para lugar nenhum. */
export class EmailIndisponivel implements EmailSender {
  readonly disponivel = false;

  async enviar(): Promise<void> {
    throw new ServicoIndisponivelError(
      'O envio de e-mails não está configurado no servidor. Avise a gestão do programa.',
    );
  }
}

export interface ConfigSmtp {
  host: string;
  porta: number;
  usuario: string;
  senha: string;
  remetente: string;
}

export class SmtpEmailSender implements EmailSender {
  readonly disponivel = true;
  private readonly transporte: Transporter;

  constructor(private readonly config: ConfigSmtp) {
    this.transporte = nodemailer.createTransport({
      host: config.host,
      port: config.porta,
      // 465 é SMTP com TLS direto; 587 negocia TLS depois de conectar.
      secure: config.porta === 465,
      auth: { user: config.usuario, pass: config.senha },
    });
  }

  async enviar(email: Email): Promise<void> {
    try {
      await this.transporte.sendMail({
        from: this.config.remetente,
        to: email.para,
        subject: email.assunto,
        text: email.texto,
        html: email.html,
      });
    } catch (error) {
      console.error('[email] Falha no envio SMTP', { para: email.para }, error);
      throw new ServicoIndisponivelError('Não foi possível enviar o e-mail agora. Tente de novo em alguns minutos.');
    }
  }
}

/**
 * Escolhe o envio pelo ambiente: SMTP quando SMTP_USUARIO e SMTP_SENHA existem;
 * sem eles, memória no dev e "indisponível" em produção (nunca fingir que enviou).
 */
export function criarEmailSender(env: NodeJS.ProcessEnv = process.env): EmailSender {
  const usuario = env['SMTP_USUARIO'];
  const senha = env['SMTP_SENHA'];
  if (usuario && senha) {
    return new SmtpEmailSender({
      host: env['SMTP_HOST'] || 'smtp.gmail.com',
      porta: Number(env['SMTP_PORTA'] || 465),
      usuario,
      // O Gmail mostra a senha de app em blocos com espaços; eles não fazem parte dela.
      senha: senha.replace(/\s+/g, ''),
      remetente: env['EMAIL_REMETENTE'] || `Portal PIBIC UNICAP <${usuario}>`,
    });
  }
  if (env['NODE_ENV'] === 'production' || env['VERCEL']) {
    console.error('[email] SMTP_USUARIO/SMTP_SENHA ausentes: cadastro e recuperação de senha ficam indisponíveis.');
    return new EmailIndisponivel();
  }
  return new MemoryEmailSender(env['NODE_ENV'] !== 'test');
}
