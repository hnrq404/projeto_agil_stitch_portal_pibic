### Linha de base por rota (10 conexões, 10 s)

| Rota | req/s | p50 (ms) | p90 (ms) | p99 (ms) | Falhas |
|---|---|---|---|---|---|
| Site (index.html) | 4010.8 | 2 | 3 | 4 | 0% |
| Saúde + banco | 792.9 | 11 | 17 | 23 | 0% |
| Editais abertos (público) | 426.7 | 22 | 30 | 41 | 0% |
| Projetos com vaga (público) | 276.7 | 34 | 45 | 64 | 0% |
| Vitrine de pesquisas (público) | 344.6 | 28 | 36 | 47 | 0% |
| Sessão /me (aluno) | 855.5 | 10 | 15 | 26 | 0% |
| Notificações não lidas (aluno) | 495.2 | 19 | 25 | 35 | 0% |
| Minhas candidaturas (aluno) | 192.6 | 50 | 61 | 73 | 0% |
| Meus projetos (professor) | 225.6 | 43 | 52 | 64 | 0% |
| Minhas avaliações (professor) | 190.5 | 51 | 61 | 71 | 0% |
| Painel do gestor | 191.7 | 50 | 62 | 73 | 0% |
| Triagem (gestor) | 151.2 | 64 | 77 | 97 | 0% |
| Login (hash de senha) | 55.5 | 175 | 209 | 303 | 0% |

### Uso misto (20 s por nível)

| Conexões | Requisições | req/s | Média (ms) | p50 | p90 | p99 | Falhas |
|---|---|---|---|---|---|---|---|
| 10 | 6022 | 301.1 | 32.8 | 32 | 54 | 70 | 0% |
| 50 | 6755 | 337.8 | 147.8 | 145 | 246 | 290 | 0% |
| 100 | 5755 | 287.8 | 344 | 330 | 580 | 739 | 0% |
