/**
 * Seed de demonstração — contas e um edital publicado para explorar a aplicação.
 *
 *   npm run db:seed --prefix server
 *
 * Contas criadas:
 *   gestor@pibic.edu.br    / gestor123     (GESTOR)
 *   visitante@pibic.edu.br / visitante123  (USUARIO)
 */
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

import { loadEnv } from './config/env';

loadEnv();

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const senhaGestor = await bcrypt.hash('gestor123', 10);
  const senhaVisitante = await bcrypt.hash('visitante123', 10);

  const gestor = await prisma.usuario.upsert({
    where: { email: 'gestor@pibic.edu.br' },
    update: { senhaHash: senhaGestor },
    create: {
      nome: 'Maria Gestora',
      email: 'gestor@pibic.edu.br',
      senhaHash: senhaGestor,
      role: 'GESTOR',
    },
  });

  await prisma.usuario.upsert({
    where: { email: 'visitante@pibic.edu.br' },
    update: { senhaHash: senhaVisitante },
    create: {
      nome: 'Ana Visitante',
      email: 'visitante@pibic.edu.br',
      senhaHash: senhaVisitante,
      role: 'USUARIO',
    },
  });

  const existente = await prisma.edital.findUnique({ where: { numero: '01/2026' } });
  if (!existente) {
    const futuro = new Date();
    futuro.setDate(futuro.getDate() + 60);
    await prisma.edital.create({
      data: {
        numero: '01/2026',
        titulo: 'Edital PIBIC 2026/2027 — Inscrições Abertas',
        descricao:
          'Programa Institucional de Bolsas de Iniciação Científica. Submeta sua proposta até o prazo final.',
        status: 'PUBLICADO',
        tipoBolsa: 'PIBIC',
        totalCotas: 8,
        dataInicioInscricoes: new Date(),
        dataFimInscricoes: futuro,
        publicadoEm: new Date(),
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

  console.log(`Seed OK — gestor: ${gestor.email} / edital 01/2026 publicado.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
