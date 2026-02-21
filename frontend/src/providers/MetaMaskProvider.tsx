// src/providers/MetaMaskProvider.ts

import { BaseWalletProvider } from "./BaseWalletProvider";
import {
  WalletAccount,
  WalletConnectionResult,
  WalletTransaction,
  WalletTransactionResult,
  WalletType,
} from "./IWalletProvider";

declare global {
  interface Window {
    ethereum?: {
      isMetaMask?: boolean;
      request: (args: {
        method: string;
        params?: unknown[];
      }) => Promise<unknown>;
      on: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener: (
        event: string,
        handler: (...args: unknown[]) => void,
      ) => void;
    };
  }
}

export class MetaMaskProvider extends BaseWalletProvider {
  readonly walletType: WalletType = "metamask";
  readonly displayName = "MetaMask";
  readonly iconUrl =
    "https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg";

  private _accountChangeHandler: (accounts: unknown) => void;
  private _chainChangeHandler: (chainId: unknown) => void;
  private _disconnectHandler: () => void;

  constructor() {
    super();

    this._accountChangeHandler = (accounts: unknown) => {
      const accs = accounts as string[];
      if (!accs || accs.length === 0) {
        this.setDisconnected();
      } else {
        this.setAccountChanged({ address: accs[0], network: "ethereum" });
      }
    };

    this._chainChangeHandler = (_chainId: unknown) => {
      this.setNetworkChanged("ethereum");
    };

    this._disconnectHandler = () => {
      this.setDisconnected();
    };
  }

  isAvailable(): boolean {
    return typeof window !== "undefined" && !!window.ethereum?.isMetaMask;
  }

  async connect(): Promise<WalletConnectionResult> {
    if (!this.isAvailable()) {
      return {
        success: false,
        error:
          "MetaMask is not installed. Please install the MetaMask extension.",
      };
    }

    try {
      const accounts = (await window.ethereum!.request({
        method: "eth_requestAccounts",
      })) as string[];

      if (!accounts || accounts.length === 0) {
        return { success: false, error: "No accounts returned from MetaMask." };
      }

      const account: WalletAccount = {
        address: accounts[0],
        network: "ethereum",
      };

      window.ethereum!.on("accountsChanged", this._accountChangeHandler);
      window.ethereum!.on("chainChanged", this._chainChangeHandler);
      window.ethereum!.on("disconnect", this._disconnectHandler);

      this.setConnected(account);
      return { success: true, account };
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Unknown error connecting to MetaMask";
      this.emit({ type: "error", payload: message });
      return { success: false, error: message };
    }
  }

  async disconnect(): Promise<void> {
    window.ethereum?.removeListener(
      "accountsChanged",
      this._accountChangeHandler,
    );
    window.ethereum?.removeListener("chainChanged", this._chainChangeHandler);
    window.ethereum?.removeListener("disconnect", this._disconnectHandler);
    this.setDisconnected();
  }

  async getAccount(): Promise<WalletAccount | null> {
    if (!this.isAvailable()) return null;

    try {
      const accounts = (await window.ethereum!.request({
        method: "eth_accounts",
      })) as string[];

      if (!accounts || accounts.length === 0) return null;
      return { address: accounts[0], network: "ethereum" };
    } catch {
      return null;
    }
  }

  async signMessage(message: string): Promise<string> {
    if (!this.currentAccount) throw new Error("Wallet not connected");

    const signature = await window.ethereum!.request({
      method: "personal_sign",
      params: [message, this.currentAccount.address],
    });

    return signature as string;
  }

  async sendTransaction(
    tx: WalletTransaction,
  ): Promise<WalletTransactionResult> {
    if (!this.currentAccount) {
      return { success: false, error: "Wallet not connected" };
    }

    try {
      const txHash = await window.ethereum!.request({
        method: "eth_sendTransaction",
        params: [
          {
            from: this.currentAccount.address,
            to: tx.to,
            value: tx.amount,
            data: tx.data,
          },
        ],
      });

      return { success: true, txHash: txHash as string };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Transaction failed";
      return { success: false, error: message };
    }
  }
}
