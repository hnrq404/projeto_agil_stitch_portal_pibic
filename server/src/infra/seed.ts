/**
 * Seed de demonstração — uma conta por papel e dados que exercitam todos os fluxos.
 *
 *   npm run db:seed --prefix server
 *
 * Contas (senha = papel + "123"):
 *   gestor@pibic.edu.br     / gestor123     (GESTOR)
 *   docente@pibic.edu.br    / docente123    (DOCENTE, DCC)
 *   avaliador@pibic.edu.br  / avaliador123  (AVALIADOR, FIS)
 *   discente@pibic.edu.br   / discente123   (DISCENTE, bolsista com projeto aprovado)
 *   bruno@pibic.edu.br      / discente123   (DISCENTE, proposta aguardando o orientador)
 *   visitante@pibic.edu.br  / visitante123  (USUARIO)
 *
 * Idempotente: pode rodar várias vezes sem duplicar dados.
 */
import { randomUUID } from 'node:crypto';
import path from 'node:path';

import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

import { gerarProtocolo } from '../modules/inscricoes/domain/inscricoes.rules';
import { DiskArquivoStorage } from '../shared/storage/arquivo.storage';
import { loadEnv } from './config/env';

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

async function main(): Promise<void> {
  const gestor = await usuario('gestor@pibic.edu.br', 'Maria Gestora', 'gestor123', 'GESTOR', {
    departamento: 'PRPQ',
  });
  const docente = await usuario('docente@pibic.edu.br', 'Prof. Roberto Alencar', 'docente123', 'DOCENTE', {
    departamento: 'DCC',
  });
  await usuario('docente2@pibic.edu.br', 'Profa. Marina Vasconcelos', 'docente123', 'DOCENTE', {
    departamento: 'DEMAT',
  });
  const avaliador = await usuario('avaliador@pibic.edu.br', 'Dra. Carla Avaliadora', 'avaliador123', 'AVALIADOR', {
    departamento: 'FIS',
  });
  const avaliador2 = await usuario('avaliador2@pibic.edu.br', 'Dr. Fernando Guimarães', 'avaliador123', 'AVALIADOR', {
    departamento: 'QUI',
  });
  const discente = await usuario('discente@pibic.edu.br', 'Ana Discente', 'discente123', 'DISCENTE', {
    departamento: 'DCC',
    matricula: '2021049281',
  });
  const bruno = await usuario('bruno@pibic.edu.br', 'Bruno Fontes', 'discente123', 'DISCENTE', {
    departamento: 'DCC',
    matricula: '2022019402',
  });
  await usuario('visitante@pibic.edu.br', 'Ana Visitante', 'visitante123', 'USUARIO');

  const agora = Date.now();

  // ── Edital aberto (inscrições em andamento) ───────────────────────────
  let aberto = await prisma.edital.findUnique({ where: { numero: '01/2026' } });
  if (!aberto) {
    aberto = await prisma.edital.create({
      data: {
        numero: '01/2026',
        titulo: 'Edital PIBIC 2026/2027',
        descricao:
          'Programa Institucional de Bolsas de Iniciação Científica. Submeta sua proposta com plano de trabalho e currículo Lattes até o prazo final.',
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

  // ── Edital encerrado com projeto aprovado (vitrine e relatórios) ──────
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

  const aprovadaExiste = await prisma.inscricao.findUnique({
    where: { editalId_discenteId: { editalId: encerrado.id, discenteId: discente.id } },
  });
  if (!aprovadaExiste) {
    sequencial += 1;
    const homologadaEm = new Date(agora - 120 * DIA);
    const notas = (n: number[]) =>
      JSON.stringify(['MERITO', 'VIABILIDADE', 'ADEQUACAO', 'FORMACAO'].map((criterio, i) => ({ criterio, nota: n[i] })));
    await prisma.inscricao.create({
      data: {
        avaliacoes: {
          create: [
            {
              id: randomUUID(),
              avaliadorId: avaliador.id,
              status: 'CONCLUIDA',
              notas: notas([9, 8, 9, 9]),
              notaFinal: 8.75,
              parecer: 'Proposta relevante, com metodologia clara e cronograma factível.',
              atribuidaEm: new Date(agora - 160 * DIA),
              concluidaEm: new Date(agora - 150 * DIA),
            },
            {
              id: randomUUID(),
              avaliadorId: avaliador2.id,
              status: 'CONCLUIDA',
              notas: notas([9, 9, 8, 9]),
              notaFinal: 8.75,
              parecer: '',
              atribuidaEm: new Date(agora - 160 * DIA),
              concluidaEm: new Date(agora - 145 * DIA),
            },
          ],
        },
        id: randomUUID(),
        protocolo: gerarProtocolo(sequencial, anoAtual),
        editalId: encerrado.id,
        discenteId: discente.id,
        orientadorId: docente.id,
        titulo: 'Detecção de anomalias em redes elétricas inteligentes com aprendizado de máquina',
        subareaCode: '1.03',
        subareaNome: 'Ciência da Computação',
        palavrasChave: 'smart grid; aprendizado de máquina; séries temporais',
        resumo:
          'O projeto desenvolve modelos de aprendizado de máquina para detectar anomalias em medições de redes elétricas inteligentes, reduzindo perdas técnicas e apoiando a manutenção preditiva em parceria com a concessionária local.',
        objetivos: 'Construir uma base rotulada de medições e comparar modelos de detecção não supervisionada.',
        metodologia: 'Coleta de séries temporais, engenharia de atributos, avaliação com validação temporal e estudo de caso.',
        status: 'APROVADA',
        vinculoStatus: 'CONFIRMADO',
        homologacaoJustificativa: 'Aprovada com média 8,75 na avaliação por pares.',
        submetidaEm: new Date(agora - 170 * DIA),
        homologadaEm,
        criadoEm: new Date(agora - 180 * DIA),
        atualizadoEm: homologadaEm,
        anexos: {
          create: [
            await anexoDemo('PLANO_TRABALHO', 'plano-de-trabalho.pdf', 'Plano de trabalho - Smart grid'),
            await anexoDemo('LATTES', 'curriculo-lattes.pdf', 'Curriculo Lattes - Ana Discente'),
          ],
        },
      },
    });
  }

  const pendenteExiste = await prisma.inscricao.findUnique({
    where: { editalId_discenteId: { editalId: aberto.id, discenteId: bruno.id } },
  });
  if (!pendenteExiste) {
    sequencial += 1;
    await prisma.inscricao.create({
      data: {
        id: randomUUID(),
        protocolo: gerarProtocolo(sequencial, anoAtual),
        editalId: aberto.id,
        discenteId: bruno.id,
        orientadorId: docente.id,
        titulo: 'Segmentação de tomografias pulmonares com redes neurais convolucionais',
        subareaCode: '1.03',
        subareaNome: 'Ciência da Computação',
        palavrasChave: 'visão computacional; saúde; U-Net',
        resumo:
          'Investigação de arquiteturas U-Net e ResNet para segmentar lesões em tomografias pulmonares de bases públicas, com foco em interpretabilidade dos resultados para apoio ao diagnóstico.',
        objetivos: 'Treinar e comparar arquiteturas de segmentação e avaliar a interpretabilidade dos modelos.',
        metodologia: 'Revisão sistemática, preparação das bases, treino com validação cruzada e análise estatística.',
        status: 'SUBMETIDA',
        vinculoStatus: 'PENDENTE',
        submetidaEm: new Date(agora - 2 * DIA),
        criadoEm: new Date(agora - 4 * DIA),
        atualizadoEm: new Date(agora - 2 * DIA),
        anexos: {
          create: [
            await anexoDemo('PLANO_TRABALHO', 'plano-tomografia.pdf', 'Plano de trabalho - Tomografia'),
            await anexoDemo('LATTES', 'lattes-bruno.pdf', 'Curriculo Lattes - Bruno Fontes'),
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
