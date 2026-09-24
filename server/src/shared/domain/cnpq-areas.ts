/**
 * Tabela de Áreas do Conhecimento CNPq (recorte utilizado pelo programa PIBIC/PIBITI).
 *
 * Fonte: Diretório de Grupos de Pesquisa — CNPq (2 níveis hierárquicos):
 *   1. Grande Área   → ex. "1.00", "2.00"…
 *   2. Área          → ex. "1.01 — Matemática", "1.02 — Probabilidade e Estatística"…
 *
 * `subareaCode` recebe o código da Área CNPq de 2º nível (ex.: "1.01").
 * A listagem completa e atualizada vive no CNPq; aqui mantemos o recorte
 * necessário para o seed, filtros e validação de consistência das cotas.
 */

export interface CnpqArea {
  readonly code: string;
  readonly name: string;
}

export const CNPQ_AREAS: readonly CnpqArea[] = [
  { code: '1.00', name: 'Ciências Exatas e da Terra' },
  { code: '1.01', name: 'Matemática' },
  { code: '1.02', name: 'Probabilidade e Estatística' },
  { code: '1.03', name: 'Ciência da Computação' },
  { code: '1.04', name: 'Astronomia/Física' },
  { code: '1.05', name: 'Química' },
  { code: '1.06', name: 'Geociências' },
  { code: '1.08', name: 'Oceanografia' },
  { code: '2.00', name: 'Ciências Biológicas' },
  { code: '2.01', name: 'Genética' },
  { code: '2.02', name: 'Botânica' },
  { code: '2.03', name: 'Zoologia' },
  { code: '2.04', name: 'Ecologia' },
  { code: '2.05', name: 'Bioquímica' },
  { code: '2.07', name: 'Imunologia' },
  { code: '2.08', name: 'Microbiologia' },
  { code: '2.09', name: 'Fisiologia' },
  { code: '2.10', name: 'Farmacologia' },
  { code: '3.00', name: 'Engenharias' },
  { code: '3.01', name: 'Engenharia Civil' },
  { code: '3.02', name: 'Engenharia de Minas' },
  { code: '3.03', name: 'Engenharia de Materiais e Metalúrgica' },
  { code: '3.04', name: 'Engenharia Elétrica' },
  { code: '3.05', name: 'Engenharia Mecânica' },
  { code: '3.06', name: 'Engenharia Química' },
  { code: '3.07', name: 'Engenharia Nuclear' },
  { code: '3.08', name: 'Engenharia de Produção' },
  { code: '3.10', name: 'Engenharia Biomédica' },
  { code: '4.00', name: 'Ciências da Saúde' },
  { code: '4.01', name: 'Medicina' },
  { code: '4.02', name: 'Odontologia' },
  { code: '4.03', name: 'Farmácia' },
  { code: '4.04', name: 'Enfermagem' },
  { code: '4.05', name: 'Nutrição' },
  { code: '4.06', name: 'Saúde Coletiva' },
  { code: '4.08', name: 'Educação Física' },
  { code: '5.00', name: 'Ciências Agrárias' },
  { code: '5.01', name: 'Agronomia' },
  { code: '5.02', name: 'Recursos Florestais e Engenharia Florestal' },
  { code: '5.03', name: 'Engenharia Agrícola' },
  { code: '5.04', name: 'Zootecnia / Recursos Pesqueiros' },
  { code: '5.05', name: 'Fitotecnia' },
  { code: '5.06', name: 'Fitossanidade' },
  { code: '6.00', name: 'Ciências Sociais Aplicadas' },
  { code: '6.01', name: 'Serviço Social' },
  { code: '6.02', name: 'Economia' },
  { code: '6.03', name: 'Administração' },
  { code: '6.04', name: 'Arquitetura e Urbanismo' },
  { code: '6.05', name: 'Direito' },
  { code: '6.06', name: 'Ciências da Informação' },
  { code: '6.07', name: 'Comunicação' },
  { code: '7.00', name: 'Ciências Humanas' },
  { code: '7.01', name: 'Filosofia' },
  { code: '7.02', name: 'Sociologia' },
  { code: '7.03', name: 'Antropologia' },
  { code: '7.04', name: 'Arqueologia' },
  { code: '7.05', name: 'História' },
  { code: '7.06', name: 'Geografia' },
  { code: '7.07', name: 'Psicologia' },
  { code: '7.08', name: 'Educação' },
  { code: '7.09', name: 'Ciência Política e Relações Internacionais' },
  { code: '8.00', name: 'Linguística, Letras e Artes' },
  { code: '8.01', name: 'Linguística' },
  { code: '8.02', name: 'Letras' },
  { code: '8.03', name: 'Artes' },
  { code: '8.04', name: 'Museologia' },
] as const;

const areaCodes = new Set(CNPQ_AREAS.map((area) => area.code));

export function isKnownCnpqAreaCode(code: string): boolean {
  return areaCodes.has(code);
}

export function findCnpqAreaByCode(code: string): CnpqArea | undefined {
  return CNPQ_AREAS.find((area) => area.code === code);
}
