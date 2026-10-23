/**
 * Uso único: copia para o Vercel Blob os PDFs que estão em disco (server/uploads)
 * e são referenciados no Firestore configurado no .env. Serve para quem rodou o
 * seed antes de ter o Blob: os anexos continuam com as mesmas chaves.
 *
 *   BLOB_READ_WRITE_TOKEN=... npx tsx src/infra/copiar-pdfs-para-blob.ts
 */
import fs from 'node:fs/promises';
import path from 'node:path';

import { VercelBlobStorage } from '../shared/storage/vercel-blob.storage';
import { buildApp } from './config/app.container';
import { loadEnv } from './config/env';

loadEnv();

async function main(): Promise<void> {
  const token = process.env['BLOB_READ_WRITE_TOKEN'];
  if (!token) throw new Error('Defina BLOB_READ_WRITE_TOKEN (token do Blob store do projeto na Vercel).');

  const container = buildApp({ persistencia: 'firestore' });
  const blob = new VercelBlobStorage(token);
  const pasta = path.resolve(__dirname, '..', '..', process.env['UPLOADS_DIR'] ?? 'uploads');

  const inscricoes = await container.inscricoesRepository.list();
  const relatorios = await container.relatoriosRepository.list();
  const chaves = [
    ...inscricoes.flatMap((i) => i.anexos.map((a) => a.storageKey)),
    ...relatorios.flatMap((r) => (r.arquivo ? [r.arquivo.storageKey] : [])),
  ];

  let copiados = 0;
  for (const chave of chaves) {
    if (await blob.inspecionar(chave)) continue;
    try {
      await blob.salvar(chave, await fs.readFile(path.join(pasta, chave)));
      copiados += 1;
    } catch (error) {
      console.warn(`Sem arquivo local para ${chave}:`, (error as Error).message);
    }
  }
  console.log(`${copiados} de ${chaves.length} PDF(s) copiados para o Blob.`);
  await container.disconnect?.();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
