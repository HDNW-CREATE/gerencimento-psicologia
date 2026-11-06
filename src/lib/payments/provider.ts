/**
 * Preparação para pagamento online (Pix) – NÃO está ligado ao fluxo atual (controle manual).
 *
 * Para integrar Mercado Pago ou Asaas no futuro:
 *  1. Implemente `PaymentProvider` em um novo arquivo (ex.: `asaas.ts`), usando as chaves em variáveis de ambiente.
 *  2. Ao criar a cobrança, grave em `Payment`: provider, externalId, pixCopyPaste e pixExpiresAt (campos já existem).
 *  3. Crie `/api/webhooks/<provedor>` que valida a assinatura do provedor e chama `markPaidFromProvider`
 *     (sempre idempotente: o mesmo evento pode chegar mais de uma vez).
 *  4. Na tela do paciente (Financeiro) exiba o QR/“copia e cola” para pagamentos PENDENTE com `pixCopyPaste`.
 */
export interface CreateChargeInput {
  paymentId: string;
  amountCents: number;
  description: string;
  payer: { name: string; email?: string | null; cpf?: string | null };
  dueDate?: Date;
}

export interface Charge {
  externalId: string;
  pixCopyPaste: string;
  expiresAt?: Date;
}

export interface WebhookEvent {
  externalId: string;
  status: 'PAID' | 'EXPIRED' | 'CANCELLED';
  paidAt?: Date;
  amountCents?: number;
}

export interface PaymentProvider {
  readonly name: 'mercadopago' | 'asaas';
  createPixCharge(input: CreateChargeInput): Promise<Charge>;
  /** Valida a assinatura do webhook e devolve o evento normalizado (ou lança erro se inválido). */
  parseWebhook(headers: Headers, rawBody: string): Promise<WebhookEvent>;
}
