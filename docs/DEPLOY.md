# Deploy passo a passo (Vercel + Neon/Supabase)

Tempo estimado: 40–60 minutos. Custo inicial: gratuito (planos _free_), exceto o domínio.

## Visão geral

1. Banco PostgreSQL (Neon **ou** Supabase)
2. Armazenamento de arquivos privado (Cloudflare R2 **ou** Supabase Storage)
3. E-mail (Resend) + domínio verificado (SPF/DKIM)
4. Código no GitHub → projeto na Vercel
5. Migrations, conta ADMIN e agendador de lembretes
6. Domínio próprio e verificações finais

---

## 1. Banco de dados

### Opção A — Neon (recomendado)

1. Crie conta em <https://neon.tech> → **New Project** (região: `South America (São Paulo)` se disponível).
2. Copie **duas** strings de conexão:
   - **Pooled** (host com `-pooler`): vai em `DATABASE_URL` na Vercel.
   - **Direct** (sem `-pooler`): use para rodar as migrations (passo 5).
3. Ambas terminam com `?sslmode=require`.

### Opção B — Supabase

Project Settings → Database → _Connection string_: use **Transaction pooler** (porta 6543) para o app, acrescentando `?pgbouncer=true&sslmode=require`, e a conexão **direta** (porta 5432) para as migrations.

## 2. Armazenamento de documentos (bucket PRIVADO)

### Cloudflare R2

1. Painel Cloudflare → R2 → **Create bucket** (ex.: `consultorio-docs`) — mantenha **privado**.
2. R2 → _Manage R2 API Tokens_ → crie um token com permissão _Object Read & Write_ para esse bucket.
3. Anote: endpoint (`https://<ACCOUNT_ID>.r2.cloudflarestorage.com`), Access Key ID e Secret.
4. Variáveis: `STORAGE_DRIVER=s3`, `S3_ENDPOINT`, `S3_REGION=auto`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`.

Os downloads usam URLs assinadas de 60 segundos, geradas só depois da checagem de permissão. Crie **outro** bucket privado para os backups (passo 7).

## 3. E-mail com Resend (SPF/DKIM)

1. Conta em <https://resend.com> → **Domains → Add Domain** (ex.: `seudominio.com.br`).
2. O Resend mostra registros DNS (**SPF** e **DKIM**, e opcionalmente DMARC). Adicione-os no painel do seu registrador (Registro.br, Cloudflare etc.):

   | Tipo  | Nome                               | Valor                                                    |
   | ----- | ---------------------------------- | -------------------------------------------------------- |
   | `TXT` | `send` (ou o que o Resend indicar) | `v=spf1 include:amazonses.com ~all`                      |
   | `MX`  | `send`                             | o valor indicado pelo Resend                             |
   | `TXT` | `resend._domainkey`                | a chave DKIM longa indicada                              |
   | `TXT` | `_dmarc`                           | `v=DMARC1; p=none; rua=mailto:contato@seudominio.com.br` |

   > Use **exatamente** os valores exibidos no seu painel Resend (podem variar). A verificação leva de minutos a algumas horas.

3. **API Keys → Create API Key** (permissão _Sending access_) → `RESEND_API_KEY`.
4. `EMAIL_FROM="Nome do Consultório <contato@seudominio.com.br>"` (o domínio precisa estar verificado).

## 4. Código no GitHub e projeto na Vercel

1. Crie um repositório **privado** no GitHub e envie o código (`git init`, `git add .`, `git commit`, `git push`). O arquivo `.env` **não** vai (está no `.gitignore`).
2. Em <https://vercel.com> → **Add New → Project** → importe o repositório. Framework: Next.js (detectado).
3. Em **Settings → Environment Variables**, cadastre (ambiente _Production_):

   | Variável                                             | Valor                                                                        |
   | ---------------------------------------------------- | ---------------------------------------------------------------------------- |
   | `DATABASE_URL`                                       | string **pooled** do banco                                                   |
   | `NEXT_PUBLIC_APP_URL`                                | `https://seudominio.com.br`                                                  |
   | `AUTH_SECRET`                                        | `npm run gen:key`                                                            |
   | `AUTH_TRUST_HOST`                                    | `true`                                                                       |
   | `CLINICAL_ENCRYPTION_KEY`                            | `npm run gen:key` — **guarde cópia em local seguro (gerenciador de senhas)** |
   | `CRON_SECRET`                                        | texto longo e aleatório                                                      |
   | `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_ADMIN_NOTIFY` | do passo 3                                                                   |
   | `STORAGE_DRIVER`, `S3_*`                             | do passo 2                                                                   |

   > 🔑 **A `CLINICAL_ENCRYPTION_KEY` não pode ser trocada depois que houver prontuários.** Se for perdida, o conteúdo criptografado é irrecuperável.

4. **Deploy.** O build roda `prisma generate && next build`.

## 5. Migrations e conta ADMIN (uma vez)

No seu computador, com o `.env` apontando para o banco de **produção** (use a string **direta**):

```bash
npm install
npm run db:deploy                      # cria as tabelas (prisma migrate deploy)
npm run db:seed                        # termos, modelos de e-mail, serviços e horários padrão (SEED_DEMO_DATA deve ser "false")
npm run admin:create -- --email=voce@seudominio.com.br --name="Dra. Fulana" --password="UmaSenhaForte123"
```

Entre em `https://seudominio.com.br/entrar` e **revise tudo em Configurações** (dados profissionais, horários, serviços, termos, site).

> A cada nova versão do sistema com mudança de banco, rode `npm run db:deploy` antes do deploy.

## 6. Lembretes automáticos (cron a cada 15 min)

O plano gratuito da Vercel só permite cron **diário**; para lembretes de 2h antes, use o GitHub Actions (grátis), já incluso em `.github/workflows/cron-reminders.yml`:

1. No GitHub: **Settings → Secrets and variables → Actions → New repository secret**:
   - `APP_URL` = `https://seudominio.com.br`
   - `CRON_SECRET` = o mesmo valor da Vercel
2. **Actions → Lembretes automáticos → Run workflow** para testar. A resposta deve ser `200` com `{"ok":true,...}`.

(Alternativa: plano Vercel Pro permite alterar `vercel.json` para `*/15 * * * *`.)

## 7. Backup automático

1. Crie um segundo bucket **privado** (ex.: `consultorio-backups`) com credenciais próprias.
2. Em _Secrets_ do GitHub, cadastre: `BACKUP_DATABASE_URL` (string **direta**), `BACKUP_PASSPHRASE` (frase longa — **guarde-a!**), `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`.
3. O workflow `backup.yml` roda todo dia às 03:30, gera `pg_dump` **criptografado** e mantém 30 dias. Teste com **Run workflow**.
4. Como restaurar: [BACKUP.md](BACKUP.md). **Teste a restauração ao menos uma vez.**

Neon/Supabase também mantêm backups/PITR próprios (confira o prazo no seu plano).

## 8. Domínio próprio

1. Vercel → **Settings → Domains → Add** → `seudominio.com.br` (e `www`).
2. Configure no registrador o `A`/`CNAME` indicado pela Vercel. O HTTPS é emitido automaticamente.
3. Atualize `NEXT_PUBLIC_APP_URL` (e o secret `APP_URL`) para o domínio final e faça **Redeploy**.

## 9. Checklist final

- [ ] Login ADMIN funciona; troque a senha inicial.
- [ ] Cadastro de um paciente de teste: e-mail de confirmação chega (olhe o spam) e o link funciona.
- [ ] Agendamento → e-mail para a paciente **e** para a psicóloga; arquivo `.ics` anexado na confirmação.
- [ ] Prontuário: salvar uma evolução e exportar o PDF.
- [ ] Recibo em PDF após marcar um pagamento como "Pago".
- [ ] Workflow de lembretes retorna 200.
- [ ] Backup rodou e você consegue listar o arquivo no bucket.
- [ ] Remova os dados de demonstração (não rode o seed com `SEED_DEMO_DATA=true` em produção).
- [ ] Textos legais revisados por um(a) advogado(a).
- [ ] <https://securityheaders.com> com a nota A/A+.

## Solução de problemas

| Sintoma                           | Causa provável                                                                         |
| --------------------------------- | -------------------------------------------------------------------------------------- |
| `Variáveis de ambiente inválidas` | falta/erro em `AUTH_SECRET` ou `CLINICAL_ENCRYPTION_KEY` (deve ser base64 de 32 bytes) |
| E-mails não chegam                | domínio não verificado no Resend, `EMAIL_FROM` com domínio diferente, ou caiu no spam  |
| Erro de conexão no build/migrate  | usando string _pooled_ para migrations — use a **direta**                              |
| Lembretes não saem                | secrets do GitHub incorretos (rode o workflow manualmente e veja a resposta)           |
| Falha ao enviar documento         | credenciais/endpoint S3 incorretos ou bucket inexistente                               |
