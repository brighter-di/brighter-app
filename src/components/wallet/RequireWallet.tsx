import type { FC, ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useConnection, useConnections } from "wagmi";

/**
 * Pages that act for a signed-in wallet (deposit, withdraw) send a signed-out
 * visitor to the strategies. On a reload wagmi starts out "disconnected" with
 * the saved connections restored, then reconnects; only once no connection is
 * left is the visitor really signed out.
 */
export const RequireWallet: FC<{ children: ReactNode }> = ({ children }) => {
  const { status } = useConnection();
  const connections = useConnections();
  if (status === "disconnected" && connections.length === 0) return <Navigate to="/strategies" replace />;
  return <>{children}</>;
};
