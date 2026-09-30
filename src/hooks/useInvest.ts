// Enrolls the connected wallet into a strategy's portfolio engine portfolio.
//
//   1. POST /v1/invest/prepare — the backend creates the portfolio engine strategy for
//      (template, params, chain) if nobody holds it yet, from a fresh, gated
//      backtest target. If this wallet already has that portfolio it comes
//      straight back and nothing is signed.
//   2. The wallet signs the portfolio engine's 32-byte digest with EIP-191 personal_sign.
//      This authorises a session key on a smart account the user owns; it
//      moves no funds.
//   3. POST /v1/invest/confirm — the portfolio engine creates the portfolio; the backend
//      records it and starts automation.

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useConnection, useSignMessage, useSwitchChain } from "wagmi";
import { api, type Params, type Portfolio, type Template } from "@/api/client";
import { friendlyError } from "@/lib/errors";
import { showToast } from "@/lib/toast";
import { keys } from "./queries";

export type InvestStep = "idle" | "preparing" | "switching" | "signing" | "confirming";

export function useInvest() {
  const { address, chainId: walletChainId } = useConnection();
  const { mutateAsync: switchChain } = useSwitchChain();
  const { mutateAsync: signMessage } = useSignMessage();
  const qc = useQueryClient();
  const [step, setStep] = useState<InvestStep>("idle");
  const [error, setError] = useState<string | null>(null);

  const invest = useCallback(
    async (template: Template, params: Params, chainId: number): Promise<Portfolio | null> => {
      if (!address) {
        setError("Sign in first.");
        return null;
      }
      setError(null);
      const base = { templateId: template.id, params, chainId, owner: address };
      try {
        setStep("preparing");
        const prep = await api.prepareInvest(base);
        if (prep.status === "existing" && prep.portfolio) {
          return prep.portfolio;
        }
        const e = prep.enrollment;
        if (!e) throw new Error("The server returned no enrollment to sign.");

        if (walletChainId !== chainId) {
          setStep("switching");
          await switchChain({ chainId });
        }
        setStep("signing");
        const signature = await signMessage({ message: { raw: e.message.raw } });

        setStep("confirming");
        const portfolio = await api.confirmInvest({
          ...base,
          strategyId: e.strategyId,
          chainIds: e.chainIds,
          flowId: e.flowId,
          accountIndex: e.accountIndex,
          agentAccountId: e.agentAccountId,
          accountType: e.accountType,
          signature,
        });
        await qc.invalidateQueries({ queryKey: keys.portfolios(address) });
        showToast({ variant: "success", title: "Portfolio created", body: "Fund it to start investing." });
        return portfolio;
      } catch (err) {
        setError(friendlyError(err));
        return null;
      } finally {
        setStep("idle");
      }
    },
    [address, walletChainId, switchChain, signMessage, qc],
  );

  return { invest, step, error, clearError: () => setError(null) };
}
