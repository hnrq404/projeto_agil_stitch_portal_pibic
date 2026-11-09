/**
 * Etapa nomeada de uma jornada (o `test.step` do Playwright, que o Jest não tem).
 * Se uma asserção falhar dentro dela, a mensagem começa com o nome da etapa,
 * então a falha diz em que ponto da jornada o teste quebrou (Assertion Roulette, T2).
 */
export async function etapa<T>(nome: string, corpo: () => Promise<T>): Promise<T> {
  try {
    return await corpo();
  } catch (erro) {
    if (erro instanceof Error) {
      const prefixo = `[etapa: ${nome}] `;
      erro.message = prefixo + erro.message;
    }
    throw erro;
  }
}
