| Id | Verificação | Esperado | Obtido | Resultado |
|---|---|---|---|---|
| A1 | 17 rotas protegidas sem token | todas 401 | todas 401 | ✅ |
| A2 | Token malformado | 401 | 401 | ✅ |
| A3 | JWT com alg "none" se passando pelo gestor | 401 | 401 | ✅ |
| A4 | JWT de gestor assinado com segredo errado | 401 | 401 | ✅ |
| A5 | JWT expirado (assinatura válida) | 401 | 401 | ✅ |
| A6 | JWT válido de aluno com papel GESTOR no token (papel vem do banco) | 403 | 403 | ✅ |
| A7 | JWT válido de usuário inexistente | 401 | 401 | ✅ |
| A8 | Login de conta com e-mail não confirmado | 403 EMAIL_NAO_CONFIRMADO | 403 EMAIL_NAO_CONFIRMADO | ✅ |
| E1 | Link de confirmação usado duas vezes | 1º 200, 2º 400 | 200, 400 | ✅ |
| E2 | Nome com HTML escapado no e-mail enviado | sem <img no HTML | escapado | ✅ |
| A9 | Troca de senha derruba a sessão antiga | antiga 401 | troca 200, antiga 401 | ✅ |
| E3 | "Esqueci minha senha" não revela se o e-mail tem conta | respostas iguais | iguais | ✅ |
| E4 | Token de nova senha adulterado | 400 | 400 | ✅ |
| E5 | Token de nova senha usado duas vezes | 1º 200, 2º 400 | 200, 400 | ✅ |
| E6 | Login não revela se o e-mail tem conta | mesma resposta | iguais | ✅ |
| E7 | Cadastro com e-mail já usado revela que a conta existe | não revelar (ou risco aceito) | 409 "Já existe uma conta com este e-mail." | ❌ baixa (risco aceito) |
| B1 | discente em 7 rotas de gestor | todas 403 | todas 403 | ✅ |
| B2 | docente em 7 rotas de gestor | todas 403 | todas 403 | ✅ |
| B3 | visitante em 7 rotas de gestor | todas 403 | todas 403 | ✅ |
| B4 | Aluno tenta se promover a gestor | 403 | 403 | ✅ |
| B5 | Aluno lê projeto em avaliação de um professor | 404 | 404 | ✅ |
| B6 | Professor sem vínculo lê projeto em avaliação de colega | 404 | 404 | ✅ |
| B7 | Controle: avaliador indicado lê o projeto que avalia | 200 | 200 | ✅ |
| B8 | Professor edita projeto de colega | 403/404 | 404 | ✅ |
| B9 | Aluna cancela a candidatura de outro aluno | 403/404 | 404 | ✅ |
| B10 | Aluno marca como lida a notificação de outro | 403/404 | 404 | ✅ |
| B11 | Professor lê o parecer de outro avaliador | 403/404 | 404 | ✅ |
| B12 | Aluno lê o projeto (e relatórios) de outro bolsista | 403/404 | 404 | ✅ |
| B13 | Aluna baixa o currículo de outro candidato | 403/404 | 403 | ✅ |
| B14 | Professor lista candidatos do projeto de colega | 403/404 | 404 | ✅ |
| C1 | Cadastro pedindo papel GESTOR | 400 | 400 | ✅ |
| C2 | Cadastro com campo extra (emailPendente:false) | 400 | 400 | ✅ |
| C3 | Cadastro com domínio de fora (3 variações) | todas 400 | 400,400,400 | ✅ |
| C4 | Operadores e objetos na query string | nenhum 500 | 200,200,200 | ✅ |
| C5 | JSON malformado | 400 sem stack | 400 | ✅ |
| C6 | Rota inexistente da API | 404 JSON | 404 JSON | ✅ |
| C7 | Corpo JSON de 2 MB | 413 | 413 "Dados enviados acima do tamanho permitido." | ✅ |
| C8 | Mensagem do 413 adequada a corpo JSON | sem citar "Arquivo" | Dados enviados acima do tamanho permitido. | ✅ |
| C9 | Senha fraca (só números) | 400 | 400 | ✅ |
| D1 | Arquivo que não é PDF com Content-Type de PDF | 400 | 400 "Formato inválido. Apenas arquivos PDF são aceitos." | ✅ |
| D2 | Envio com assinatura do link adulterada | 403 | 403 | ✅ |
| D3 | Path traversal na chave do arquivo | 400/404 | 400,400 | ✅ |
| D4 | Aluno registra como seu um arquivo enviado por outra aluna | 400 | 400 | ✅ |
| D5 | Link de leitura com o nome do arquivo trocado | 403 | 403 | ✅ |
| F1 | Cabeçalhos de segurança da API | todos presentes | todos presentes | ✅ |
| F2 | X-Powered-By (revela Express) | ausente | ausente | ✅ |
| F3 | CORS para origem maliciosa | sem Access-Control-Allow-Origin | ausente | ✅ |
| F4 | Tarefas agendadas sem / com segredo errado / certo | 401, 401, 200 | 401, 401, 200 | ✅ |
| G1 | 30 senhas erradas em paralelo para uma conta (limite: 10) | no máximo 10 testadas | 0 testadas, 30 bloqueadas | ✅ |
| G2 | Após 10 senhas erradas, a conta atacada fica bloqueada (mesmo com a senha certa) | 429, com no máximo 10 testadas | 429, 10 testadas no total | ✅ |
| G3 | Outra pessoa na mesma rede (IP) consegue entrar com a senha certa | 200 | 200 | ✅ |
| G4 | Rajada de "esqueci minha senha" para um mesmo e-mail | bloqueia | 202,202,202,429 | ✅ |
