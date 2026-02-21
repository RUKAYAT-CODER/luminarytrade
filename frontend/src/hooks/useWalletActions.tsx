/**
 * useWalletActions
 *
 * Convenience hook that wraps useWallet with higher-level operations
 * like sign-in-with-wallet and formatted account display.
 */

import { useCallback } from "react";
import { useWallet } from "../WalletContent";
import {
  WalletTransaction,
  WalletTransactionResult,
} from "../providers/IWalletProvider";

export function useWalletActions() {
  const wallet = useWallet();

  /**
   * Returns a shortened, display-friendly version of the wallet address.
   * e.g. "0x1234...abcd"
   */
  const shortAddress = wallet.account
    ? `${wallet.account.address.slice(0, 6)}...${wallet.account.address.slice(-4)}`
    : null;

  /**
   * Sign a challenge message for wallet-based authentication.
   */
  const signAuthChallenge = useCallback(
    async (challenge: string): Promise<string | null> => {
      if (!wallet.activeProvider || !wallet.isConnected) {
        return null;
      }
      try {
        return await wallet.activeProvider.signMessage(challenge);
      } catch {
        return null;
      }
    },
    [wallet.activeProvider, wallet.isConnected],
  );

  /**
   * Send a transaction using the currently connected wallet.
   */
  const sendTransaction = useCallback(
    async (tx: WalletTransaction): Promise<WalletTransactionResult> => {
      if (!wallet.activeProvider || !wallet.isConnected) {
        return { success: false, error: "No wallet connected" };
      }
      return wallet.activeProvider.sendTransaction(tx);
    },
    [wallet.activeProvider, wallet.isConnected],
  );

  return {
    ...wallet,
    shortAddress,
    signAuthChallenge,
    sendTransaction,
  };
}
