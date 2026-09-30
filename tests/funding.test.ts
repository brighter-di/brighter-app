import { strict as assert } from "node:assert";
import { test } from "node:test";
import { encodeAbiParameters, encodeEventTopics, erc20Abi, formatUnits, type TransactionReceipt } from "viem";
import type { RouteExtended } from "@lifi/sdk";
import { FUNDING_RPC_ERROR, FUNDING_TOKEN, fundingConfirmationMessage, fundingTransactionHashes, hasIncompleteFunding, matchesFundingDestination, receivedFunding, verifyFundingDeposit } from "../src/lib/funding.ts";

const recipient = "0x0000000000000000000000000000000000000001";
const other = "0x0000000000000000000000000000000000000002";
const hash = `0x${"a".repeat(64)}`;
const route = (overrides: object = {}): RouteExtended => ({
  id: "test", toChainId: 56, toToken: { address: FUNDING_TOKEN, chainId: 56 }, toAddress: recipient,
  steps: [{ action: { toChainId: 56 }, execution: { actions: [{ type: "RECEIVING_CHAIN", status: "DONE", chainId: 56, txHash: hash }] } }],
  ...overrides,
}) as RouteExtended;
const transfer = (address = FUNDING_TOKEN, to = recipient, amount = 10n ** 18n) => ({
  address, topics: encodeEventTopics({ abi: erc20Abi, eventName: "Transfer", args: { from: other, to: to as `0x${string}` } }),
  data: encodeAbiParameters([{ type: "uint256" }], [amount]),
}) as TransactionReceipt["logs"][number];

test("funding accepts only the fixed BNB USDT destination and recipient", () => {
  assert.equal(matchesFundingDestination(route(), recipient.toUpperCase()), true);
  for (const wrong of [route({ toChainId: 1 }), route({ toAddress: other }), route({ toAddress: undefined }), route({ toToken: { address: other, chainId: 56 } }), route({ toToken: { address: FUNDING_TOKEN, chainId: 1 } })]) {
    assert.equal(matchesFundingDestination(wrong, recipient), false);
  }
});
test("only successful USDT Transfer logs to the portfolio prove a deposit, using 18 decimals", () => {
  const receipt = { status: "success" as const, logs: [transfer(), transfer(FUNDING_TOKEN, recipient, 2n * 10n ** 18n), transfer(other), transfer(FUNDING_TOKEN, other), { ...transfer(), data: "0x" as const }] };
  assert.equal(formatUnits(receivedFunding(receipt, recipient), 18), "3");
  assert.equal(receivedFunding({ ...receipt, status: "reverted" }, recipient), 0n);
});
test("partial and refunded routes are never marked as completed funding", () => {
  assert.equal(hasIncompleteFunding(route()), false);
  for (const substatus of ["PARTIAL", "REFUNDED"]) {
    assert.equal(hasIncompleteFunding(route({ steps: [{ execution: { actions: [{ substatus }] } }] })), true);
  }
});
test("destination receipt hashes exclude source, approvals, pending and invalid hashes and are deduplicated", () => {
  const action = { type: "RECEIVING_CHAIN", status: "DONE", chainId: 56, txHash: hash };
  const actions = [action, action, { ...action, type: "SWAP" }, { ...action, chainId: 1 }, { ...action, status: "PENDING" }, { ...action, type: "SET_ALLOWANCE" }, { ...action, txHash: "invalid" }];
  assert.deepEqual(fundingTransactionHashes(route({ steps: [{ action: { toChainId: 56 }, execution: { actions } }] })), [hash]);
  assert.deepEqual(fundingTransactionHashes(route({ steps: [{ action: { toChainId: 56 } }] })), []);
});

test("completed funding requires receipt proof and two confirmations, and rejects wrong recipients", async () => {
  const parameters: unknown[] = [];
  const client = { waitForTransactionReceipt: async (input: unknown) => {
    parameters.push(input);
    return { status: "success" as const, logs: [transfer()] };
  } };
  assert.deepEqual(await verifyFundingDeposit(route(), recipient, client), { hash, amount: 10n ** 18n });
  assert.deepEqual(parameters, [{ hash, confirmations: 2, timeout: 60_000 }]);
  await assert.rejects(verifyFundingDeposit(route(), recipient, { waitForTransactionReceipt: async () => ({ status: "success", logs: [transfer(FUNDING_TOKEN, other)] }) }), /USDT has not been confirmed/);
  await assert.rejects(verifyFundingDeposit(route({ toAddress: other }), recipient, client), /does not target/);
});
test("RPC archive restrictions do not leak diagnostic dumps or claim an exchange failed", async () => {
  const problem = new Error('Invalid parameters. URL: https://rpc.example/private-token Archive requests require a personal token');
  let error: unknown;
  try { await verifyFundingDeposit(route(), recipient, { waitForTransactionReceipt: async () => { throw problem; } }); } catch (caught) { error = caught; }
  assert.equal(fundingConfirmationMessage(error), FUNDING_RPC_ERROR);
  assert.equal(fundingConfirmationMessage(error).includes('private-token'), false);
});
