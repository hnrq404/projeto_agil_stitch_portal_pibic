/**
 * Seed de demonstração — contas e dados que exercitam o fluxo inteiro:
 * edital aberto pela UNICAP → professor divulga o projeto → alunos se candidatam
 * → professor seleciona e envia ao edital com três avaliadores → gestão homologa
 * → bolsista envia o relatório mensal até o dia 5.
 *
 *   npm run db:seed --prefix server      (com o emulador rodando: npm run emulador)
 *
 * Grava pelos repositórios do container: no Firestore (emulador ou projeto
 * configurado no .env) e os PDFs no armazenamento ativo (disco ou Vercel Blob).
 *
 * Contas (o ".demo" deixa claro que não são caixas de e-mail de pessoas reais;
 * já nascem confirmadas, e os alunos já têm o currículo Lattes no perfil):
 *   gestor.demo@unicap.br      / gestor123     (GESTOR)
 *   docente.demo@unicap.br     / docente123    (DOCENTE, DCC) dono de um projeto divulgado e de um aprovado;
 *                                              também avalia o projeto da Profa. Marina
 *   docente2.demo@unicap.br    / docente123    (DOCENTE, DEMAT) projeto em avaliação
 *   avaliador.demo@unicap.br   / docente123    (DOCENTE, FIS)
 *   avaliador2.demo@unicap.br  / docente123    (DOCENTE, QUI)
 *   discente.demo@unicap.br    / discente123   (DISCENTE, bolsista com relatório mensal em atraso)
 *   bruno.demo@unicap.br       / discente123   (DISCENTE, candidato ao projeto divulgado)
 *   julia.demo@unicap.br       / discente123   (DISCENTE, candidata ao projeto divulgado)
 *   caio.demo@unicap.br        / discente123   (DISCENTE, selecionado no projeto em avaliação)
 *   visitante.demo@unicap.br   / visitante123  (USUARIO)
 *
 * Idempotente: pode rodar várias vezes sem duplicar dados. Contas antigas
 * (@pibic.edu.br) são renomeadas para os e-mails acima, mantendo os dados.
 */
import { randomUUID } from 'node:crypto';

import bcrypt from 'bcryptjs';

import type { UserRole } from '../shared/auth/auth.types';
import type { Usuario } from '../modules/auth/domain/auth.types';
import type { Avaliacao, NotaCriterio } from '../modules/avaliacoes/domain/avaliacoes.types';
import type { Edital } from '../modules/editais/domain/editais.types';
import type { Anexo, Candidatura, Inscricao } from '../modules/inscricoes/domain/inscricoes.types';
import { gerarProtocolo } from '../modules/inscricoes/domain/inscricoes.rules';
import { competenciasDaVigencia, competenciaDe, prazoMensal } from '../modules/projetos/domain/projetos.rules';
import { buildApp } from './config/app.container';
import { loadEnv } from './config/env';

loadEnv();

const container = buildApp({ persistencia: 'firestore' });
const DIA = 24 * 60 * 60 * 1000;

/** PDF mínimo válido, com uma linha de texto, para os anexos de demonstração. */
function pdfDemo(titulo: string): Buffer {
  const texto = titulo.replace(/[()\\]/g, '');
  const stream = `BT /F1 18 Tf 72 720 Td (${texto}) Tj ET`;
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let corpo = '%PDF-1.4\n';
  const offsets: number[] = [];
  objs.forEach((obj, i) => {
    offsets.push(corpo.length);
    corpo += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = corpo.length;
  corpo += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  corpo += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  corpo += `trailer << /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(corpo, 'latin1');
}

async function anexoDemo(
  inscricaoId: string,
  tipo: Anexo['tipo'],
  nome: string,
  titulo: string,
): Promise<Anexo> {
  const content = pdfDemo(titulo);
  // Mesmo formato de chave do envio pelo site: prefixo da inscrição e do tipo.
  const storageKey = `${inscricaoId}-${tipo}-${randomUUID()}`;
  await container.arquivoStorage.salvar(storageKey, content);
  return {
    id: randomUUID(),
    tipo,
    storageKey,
    nome,
    tamanho: content.length,
    mimeType: 'application/pdf',
    enviadoEm: new Date(),
  };
}

async function usuario(
  email: string,
  nome: string,
  senha: string,
  role: UserRole,
  extra: { departamento?: string; matricula?: string } = {},
): Promise<Usuario> {
  const senhaHash = await bcrypt.hash(senha, 10);
  // Contas de seeds anteriores usavam @pibic.edu.br: renomeia em vez de duplicar.
  const legado = email.replace(/\.demo@unicap\.br$/, '@pibic.edu.br');
  const existente =
    (await container.usuariosRepository.findByEmail(email)) ?? (await container.usuariosRepository.findByEmail(legado));
  if (existente) {
    return container.usuariosRepository.update({
      ...existente,
      email,
      senhaHash,
      role,
      departamento: extra.departamento ?? '',
      senhaAlteradaEm: null,
      emailPendente: false,
      tokenVerificacao: null,
      tokenSenha: null,
    });
  }
  return container.usuariosRepository.create({
    id: randomUUID(),
    nome,
    email,
    senhaHash,
    role,
    departamento: extra.departamento ?? '',
    matricula: extra.matricula ?? null,
    criadoEm: new Date(),
    senhaAlteradaEm: null,
  });
}

async function curriculoDemo(aluno: Usuario): Promise<void> {
  if (aluno.curriculo) return;
  const conteudo = pdfDemo(`Curriculo Lattes - ${aluno.nome}`);
  const storageKey = `cv-${aluno.id}-${randomUUID()}`;
  await container.arquivoStorage.salvar(storageKey, conteudo);
  await container.usuariosRepository.update({
    ...aluno,
    curriculo: {
      storageKey,
      nome: 'curriculo-lattes.pdf',
      tamanho: conteudo.length,
      mimeType: 'application/pdf',
      enviadoEm: new Date(),
    },
  });
}

async function edital(dados: Omit<Edital, 'id' | 'criadoEm' | 'atualizadoEm'>): Promise<Edital> {
  const existente = await container.editaisRepository.findByNumero(dados.numero);
  if (existente) return existente;
  const agora = new Date();
  return container.editaisRepository.create({ ...dados, id: randomUUID(), criadoEm: agora, atualizadoEm: agora });
}

function inscricaoBase(
  dados: Omit<Inscricao, 'protocolo' | 'discenteId' | 'homologacaoJustificativa' | 'submetidaEm' | 'homologadaEm'> &
    Partial<Inscricao>,
): Inscricao {
  return {
    protocolo: null,
    discenteId: null,
    homologacaoJustificativa: null,
    submetidaEm: null,
    homologadaEm: null,
    ...dados,
  };
}

async function candidatura(dados: Omit<Candidatura, 'id' | 'respondidaEm'> & Partial<Candidatura>): Promise<void> {
  await container.candidaturasRepository.create({ id: randomUUID(), respondidaEm: null, ...dados });
}

async function avaliacao(dados: Omit<Avaliacao, 'id'>): Promise<void> {
  await container.avaliacoesRepository.create({ id: randomUUID(), ...dados });
}

const notas = (n: number[]): NotaCriterio[] =>
  (['MERITO', 'VIABILIDADE', 'ADEQUACAO', 'FORMACAO'] as const).map((criterio, i) => ({ criterio, nota: n[i]! }));

async function protocolo(): Promise<string> {
  const ano = new Date().getUTCFullYear();
  return gerarProtocolo(await container.inscricoesRepository.proximoSequencialProtocolo(ano), ano);
}

async function main(): Promise<void> {
  const gestor = await usuario('gestor.demo@unicap.br', 'Maria Gestora', 'gestor123', 'GESTOR', { departamento: 'PRPQ' });
  const roberto = await usuario('docente.demo@unicap.br', 'Prof. Roberto Alencar', 'docente123', 'DOCENTE', {
    departamento: 'DCC',
  });
  const marina = await usuario('docente2.demo@unicap.br', 'Profa. Marina Vasconcelos', 'docente123', 'DOCENTE', {
    departamento: 'DEMAT',
  });
  const carla = await usuario('avaliador.demo@unicap.br', 'Profa. Carla Mendes', 'docente123', 'DOCENTE', {
    departamento: 'FIS',
  });
  const fernando = await usuario('avaliador2.demo@unicap.br', 'Prof. Fernando Guimarães', 'docente123', 'DOCENTE', {
    departamento: 'QUI',
  });
  const ana = await usuario('discente.demo@unicap.br', 'Ana Discente', 'discente123', 'DISCENTE', {
    departamento: 'Ciência da Computação',
    matricula: '2021049281',
  });
  const bruno = await usuario('bruno.demo@unicap.br', 'Bruno Fontes', 'discente123', 'DISCENTE', {
    departamento: 'Ciência da Computação',
    matricula: '2022019402',
  });
  const julia = await usuario('julia.demo@unicap.br', 'Júlia Ramos', 'discente123', 'DISCENTE', {
    departamento: 'Engenharia da Computação',
    matricula: '2023011577',
  });
  const caio = await usuario('caio.demo@unicap.br', 'Caio Albuquerque', 'discente123', 'DISCENTE', {
    departamento: 'Matemática',
    matricula: '2022033190',
  });
  await usuario('visitante.demo@unicap.br', 'Ana Visitante', 'visitante123', 'USUARIO');

  // Os alunos anexam o Lattes no cadastro: os de demonstração já têm o deles.
  for (const aluno of [ana, bruno, julia, caio]) await curriculoDemo(aluno);

  const agora = Date.now();
  const em = (dias: number) => new Date(agora + dias * DIA);

  // ── Edital aberto pela UNICAP (projetos sendo divulgados e enviados) ───
  const aberto = await edital({
    numero: '01/2026',
    titulo: 'Edital PIBIC 2026/2027',
    descricao:
      'Programa Institucional de Bolsas de Iniciação Científica da UNICAP. Os professores divulgam seus projetos, selecionam o aluno e enviam ao edital até o prazo final.',
    status: 'PUBLICADO',
    tipoBolsa: 'PIBIC',
    totalCotas: 8,
    notaCorte: 7,
    dataInicioInscricoes: em(-5),
    dataFimInscricoes: em(60),
    publicadoEm: em(-5),
    encerradoEm: null,
    cotas: [
      { subareaCode: '1.03', subareaNome: 'Ciência da Computação', quantidade: 4 },
      { subareaCode: '1.01', subareaNome: 'Matemática', quantidade: 2 },
      { subareaCode: '2.04', subareaNome: 'Ecologia', quantidade: 2 },
    ],
  });

  // ── Edital encerrado com projeto aprovado (vitrine e relatórios mensais) ──
  const encerrado = await edital({
    numero: '02/2025',
    titulo: 'Edital PIBITI 2025/2026',
    descricao: 'Bolsas de Iniciação em Desenvolvimento Tecnológico e Inovação.',
    status: 'ENCERRADO',
    tipoBolsa: 'PIBITI',
    totalCotas: 3,
    notaCorte: 6,
    dataInicioInscricoes: em(-200),
    dataFimInscricoes: em(-150),
    publicadoEm: em(-200),
    encerradoEm: em(-150),
    cotas: [
      { subareaCode: '1.03', subareaNome: 'Ciência da Computação', quantidade: 2 },
      { subareaCode: '3.04', subareaNome: 'Engenharia Elétrica', quantidade: 1 },
    ],
  });

  // 1. Aprovado: Ana é bolsista do Prof. Roberto; avaliado por três professores.
  if (!(await container.inscricoesRepository.findByEditalAndDiscente(encerrado.id, ana.id))) {
    const homologadaEm = em(-120);
    const id = randomUUID();
    await container.inscricoesRepository.create(
      inscricaoBase({
        id,
        protocolo: await protocolo(),
        editalId: encerrado.id,
        discenteId: ana.id,
        orientadorId: roberto.id,
        titulo: 'Detecção de anomalias em redes elétricas inteligentes com aprendizado de máquina',
        subareaCode: '1.03',
        subareaNome: 'Ciência da Computação',
        palavrasChave: 'smart grid; aprendizado de máquina; séries temporais',
        resumo:
          'O projeto desenvolve modelos de aprendizado de máquina para detectar anomalias em medições de redes elétricas inteligentes, reduzindo perdas técnicas e apoiando a manutenção preditiva em parceria com a concessionária local.',
        objetivos: 'Construir uma base rotulada de medições e comparar modelos de detecção não supervisionada.',
        metodologia:
          'Coleta de séries temporais, engenharia de atributos, avaliação com validação temporal e estudo de caso.',
        status: 'APROVADA',
        homologacaoJustificativa: 'Aprovado com média 8,75 na avaliação por pares.',
        divulgadaEm: em(-190),
        submetidaEm: em(-170),
        homologadaEm,
        criadoEm: em(-195),
        atualizadoEm: homologadaEm,
        anexos: [
          await anexoDemo(id, 'PLANO_TRABALHO', 'plano-de-trabalho.pdf', 'Plano de trabalho - Smart grid'),
          await anexoDemo(id, 'LATTES', 'curriculo-lattes.pdf', 'Curriculo Lattes - Ana Discente'),
        ],
      }),
    );
    await candidatura({
      inscricaoId: id,
      discenteId: ana.id,
      mensagem: 'Tenho interesse em aprendizado de máquina aplicado a energia e já cursei a disciplina de séries temporais.',
      status: 'SELECIONADA',
      criadoEm: em(-185),
      respondidaEm: em(-180),
    });
    const pareceres: [string, number[], string][] = [
      [carla.id, [9, 8, 9, 9], 'Proposta relevante, com metodologia clara e cronograma factível.'],
      [fernando.id, [9, 9, 8, 9], ''],
      [marina.id, [8, 9, 9, 9], ''],
    ];
    for (const [avaliadorId, n, parecer] of pareceres) {
      await avaliacao({
        inscricaoId: id,
        avaliadorId,
        status: 'CONCLUIDA',
        notas: notas(n),
        notaFinal: 8.75,
        parecer,
        atribuidaEm: em(-170),
        concluidaEm: em(-150),
      });
    }

    // Relatórios mensais aprovados até dois meses atrás; o do mês passado fica faltando
    // para a demonstração do atraso (ou do lembrete, antes do dia 5).
    const mesPassado = competenciaDe(em(-30));
    for (const competencia of competenciasDaVigencia(homologadaEm).filter((c) => c < mesPassado)) {
      const enviadoEm = new Date(prazoMensal(competencia).getTime() - 2 * DIA);
      await container.relatoriosRepository.create({
        id: randomUUID(),
        inscricaoId: id,
        tipo: 'MENSAL',
        competencia,
        versao: 1,
        status: 'APROVADO',
        descricao: `Atividades de ${competencia}: leitura de artigos, limpeza da base de medições e experimentos com isolation forest e autoencoders, com resultados registrados no caderno do projeto.`,
        arquivo: null,
        comentarioOrientador: 'Bom progresso. Siga com a validação temporal.',
        enviadoEm,
        avaliadoEm: new Date(enviadoEm.getTime() + DIA),
      });
    }
  }

  // 2. Divulgado: o Prof. Roberto recebe candidaturas de Bruno e Júlia.
  const tituloDivulgado = 'Segmentação de tomografias pulmonares com redes neurais convolucionais';
  const doRoberto = await container.inscricoesRepository.list({ orientadorId: roberto.id });
  if (!doRoberto.some((i) => i.titulo === tituloDivulgado)) {
    const id = randomUUID();
    await container.inscricoesRepository.create(
      inscricaoBase({
        id,
        editalId: aberto.id,
        orientadorId: roberto.id,
        titulo: tituloDivulgado,
        subareaCode: '1.03',
        subareaNome: 'Ciência da Computação',
        palavrasChave: 'visão computacional; saúde; U-Net',
        resumo:
          'Investigação de arquiteturas U-Net e ResNet para segmentar lesões em tomografias pulmonares de bases públicas, com foco em interpretabilidade dos resultados para apoio ao diagnóstico.',
        objetivos: 'Treinar e comparar arquiteturas de segmentação e avaliar a interpretabilidade dos modelos.',
        metodologia: 'Revisão sistemática, preparação das bases, treino com validação cruzada e análise estatística.',
        status: 'DIVULGADA',
        divulgadaEm: em(-3),
        criadoEm: em(-4),
        atualizadoEm: em(-3),
        anexos: [await anexoDemo(id, 'PLANO_TRABALHO', 'plano-tomografia.pdf', 'Plano de trabalho - Tomografia')],
      }),
    );
    await candidatura({
      inscricaoId: id,
      discenteId: bruno.id,
      mensagem: 'Fiz o curso de visão computacional e quero trabalhar com aplicações em saúde.',
      status: 'PENDENTE',
      criadoEm: em(-2),
    });
    await candidatura({
      inscricaoId: id,
      discenteId: julia.id,
      mensagem: 'Tenho experiência com PyTorch em projetos da disciplina e disponibilidade de 20 horas semanais.',
      status: 'PENDENTE',
      criadoEm: em(-1),
    });
  }

  // 3. Em avaliação: a Profa. Marina enviou com Caio; Roberto, Carla e Fernando avaliam.
  if (!(await container.inscricoesRepository.findByEditalAndDiscente(aberto.id, caio.id))) {
    const id = randomUUID();
    await container.inscricoesRepository.create(
      inscricaoBase({
        id,
        protocolo: await protocolo(),
        editalId: aberto.id,
        discenteId: caio.id,
        orientadorId: marina.id,
        titulo: 'Modelos estocásticos para a dinâmica de manguezais do litoral pernambucano',
        subareaCode: '1.01',
        subareaNome: 'Matemática',
        palavrasChave: 'processos estocásticos; ecologia; manguezal',
        resumo:
          'O projeto modela a dinâmica populacional de espécies de manguezal com equações diferenciais estocásticas, calibradas com dados de monitoramento ambiental do litoral de Pernambuco.',
        objetivos: 'Propor e calibrar modelos estocásticos e comparar suas previsões com séries observadas.',
        metodologia:
          'Revisão de modelos, estimação de parâmetros por máxima verossimilhança e simulação de Monte Carlo.',
        status: 'EM_AVALIACAO',
        divulgadaEm: em(-4),
        submetidaEm: em(-1),
        criadoEm: em(-5),
        atualizadoEm: em(-1),
        anexos: [
          await anexoDemo(id, 'PLANO_TRABALHO', 'plano-manguezais.pdf', 'Plano de trabalho - Manguezais'),
          await anexoDemo(id, 'LATTES', 'lattes-caio.pdf', 'Curriculo Lattes - Caio Albuquerque'),
        ],
      }),
    );
    await candidatura({
      inscricaoId: id,
      discenteId: caio.id,
      mensagem: 'Curso Matemática e gostaria de aplicar processos estocásticos a problemas ambientais.',
      status: 'SELECIONADA',
      criadoEm: em(-3),
      respondidaEm: em(-2),
    });
    for (const avaliadorId of [roberto.id, carla.id, fernando.id]) {
      await avaliacao({
        inscricaoId: id,
        avaliadorId,
        status: 'PENDENTE',
        notas: [],
        notaFinal: null,
        parecer: '',
        atribuidaEm: em(-1),
        concluidaEm: null,
      });
    }
  }

  console.log(`Seed OK: gestor ${gestor.email}, editais 01/2026 (aberto) e 02/2025 (encerrado).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => container.disconnect?.());
