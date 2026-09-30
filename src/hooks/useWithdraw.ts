// Takes money out of a portfolio. Two stages, both owner-signed:
//
//   1. POST …/withdraw/signature — the portfolio engine returns EIP-712 typed data binding
//      the portfolio, the recipient (always the owner's own address on the
//      portfolio's chain), the assets, a nonce and a 10-minute expiry.
//   2. The wallet signs it (eth_signTypedData_v4) and the backend submits the
//      signature with the portfolio engine's message echoed back verbatim.
//
// "liquidate" sells every holding into the chain's cash asset first — Ondo
// redeems in USDT on BNB Chain and USDC on Ethereum. "withdraw" sends the
// tokens as they are.

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useConnection, useSignTypedData, useSwitchChain } from "wagmi";
import { api, type Hex, type Portfolio, type TypedData, type WithdrawMode } from "@/api/client";
import { friendlyError } from "@/lib/errors";
import { recordOperation } from "@/lib/ops";
import { keys } from "./queries";

type Asset = { assetId: string; amountRaw: string };

export function useWithdraw() {
  const { chainId: walletChainId } = useConnection();
  const { mutateAsync: switchChain } = useSwitchChain();
  const { mutateAsync: signTypedData } = useSignTypedData();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const withdraw = useCallback(
    async (portfolio: Portfolio, mode: WithdrawMode, assets?: Asset[]): Promise<string | null> => {
      setBusy(true);
      setError(null);
      try {
        const auth = await api.withdrawSignature(portfolio.portfolioId, { mode, assets });
        if (!auth.typedData) throw new Error("The trading service returned no authorization to sign.");
        if (walletChainId !== portfolio.chainId) {
          // The smart account verifies the signature against the chain it
          // lives on; signing on another chain would not recover the owner.
          await switchChain({ chainId: portfolio.chainId });
        }
        const { domain, types, primaryType, message } = auth.typedData;
        const signature = await signTypedData({
          domain,
          types: withoutDomainType(types),
          primaryType,
          message: coerceIntegers(types, primaryType, message),
        } as Parameters<typeof signTypedData>[0]);

        const op = await api.withdraw(portfolio.portfolioId, { mode, message, signature: signature as Hex });
        recordOperation({
          operationId: op.operationId,
          portfolioId: portfolio.portfolioId,
          label: mode === "liquidate" ? `Sell ${portfolio.templateName}` : `Withdraw ${portfolio.templateName}`,
          submittedAt: op.submittedAt ?? new Date().toISOString(),
        });
        await qc.invalidateQueries({ queryKey: keys.positions(portfolio.portfolioId) });
        return op.operationId;
      } catch (err) {
        setError(friendlyError(err));
        return null;
      } finally {
        setBusy(false);
      }
    },
    [walletChainId, switchChain, signTypedData, qc],
  );

  return { withdraw, busy, error, clearError: () => setError(null) };
}

// Wallet libraries add EIP712Domain themselves and reject a duplicate.
function withoutDomainType(types: TypedData["types"]): TypedData["types"] {
  return Object.fromEntries(Object.entries(types).filter(([k]) => k !== "EIP712Domain"));
}

// The portfolio engine serialises uint256 values as decimal strings; the signer needs them
// as bigints. Only fields the schema declares as integers are converted, so
// what is signed is exactly what the portfolio engine hashes. The original message is what
// gets echoed back to the server.
function coerceIntegers(types: TypedData["types"], typeName: string, value: Record<string, unknown>): Record<string, unknown> {
  const fields = types[typeName];
  if (!fields) return value;
  const out: Record<string, unknown> = { ...value };
  for (const f of fields) {
    out[f.name] = coerceValue(types, f.type, value[f.name]);
  }
  return out;
}

function coerceValue(types: TypedData["types"], type: string, v: unknown): unknown {
  if (type.endsWith("[]")) {
    const inner = type.slice(0, -2);
    return Array.isArray(v) ? v.map((x) => coerceValue(types, inner, x)) : v;
  }
  if (/^u?int\d*$/.test(type) && (typeof v === "string" || typeof v === "number")) {
    try {
      return BigInt(v);
    } catch {
      return v;
    }
  }
  if (types[type] && v && typeof v === "object") {
    return coerceIntegers(types, type, v as Record<string, unknown>);
  }
  return v;
}
