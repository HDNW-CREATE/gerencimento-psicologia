# Backup e restauração

## O que é salvo

- **Banco de dados PostgreSQL** (cadastros, agenda, financeiro, prontuário _criptografado_, auditoria): backup automático diário pelo GitHub Actions (`.github/workflows/backup.yml`), criptografado com AES-256 (GPG) e guardado em bucket S3 privado por 30 dias.
- **Documentos enviados** (PDFs/imagens): ficam no bucket de documentos. Ative o _versionamento_ do bucket (R2/S3) e, se quiser, replique-o periodicamente (`rclone sync`).

## O que NÃO pode faltar para restaurar

| Item                      | Onde guardar                                                                                         |
| ------------------------- | ---------------------------------------------------------------------------------------------------- |
| `CLINICAL_ENCRYPTION_KEY` | gerenciador de senhas + cópia impressa em local seguro. **Sem ela o prontuário do backup não abre.** |
| `BACKUP_PASSPHRASE`       | gerenciador de senhas                                                                                |
| Credenciais do bucket     | gerenciador de senhas                                                                                |

## Restaurar um backup

Requisitos: cliente PostgreSQL 17 (`pg_restore`), `gpg` e `aws` CLI.

```bash
# 1) Baixe o arquivo desejado
aws s3 ls s3://SEU_BUCKET_BACKUPS/backups/ --endpoint-url https://SEU_ENDPOINT
aws s3 cp s3://SEU_BUCKET_BACKUPS/backups/consultorio-20261105-0630.dump.gpg . --endpoint-url https://SEU_ENDPOINT

# 2) Descriptografe (será pedida a BACKUP_PASSPHRASE)
gpg --output consultorio.dump --decrypt consultorio-20261105-0630.dump.gpg

# 3) Crie um banco VAZIO (novo projeto Neon, por exemplo) e restaure nele
pg_restore --no-owner --no-privileges --clean --if-exists \
  --dbname "postgresql://USUARIO:SENHA@HOST/NOME_DO_BANCO?sslmode=require" consultorio.dump

# 4) Aponte DATABASE_URL (Vercel) para o banco restaurado e faça Redeploy
#    Mantenha a MESMA CLINICAL_ENCRYPTION_KEY de antes.
```

### Teste de restauração (faça a cada 3 meses)

1. Restaure o último backup em um banco **temporário**.
2. Rode localmente com `DATABASE_URL` apontando para ele e a chave de criptografia de produção.
3. Entre como ADMIN e abra um prontuário: se o texto aparece, o backup e a chave estão corretos.

## Backup manual rápido

```bash
pg_dump --format=custom --no-owner "postgresql://...conexão direta..." > consultorio-$(date +%Y%m%d).dump
```

## Retenção legal

O prontuário psicológico deve ser guardado por, no mínimo, **5 anos** (normas do CFP). Mantenha ao menos um backup anual arquivado além da retenção de 30 dias do workflow (copie manualmente um dump por ano para um local seguro).
