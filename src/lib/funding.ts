import { decodeEventLog, erc20Abi, type TransactionReceipt, type Hex } from "viem";
import type { RouteExtended } from "@lifi/sdk";

export const FUNDING_CHAIN = 56;
export const FUNDING_TOKEN = "0x55d398326f99059ff775485246999027b3197955";
export const FUNDING_RPC_ERROR = "Your transfer finished, but we couldn’t verify the USDT deposit right now. Check your portfolio balance or try checking the deposit again. You don’t need to exchange again.";
export const INCOMPLETE_FUNDING_ERROR = "This transfer was partial or refunded. Check the transfer details and your portfolio’s withdrawal options. It is not marked as a USDT deposit.";

export class FundingConfirmationError extends Error {}

export function fundingConfirmationMessage(problem: unknown): string {
  return problem instanceof FundingConfirmationError ? problem.message : FUNDING_RPC_ERROR;
}

type ReceiptClient = {
  waitForTransactionReceipt: (parameters: { hash: Hex; confirmations: number; timeout: number }) => Promise<Pick<TransactionReceipt, "status" | "logs">>;
};

export async function verifyFundingDeposit(route: RouteExtended, address: string, client: ReceiptClient): Promise<{ amount: bigint; hash: Hex }> {
  if (!matchesFundingDestination(route, address)) throw new FundingConfirmationError("This transfer does not target this portfolio’s USDT address on BNB Chain.");
  if (hasIncompleteFunding(route)) throw new FundingConfirmationError(INCOMPLETE_FUNDING_ERROR);
  const hashes = fundingTransactionHashes(route);
  if (!hashes.length) throw new FundingConfirmationError("The destination transaction is not available yet. Please check again shortly.");
  let received = 0n;
  let hash: Hex | undefined;
  for (const txHash of hashes) {
    const receipt = await client.waitForTransactionReceipt({ hash: txHash, confirmations: 2, timeout: 60_000 });
    const amount = receivedFunding(receipt, address);
    if (amount > 0n) { received += amount; hash = txHash; }
  }
  if (!hash || received === 0n) throw new FundingConfirmationError("USDT has not been confirmed at this portfolio’s deposit address. Check the transfer details before trying another deposit.");
  return { amount: received, hash };
}

export function matchesFundingDestination(route: RouteExtended, address: string): boolean {
  return route.toChainId === FUNDING_CHAIN && route.toToken.chainId === FUNDING_CHAIN &&
    route.toToken.address.toLowerCase() === FUNDING_TOKEN && route.toAddress?.toLowerCase() === address.toLowerCase();
}

export function hasIncompleteFunding(route: RouteExtended): boolean {
  return route.steps.some((step) => step.execution?.actions.some((action) => action.substatus === "PARTIAL" || action.substatus === "REFUNDED"));
}

export function fundingTransactionHashes(route: RouteExtended): Hex[] {
  return [...new Set(route.steps.flatMap((step) => (step.execution?.actions ?? []).filter((action) =>
    (action.type === "RECEIVING_CHAIN" || action.type === "SWAP") && action.status === "DONE" &&
    (action.chainId ?? step.action.toChainId) === FUNDING_CHAIN && /^0x[\da-f]{64}$/i.test(action.txHash ?? "")
  ).map((action) => action.txHash as Hex)))];
}

/** Verify actual ERC-20 transfers, rather than trusting a route's estimate. */
export function receivedFunding(receipt: Pick<TransactionReceipt, "status" | "logs">, address: string): bigint {
  if (receipt.status !== "success") return 0n;
  let received = 0n;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== FUNDING_TOKEN) continue;
    try {
      const event = decodeEventLog({ abi: erc20Abi, eventName: "Transfer", topics: log.topics, data: log.data });
      if (event.eventName === "Transfer" && event.args.to.toLowerCase() === address.toLowerCase()) received += event.args.value;
    } catch { /* Ignore logs that are not a valid Transfer event. */ }
  }
  return received;
}
