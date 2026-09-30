// Telling the backend how a deposit ended, so it can reach Telegram.
//
// Kept apart from lib/deposit.ts, which is pure and tested without a browser.
// A success is reported as a transaction hash alone: the backend reads the
// amount, the token and the payer off the chain itself, so nothing a page
// claims is taken on trust. A failure cannot be checked against anything and
// reaches operators only.

import { api } from "@/api/client";

export type DepositReport =
  | { status: "succeeded"; txHash: string }
  | { status: "failed"; reason: string };

/**
 * Nothing here is worth interrupting the reader for: a success is already on
 * the chain whether or not the report lands, and a failure is already on the
 * screen. So this never throws and never blocks — it is a message, not a step
 * in the deposit.
 */
export function announceDeposit(portfolioId: string, report: DepositReport): void {
  void api.reportDeposit(portfolioId, report).catch(() => undefined);
}
