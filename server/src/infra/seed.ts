/**
 * Seed de demonstração — contas e dados que exercitam o fluxo inteiro:
 * edital aberto pela UNICAP → professor divulga o projeto → alunos se candidatam
 * → professor seleciona e envia ao edital com três avaliadores → gestão homologa
 * → bolsista envia o relatório mensal até o dia 5.
 *
 *   npm run db:seed --prefix server
 *
 * Contas:
 *   gestor@pibic.edu.br      / gestor123     (GESTOR)
 *   docente@pibic.edu.br     / docente123    (DOCENTE, DCC) dono de um projeto divulgado e de um aprovado;
 *                                            também avalia o projeto da Profa. Marina
 *   docente2@pibic.edu.br    / docente123    (DOCENTE, DEMAT) projeto em avaliação
 *   avaliador@pibic.edu.br   / docente123    (DOCENTE, FIS) conta antiga de avaliador, hoje professora
 *   avaliador2@pibic.edu.br  / docente123    (DOCENTE, QUI)
 *   discente@pibic.edu.br    / discente123   (DISCENTE, bolsista com relatório mensal em atraso)
 *   bruno@pibic.edu.br       / discente123   (DISCENTE, candidato ao projeto divulgado)
 *   julia@pibic.edu.br       / discente123   (DISCENTE, candidata ao projeto divulgado)
 *   caio@pibic.edu.br        / discente123   (DISCENTE, selecionado no projeto em avaliação)
 *   visitante@pibic.edu.br   / visitante123  (USUARIO)
 *
 * Idempotente: pode rodar várias vezes sem duplicar dados.
 */
import { randomUUID } from 'node:crypto';
import path from 'node:path';

import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

import { gerarProtocolo } from '../modules/inscricoes/domain/inscricoes.rules';
import { competenciasDaVigencia, competenciaDe, prazoMensal } from '../modules/projetos/domain/projetos.rules';
import { DiskArquivoStorage } from '../shared/storage/arquivo.storage';
import { loadEnv } from './config/env';
import { migrarLegado } from './migrar-legado';

loadEnv();

const prisma = new PrismaClient();
const storage = new DiskArquivoStorage(
  path.resolve(__dirname, '..', '..', process.env['UPLOADS_DIR'] ?? 'uploads'),
);

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

async function anexoDemo(tipo: 'PLANO_TRABALHO' | 'LATTES', nome: string, titulo: string) {
  const content = pdfDemo(titulo);
  const storageKey = randomUUID();
  await storage.save(storageKey, content);
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
  role: string,
  extra: { departamento?: string; matricula?: string } = {},
) {
  const senhaHash = await bcrypt.hash(senha, 10);
  return prisma.usuario.upsert({
    where: { email },
    update: { senhaHash, role, departamento: extra.departamento ?? '' },
    create: {
      nome,
      email,
      senhaHash,
      role,
      departamento: extra.departamento ?? '',
      matricula: extra.matricula ?? null,
    },
  });
}

const notas = (n: number[]) =>
  JSON.stringify(['MERITO', 'VIABILIDADE', 'ADEQUACAO', 'FORMACAO'].map((criterio, i) => ({ criterio, nota: n[i] })));

async function main(): Promise<void> {
  for (const linha of await migrarLegado(prisma)) console.log(`Migração: ${linha}`);

  const gestor = await usuario('gestor@pibic.edu.br', 'Maria Gestora', 'gestor123', 'GESTOR', {
    departamento: 'PRPQ',
  });
  const roberto = await usuario('docente@pibic.edu.br', 'Prof. Roberto Alencar', 'docente123', 'DOCENTE', {
    departamento: 'DCC',
  });
  const marina = await usuario('docente2@pibic.edu.br', 'Profa. Marina Vasconcelos', 'docente123', 'DOCENTE', {
    departamento: 'DEMAT',
  });
  const carla = await usuario('avaliador@pibic.edu.br', 'Profa. Carla Mendes', 'docente123', 'DOCENTE', {
    departamento: 'FIS',
  });
  const fernando = await usuario('avaliador2@pibic.edu.br', 'Prof. Fernando Guimarães', 'docente123', 'DOCENTE', {
    departamento: 'QUI',
  });
  const ana = await usuario('discente@pibic.edu.br', 'Ana Discente', 'discente123', 'DISCENTE', {
    departamento: 'Ciência da Computação',
    matricula: '2021049281',
  });
  const bruno = await usuario('bruno@pibic.edu.br', 'Bruno Fontes', 'discente123', 'DISCENTE', {
    departamento: 'Ciência da Computação',
    matricula: '2022019402',
  });
  const julia = await usuario('julia@pibic.edu.br', 'Júlia Ramos', 'discente123', 'DISCENTE', {
    departamento: 'Engenharia da Computação',
    matricula: '2023011577',
  });
  const caio = await usuario('caio@pibic.edu.br', 'Caio Albuquerque', 'discente123', 'DISCENTE', {
    departamento: 'Matemática',
    matricula: '2022033190',
  });
  await usuario('visitante@pibic.edu.br', 'Ana Visitante', 'visitante123', 'USUARIO');

  const agora = Date.now();

  // ── Edital aberto pela UNICAP (projetos sendo divulgados e enviados) ───
  let aberto = await prisma.edital.findUnique({ where: { numero: '01/2026' } });
  if (!aberto) {
    aberto = await prisma.edital.create({
      data: {
        numero: '01/2026',
        titulo: 'Edital PIBIC 2026/2027',
        descricao:
          'Programa Institucional de Bolsas de Iniciação Científica da UNICAP. Os professores divulgam seus projetos, selecionam o aluno e enviam ao edital até o prazo final.',
        status: 'PUBLICADO',
        tipoBolsa: 'PIBIC',
        totalCotas: 8,
        notaCorte: 7,
        dataInicioInscricoes: new Date(agora - 5 * DIA),
        dataFimInscricoes: new Date(agora + 60 * DIA),
        publicadoEm: new Date(agora - 5 * DIA),
        cotas: {
          create: [
            { subareaCode: '1.03', subareaNome: 'Ciência da Computação', quantidade: 4 },
            { subareaCode: '1.01', subareaNome: 'Matemática', quantidade: 2 },
            { subareaCode: '2.04', subareaNome: 'Ecologia', quantidade: 2 },
          ],
        },
      },
    });
  }

  // ── Edital encerrado com projeto aprovado (vitrine e relatórios mensais) ──
  let encerrado = await prisma.edital.findUnique({ where: { numero: '02/2025' } });
  if (!encerrado) {
    encerrado = await prisma.edital.create({
      data: {
        numero: '02/2025',
        titulo: 'Edital PIBITI 2025/2026',
        descricao: 'Bolsas de Iniciação em Desenvolvimento Tecnológico e Inovação.',
        status: 'ENCERRADO',
        tipoBolsa: 'PIBITI',
        totalCotas: 3,
        notaCorte: 6,
        dataInicioInscricoes: new Date(agora - 200 * DIA),
        dataFimInscricoes: new Date(agora - 150 * DIA),
        publicadoEm: new Date(agora - 200 * DIA),
        encerradoEm: new Date(agora - 150 * DIA),
        cotas: {
          create: [
            { subareaCode: '1.03', subareaNome: 'Ciência da Computação', quantidade: 2 },
            { subareaCode: '3.04', subareaNome: 'Engenharia Elétrica', quantidade: 1 },
          ],
        },
      },
    });
  }

  const anoAtual = new Date().getUTCFullYear();
  let sequencial = await prisma.inscricao.count({ where: { protocolo: { contains: `/${anoAtual}-` } } });

  // 1. Aprovado: Ana é bolsista do Prof. Roberto; avaliado por três professores.
  const aprovadoExiste = await prisma.inscricao.findUnique({
    where: { editalId_discenteId: { editalId: encerrado.id, discenteId: ana.id } },
  });
  if (!aprovadoExiste) {
    sequencial += 1;
    const homologadaEm = new Date(agora - 120 * DIA);
    const projetoId = randomUUID();
    await prisma.inscricao.create({
      data: {
        id: projetoId,
        protocolo: gerarProtocolo(sequencial, anoAtual),
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
        metodologia: 'Coleta de séries temporais, engenharia de atributos, avaliação com validação temporal e estudo de caso.',
        status: 'APROVADA',
        homologacaoJustificativa: 'Aprovado com média 8,75 na avaliação por pares.',
        divulgadaEm: new Date(agora - 190 * DIA),
        submetidaEm: new Date(agora - 170 * DIA),
        homologadaEm,
        criadoEm: new Date(agora - 195 * DIA),
        atualizadoEm: homologadaEm,
        candidaturas: {
          create: [
            {
              id: randomUUID(),
              discenteId: ana.id,
              mensagem: 'Tenho interesse em aprendizado de máquina aplicado a energia e já cursei a disciplina de séries temporais.',
              status: 'SELECIONADA',
              criadoEm: new Date(agora - 185 * DIA),
              respondidaEm: new Date(agora - 180 * DIA),
            },
          ],
        },
        avaliacoes: {
          create: [
            [carla.id, [9, 8, 9, 9], 8.75, 'Proposta relevante, com metodologia clara e cronograma factível.'],
            [fernando.id, [9, 9, 8, 9], 8.75, ''],
            [marina.id, [8, 9, 9, 9], 8.75, ''],
          ].map(([avaliadorId, n, notaFinal, parecer]) => ({
            id: randomUUID(),
            avaliadorId: avaliadorId as string,
            status: 'CONCLUIDA',
            notas: notas(n as number[]),
            notaFinal: notaFinal as number,
            parecer: parecer as string,
            atribuidaEm: new Date(agora - 170 * DIA),
            concluidaEm: new Date(agora - 150 * DIA),
          })),
        },
        anexos: {
          create: [
            await anexoDemo('PLANO_TRABALHO', 'plano-de-trabalho.pdf', 'Plano de trabalho - Smart grid'),
            await anexoDemo('LATTES', 'curriculo-lattes.pdf', 'Curriculo Lattes - Ana Discente'),
          ],
        },
      },
    });

    // Relatórios mensais aprovados até dois meses atrás; o do mês passado fica faltando
    // para a demonstração do atraso (ou do lembrete, antes do dia 5).
    const mesPassado = competenciaDe(new Date(agora - 30 * DIA));
    const enviados = competenciasDaVigencia(homologadaEm).filter((c) => c < mesPassado);
    for (const competencia of enviados) {
      const enviadoEm = new Date(prazoMensal(competencia).getTime() - 2 * DIA);
      await prisma.relatorio.create({
        data: {
          id: randomUUID(),
          inscricaoId: projetoId,
          tipo: 'MENSAL',
          competencia,
          versao: 1,
          status: 'APROVADO',
          descricao: `Atividades de ${competencia}: leitura de artigos, limpeza da base de medições e experimentos com isolation forest e autoencoders, com resultados registrados no caderno do projeto.`,
          comentarioOrientador: 'Bom progresso. Siga com a validação temporal.',
          enviadoEm,
          avaliadoEm: new Date(enviadoEm.getTime() + DIA),
        },
      });
    }
  }

  // 2. Divulgado: o Prof. Roberto recebe candidaturas de Bruno e Júlia.
  const tituloDivulgado = 'Segmentação de tomografias pulmonares com redes neurais convolucionais';
  const divulgadoExiste = await prisma.inscricao.findFirst({
    where: { orientadorId: roberto.id, titulo: tituloDivulgado },
  });
  if (!divulgadoExiste) {
    await prisma.inscricao.create({
      data: {
        id: randomUUID(),
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
        divulgadaEm: new Date(agora - 3 * DIA),
        criadoEm: new Date(agora - 4 * DIA),
        atualizadoEm: new Date(agora - 3 * DIA),
        anexos: {
          create: [await anexoDemo('PLANO_TRABALHO', 'plano-tomografia.pdf', 'Plano de trabalho - Tomografia')],
        },
        candidaturas: {
          create: [
            {
              id: randomUUID(),
              discenteId: bruno.id,
              mensagem: 'Fiz o curso de visão computacional e quero trabalhar com aplicações em saúde.',
              status: 'PENDENTE',
              criadoEm: new Date(agora - 2 * DIA),
            },
            {
              id: randomUUID(),
              discenteId: julia.id,
              mensagem: 'Tenho experiência com PyTorch em projetos da disciplina e disponibilidade de 20 horas semanais.',
              status: 'PENDENTE',
              criadoEm: new Date(agora - 1 * DIA),
            },
          ],
        },
      },
    });
  }

  // 3. Em avaliação: a Profa. Marina enviou com Caio; Roberto, Carla e Fernando avaliam.
  const emAvaliacaoExiste = await prisma.inscricao.findUnique({
    where: { editalId_discenteId: { editalId: aberto.id, discenteId: caio.id } },
  });
  if (!emAvaliacaoExiste) {
    sequencial += 1;
    await prisma.inscricao.create({
      data: {
        id: randomUUID(),
        protocolo: gerarProtocolo(sequencial, anoAtual),
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
        metodologia: 'Revisão de modelos, estimação de parâmetros por máxima verossimilhança e simulação de Monte Carlo.',
        status: 'EM_AVALIACAO',
        divulgadaEm: new Date(agora - 4 * DIA),
        submetidaEm: new Date(agora - 1 * DIA),
        criadoEm: new Date(agora - 5 * DIA),
        atualizadoEm: new Date(agora - 1 * DIA),
        candidaturas: {
          create: [
            {
              id: randomUUID(),
              discenteId: caio.id,
              mensagem: 'Curso Matemática e gostaria de aplicar processos estocásticos a problemas ambientais.',
              status: 'SELECIONADA',
              criadoEm: new Date(agora - 3 * DIA),
              respondidaEm: new Date(agora - 2 * DIA),
            },
          ],
        },
        avaliacoes: {
          create: [roberto.id, carla.id, fernando.id].map((avaliadorId) => ({
            id: randomUUID(),
            avaliadorId,
            status: 'PENDENTE',
            atribuidaEm: new Date(agora - 1 * DIA),
          })),
        },
        anexos: {
          create: [
            await anexoDemo('PLANO_TRABALHO', 'plano-manguezais.pdf', 'Plano de trabalho - Manguezais'),
            await anexoDemo('LATTES', 'lattes-caio.pdf', 'Curriculo Lattes - Caio Albuquerque'),
          ],
        },
      },
    });
  }

  console.log(`Seed OK: gestor ${gestor.email}, editais 01/2026 (aberto) e 02/2025 (encerrado).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
