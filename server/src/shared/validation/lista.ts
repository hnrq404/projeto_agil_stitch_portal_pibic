import { z, type ZodTypeAny } from 'zod';

/**
 * Lista com no máximo `max` itens, cortada em `max + 1` ANTES de validar os itens.
 *
 * O Zod 3 valida cada item mesmo quando a lista já passou do máximo e gera um erro
 * por item inválido (GHSA-mrhx-c7xc-m3w5): um corpo de 1 MB com 500 mil itens subia
 * a memória da API de 135 MB para 522 MB e gerava uma resposta de 17 MB (teste de
 * segurança, testes-finais/). Com o corte, o erro "acima do máximo" continua saindo,
 * mas no máximo `max + 1` itens são validados.
 */
export function listaLimitada<S extends ZodTypeAny>(schema: S, max: number) {
  return z
    .unknown()
    .transform((valor) => (Array.isArray(valor) && valor.length > max ? valor.slice(0, max + 1) : valor))
    .pipe(schema);
}
