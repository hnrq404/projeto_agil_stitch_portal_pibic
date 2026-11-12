## Carga: http://localhost:3100

### Linha de base por rota (10 conexões, 10 s)

| Rota | req/s | p50 (ms) | p90 (ms) | p99 (ms) | Falhas |
|---|---|---|---|---|---|
| Site (index.html) | 2565.4 | 3 | 4 | 7 | 0% |
| Saúde + banco | 648.3 | 14 | 21 | 31 | 0% |
| Editais abertos (público) | 310.6 | 31 | 42 | 54 | 0% |
| Projetos com vaga (público) | 196.8 | 49 | 65 | 84 | 0% |
| Vitrine de pesquisas (público) | 246.4 | 39 | 51 | 66 | 0% |
| Sessão /me (aluno) | 771.3 | 12 | 17 | 23 | 0% |
| Notificações não lidas (aluno) | 460.7 | 20 | 27 | 37 | 0% |
| Minhas candidaturas (aluno) | 171.5 | 56 | 69 | 89 | 0% |
| Meus projetos (professor) | 195.4 | 49 | 62 | 78 | 0% |
| Minhas avaliações (professor) | 118.8 | 69 | 99 | 464 | 0% |
| Painel do gestor | 140.3 | 68 | 86 | 112 | 0% |
| Triagem (gestor) | 114 | 84 | 112 | 131 | 0% |
| Login (bcrypt) | 10.5 | 887 | 1176 | 1484 | 0% |

### Uso misto (20 s por nível)

| Conexões | Requisições | req/s | Média (ms) | p50 | p90 | p99 | Falhas |
|---|---|---|---|---|---|---|---|
| 10 | 4952 | 247.6 | 40 | 38 | 66 | 88 | 0% |
| 50 | 3244 | 162.2 | 305.1 | 199 | 404 | 2420 | 0% |
| 100 | 2579 | 129 | 782 | 545 | 2239 | 3682 | 0% |
