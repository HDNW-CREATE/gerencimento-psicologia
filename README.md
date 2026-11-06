# Consultório de Psicologia – Sistema de Gestão

Site público + área do paciente + painel da psicóloga, com agenda, prontuário criptografado, financeiro, recibos em PDF, lembretes por e-mail e conformidade com a LGPD.

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind + componentes shadcn-style · PostgreSQL + Prisma · Auth.js v5 · Zod · React Hook Form · FullCalendar · Recharts · React Email + Resend · pdf-lib · Vitest + Playwright.

> 📚 Documentos: [Arquitetura e diagrama do banco](docs/ARQUITETURA.md) · [Deploy passo a passo](docs/DEPLOY.md) · [Backup e restauração](docs/BACKUP.md) · [Manual da psicóloga](docs/MANUAL-PSICOLOGA.md)

---

## 1. Rodando no seu computador (VS Code)

### Pré-requisitos

- **Node.js 20.9 ou superior** (recomendado 22) – <https://nodejs.org>
- **PostgreSQL 15+**. O jeito mais fácil: **Docker Desktop** (comando abaixo). Sem Docker, instale o PostgreSQL normalmente e crie um banco chamado `consultorio`.

### Passo a passo

```bash
# 1) Instale as dependências (também gera o cliente do Prisma)
npm install

# 2) Suba um PostgreSQL local (precisa do Docker). Pule se já tem um banco.
docker run -d --name consultorio-db -p 5432:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=consultorio postgres:17

# 3) Crie o arquivo de configuração
cp .env.example .env        # no Windows (PowerShell): Copy-Item .env.example .env
```

Abra o `.env` e preencha **3 valores obrigatórios** (gere cada chave com `npm run gen:key`):

| Variável                  | O que é                                                                     |
| ------------------------- | --------------------------------------------------------------------------- |
| `AUTH_SECRET`             | segredo das sessões (rode `npm run gen:key`)                                |
| `CLINICAL_ENCRYPTION_KEY` | chave do prontuário (rode `npm run gen:key`) — **guarde uma cópia segura!** |
| `CRON_SECRET`             | senha do agendador de lembretes (qualquer texto longo)                      |

```bash
# 4) Crie as tabelas e carregue os dados de exemplo
npm run db:deploy
npm run db:seed

# 5) Inicie
npm run dev
```

Acesse **http://localhost:3000**.

### Contas de demonstração (criadas pelo seed)

| Perfil            | E-mail                    | Senha                                                  |
| ----------------- | ------------------------- | ------------------------------------------------------ |
| Psicóloga (ADMIN) | `admin@consultorio.local` | `Troque123senha` (ou o valor de `SEED_ADMIN_PASSWORD`) |
| Paciente          | `maria@exemplo.com`       | `Paciente123`                                          |
| Paciente          | `joao@exemplo.com`        | `Paciente123`                                          |
| Paciente (casal)  | `carla@exemplo.com`       | `Paciente123`                                          |

Os dados de exemplo só são criados com `SEED_DEMO_DATA="true"` (use apenas em desenvolvimento).

### E-mails em desenvolvimento

Sem `RESEND_API_KEY`, nenhum e-mail é enviado de verdade: o conteúdo (incluindo os links de confirmação e de redefinição de senha) aparece **no terminal** e é salvo em `.dev-mail/`.

---

## 2. Comandos

| Comando                                                             | O que faz                                                                  |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `npm run dev`                                                       | servidor de desenvolvimento                                                |
| `npm run build` / `npm start`                                       | build e execução de produção                                               |
| `npm run lint` · `npm run typecheck` · `npm run format`             | qualidade de código (ESLint, TypeScript, Prettier)                         |
| `npm test`                                                          | testes unitários (Vitest)                                                  |
| `npm run test:integration`                                          | testes com banco real (concorrência de agendamento, prontuário, lembretes) |
| `npm run test:e2e`                                                  | testes ponta a ponta (Playwright)                                          |
| `npm run db:migrate`                                                | cria/aplica migrations em desenvolvimento                                  |
| `npm run db:deploy`                                                 | aplica migrations (produção)                                               |
| `npm run db:seed`                                                   | dados base (+ exemplos se `SEED_DEMO_DATA=true`)                           |
| `npm run db:studio`                                                 | navegador visual do banco                                                  |
| `npm run admin:create -- --email=... --name="..." --password="..."` | cria/redefine a conta ADMIN (ou `--role=SECRETARIA`)                       |
| `npm run gen:key`                                                   | gera uma chave aleatória de 32 bytes (base64)                              |
| `npm run icons`                                                     | regenera os ícones do PWA                                                  |

### Rodando os testes de integração e E2E

Precisam de um banco **dedicado** cujo nome contenha `test` (ele é apagado a cada execução):

```bash
docker exec consultorio-db psql -U postgres -c "CREATE DATABASE consultorio_test"
# em .env:  TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/consultorio_test?schema=public"
npm run test:integration
npx playwright install chromium   # só na primeira vez
npm run test:e2e
```

---

## 3. Como criar a conta ADMIN

A conta da psicóloga **nunca** é criada por cadastro público. Duas formas:

1. **Seed:** defina `SEED_ADMIN_EMAIL`, `SEED_ADMIN_NAME` e `SEED_ADMIN_PASSWORD` no `.env` e rode `npm run db:seed`.
2. **Script (recomendado em produção):**
   ```bash
   npm run admin:create -- --email=voce@seudominio.com.br --name="Dra. Fulana" --password="UmaSenhaForte123"
   ```
   Sem `--password`, uma senha aleatória é gerada e exibida uma única vez. Rodar de novo com o mesmo e-mail **redefine a senha** (e encerra as sessões antigas).

Para uma futura secretária: `--role=SECRETARIA` (acessa agenda, pacientes e financeiro — **nunca** prontuário).

---

## 4. Variáveis de ambiente

Todas estão documentadas em [`.env.example`](.env.example). Resumo:

| Variável                       | Obrigatória | Descrição                                    |
| ------------------------------ | :---------: | -------------------------------------------- |
| `DATABASE_URL`                 |     ✅      | conexão PostgreSQL                           |
| `NEXT_PUBLIC_APP_URL`          |     ✅      | URL pública (usada nos links dos e-mails)    |
| `AUTH_SECRET`                  |     ✅      | segredo das sessões                          |
| `CLINICAL_ENCRYPTION_KEY`      |     ✅      | AES-256-GCM do prontuário (32 bytes, base64) |
| `CRON_SECRET`                  |  ✅ (prod)  | protege o endpoint de lembretes              |
| `RESEND_API_KEY`, `EMAIL_FROM` |  ✅ (prod)  | envio de e-mails                             |
| `EMAIL_ADMIN_NOTIFY`           |      –      | para onde vão os avisos à psicóloga          |
| `STORAGE_DRIVER` + `S3_*`      |  ✅ (prod)  | armazenamento de documentos (R2/Supabase/S3) |
| `SEED_*`                       |      –      | usados só pelo seed e script de admin        |
| `TEST_DATABASE_URL`            |      –      | banco dedicado dos testes                    |

---

## 5. Segurança e LGPD – o que está implementado

- **Permissões no servidor** em toda ação e rota (matriz única em `src/lib/permissions.ts`); o middleware é só a primeira barreira.
- **Paciente só vê o que é dele:** toda consulta filtra pelo paciente da _sessão_ (nunca por ID da URL). Documentos e recibos devolvem 404 idêntico para "não existe" e "não é seu".
- **Prontuário:** criptografia AES-256-GCM em nível de aplicação (com o ID do paciente como dado autenticado), versionamento imutável, sem exclusão (gatilhos no banco), exportação em PDF e auditoria de cada acesso — **sem** gravar conteúdo nos logs.
- **Senhas** com bcrypt (custo 12), política forte, bloqueio após 5 erros (15 min), rate limit por IP/e-mail, tokens de uso único com hash e expiração, "sair de todos os dispositivos".
- **Anti-duplo-agendamento:** transação _Serializable_ + _constraint_ de exclusão no PostgreSQL (testado com disputas simultâneas).
- **Cabeçalhos de segurança** (CSP, HSTS, X-Frame-Options, etc.), validação Zod em todas as entradas, HTML do editor sanitizado, uploads validados pelo conteúdo real do arquivo, CSV protegido contra injeção de fórmulas.
- **LGPD:** aceite versionado (data, hora, versão, IP), reaceite quando os termos mudam, pedidos de exportação/exclusão, anonimização preservando o prontuário (guarda mínima de 5 anos — CFP), política de privacidade editável.

> ⚠️ Os textos de **Termo de Consentimento, Política de Privacidade e Termos de Uso** são **modelos genéricos**. Peça a revisão de um profissional do direito antes de usar com pacientes reais.

---

## 6. Estrutura

```
prisma/            schema, migrations (inclui travas de integridade) e seed
src/app/           páginas: (public) site · (auth) login/cadastro · paciente/ · admin/ · api/
src/lib/domain/    regras puras testadas: horários disponíveis, prazos, recorrência, preços
src/lib/           banco, criptografia, e-mail, storage, auditoria, PDF, rate limit…
src/server/        casos de uso e Server Actions (sempre autorizados no servidor)
src/emails/        layout React Email
tests/             unit · integration · e2e
docs/              arquitetura, deploy, backup e manual da psicóloga
```

Decisões técnicas e o diagrama ER: [docs/ARQUITETURA.md](docs/ARQUITETURA.md).

---

## 7. Limitações conhecidas (honestidade)

- **Pagamento online (Pix)** não está ligado: o controle é manual. A estrutura (campos no banco e interface `PaymentProvider`) está pronta para Mercado Pago/Asaas.
- O calendário da agenda usa o **fuso do navegador** (esperado: America/Sao_Paulo). O servidor sempre usa America/Sao_Paulo.
- O cron da Vercel Hobby só roda 1×/dia; para lembretes de 2h o projeto inclui um workflow do GitHub Actions (a cada 15 min). Veja [DEPLOY](docs/DEPLOY.md).
