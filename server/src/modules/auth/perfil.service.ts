import { randomUUID } from 'node:crypto';

import { ForbiddenError, NotFoundError, ValidationError } from '@shared/errors/domain.errors';
import {
  assertPdfEnviado,
  sanitizeNomeArquivo,
  type ArquivoStorage,
  type InstrucaoUpload,
} from '@shared/storage/arquivo.storage';
import type { Clock } from '@shared/time/clock';

import { toPublicUsuario } from './auth.service';
import type { PublicUsuario, Usuario } from './domain/auth.types';
import type { UsuariosRepository } from './repositories/usuarios.repository';

/** As chaves do currículo começam pelo dono: só valem para a conta que as recebeu. */
function prefixoCurriculo(usuarioId: string): string {
  return `cv-${usuarioId}-`;
}

/**
 * Currículo Lattes do aluno. Fica no perfil (um arquivo só, que o aluno troca
 * quando quiser) e é copiado para o projeto no envio ao edital, para os
 * avaliadores verem exatamente o que foi submetido.
 */
export class PerfilService {
  constructor(
    private readonly usuarios: UsuariosRepository,
    private readonly storage: ArquivoStorage,
    private readonly clock: Clock,
  ) {}

  /** "Meu perfil": autoriza o envio do PDF direto ao armazenamento. */
  async prepararCurriculo(usuarioId: string): Promise<{ chave: string; upload: InstrucaoUpload }> {
    const usuario = await this.getDiscente(usuarioId);
    return this.instrucao(usuario);
  }

  /** "Meu perfil": confere o PDF recebido e o registra no lugar do anterior. */
  async confirmarCurriculo(usuarioId: string, chave: string, nome: string): Promise<PublicUsuario> {
    return toPublicUsuario(await this.registrar(await this.getDiscente(usuarioId), chave, nome));
  }

  /**
   * Logo após o cadastro, a conta ainda não confirmou o e-mail e não tem sessão.
   * Estas duas etapas só valem nesse intervalo e só com a chave que o próprio
   * cadastro devolveu (um UUID que ninguém mais conhece).
   */
  async prepararCurriculoDoCadastro(usuario: Usuario): Promise<{ chave: string; upload: InstrucaoUpload }> {
    if (usuario.role !== 'DISCENTE') throw new ForbiddenError('Só alunos anexam currículo.');
    return this.instrucao(usuario);
  }

  async confirmarCurriculoDoCadastro(usuarioId: string, chave: string, nome: string): Promise<void> {
    const usuario = await this.usuarios.findById(usuarioId);
    if (!usuario?.emailPendente || usuario.role !== 'DISCENTE') {
      throw new ForbiddenError('Esta etapa do cadastro já foi concluída. Entre e anexe o currículo em "Meu perfil".');
    }
    await this.registrar(usuario, chave, nome);
  }

  /** Link temporário do currículo do próprio aluno. */
  async linkCurriculo(usuarioId: string): Promise<{ nome: string; url: string }> {
    const usuario = await this.getDiscente(usuarioId);
    if (!usuario.curriculo) throw new NotFoundError('Você ainda não anexou o currículo Lattes.');
    return { nome: usuario.curriculo.nome, url: await this.storage.urlDeLeitura(usuario.curriculo.storageKey, usuario.curriculo.nome) };
  }

  private async instrucao(usuario: Usuario): Promise<{ chave: string; upload: InstrucaoUpload }> {
    const chave = `${prefixoCurriculo(usuario.id)}${randomUUID()}`;
    return { chave, upload: await this.storage.prepararUpload(chave) };
  }

  private async registrar(usuario: Usuario, chave: string, nomeOriginal: string): Promise<Usuario> {
    if (!chave.startsWith(prefixoCurriculo(usuario.id))) {
      throw new ValidationError('Envio de arquivo inválido. Anexe o currículo novamente.');
    }
    if (usuario.curriculo?.storageKey === chave) return usuario;

    const objeto = await this.storage.inspecionar(chave);
    try {
      assertPdfEnviado(objeto);
    } catch (error) {
      // Arquivo recusado não fica ocupando espaço no armazenamento.
      if (objeto) await this.storage.remove(chave).catch(() => undefined);
      throw error;
    }

    const anterior = usuario.curriculo;
    const atualizado = await this.usuarios.update({
      ...usuario,
      curriculo: {
        storageKey: chave,
        nome: sanitizeNomeArquivo(nomeOriginal),
        tamanho: objeto.tamanho,
        mimeType: 'application/pdf',
        enviadoEm: this.clock.now(),
      },
    });
    // Os projetos já enviados guardam a própria cópia: apagar o anterior não afeta nenhum deles.
    if (anterior) await this.storage.remove(anterior.storageKey).catch(() => undefined);
    return atualizado;
  }

  private async getDiscente(usuarioId: string): Promise<Usuario> {
    const usuario = await this.usuarios.findById(usuarioId);
    if (!usuario) throw new NotFoundError('Conta não encontrada.');
    if (usuario.role !== 'DISCENTE') throw new ForbiddenError('Só alunos anexam currículo.');
    return usuario;
  }
}
