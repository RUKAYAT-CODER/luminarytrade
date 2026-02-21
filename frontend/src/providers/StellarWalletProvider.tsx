/**
 * StellarWalletProvider
 *
 * Implements IWalletProvider for Stellar wallets (Freighter browser extension).
 * Freighter is the most common Stellar browser wallet and exposes window.freighter.
 */

import { BaseWalletProvider } from "./BaseWalletProvider";
import {
  WalletAccount,
  WalletConnectionResult,
  WalletTransaction,
  WalletTransactionResult,
  WalletType,
} from "./IWalletProvider";

// Freighter API shape
declare global {
  interface Window {
    freighter?: {
      isConnected: () => Promise<boolean>;
      getPublicKey: () => Promise<string>;
      signTransaction: (
        xdr: string,
        opts?: { network?: string },
      ) => Promise<string>;
      getNetwork: () => Promise<string>;
    };
  }
}

export class StellarWalletProvider extends BaseWalletProvider {
  readonly walletType: WalletType = "stellar";
  readonly displayName = "Freighter (Stellar)";
  readonly iconUrl =
    "https://assets.website-files.com/5deac75ecad2173c2ccccbc7/5dec8ac60cc0a3c3f1e9e2b7_freighter.svg";

  private _pollInterval: ReturnType<typeof setInterval> | null = null;

  isAvailable(): boolean {
    return typeof window !== "undefined" && !!window.freighter;
  }

  async connect(): Promise<WalletConnectionResult> {
    if (!this.isAvailable()) {
      return {
        success: false,
        error:
          "Freighter wallet is not installed. Please install the Freighter extension.",
      };
    }

    try {
      // Freighter's connect is implicit — requesting the public key triggers the permission prompt
      const publicKey = await window.freighter!.getPublicKey();

      if (!publicKey) {
        return {
          success: false,
          error: "No public key returned from Freighter.",
        };
      }

      const network = await this._getNetwork();

      const account: WalletAccount = {
        address: publicKey,
        publicKey,
        network: "stellar",
      };

      this.setConnected(account);
      this._startPolling();

      return { success: true, account };
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Unknown error connecting to Freighter";
      this.emit({ type: "error", payload: message });
      return { success: false, error: message };
    }
  }

  async disconnect(): Promise<void> {
    this._stopPolling();
    this.setDisconnected();
  }

  async getAccount(): Promise<WalletAccount | null> {
    if (!this.isAvailable()) return null;

    try {
      const connected = await window.freighter!.isConnected();
      if (!connected) return null;

      const publicKey = await window.freighter!.getPublicKey();
      if (!publicKey) return null;

      return {
        address: publicKey,
        publicKey,
        network: "stellar",
      };
    } catch {
      return null;
    }
  }

  async signMessage(message: string): Promise<string> {
    if (!this.currentAccount) throw new Error("Wallet not connected");

    // Freighter signs XDR transactions; for message signing we encode as XDR memo
    // In production you'd use the Stellar SDK to build a proper transaction
    const signature = await window.freighter!.signTransaction(message, {
      network: "TESTNET",
    });

    return signature;
  }

  async sendTransaction(
    tx: WalletTransaction,
  ): Promise<WalletTransactionResult> {
    if (!this.currentAccount) {
      return { success: false, error: "Wallet not connected" };
    }

    try {
      // tx.data should be a valid XDR-encoded Stellar transaction envelope
      if (!tx.data) {
        return {
          success: false,
          error:
            "Stellar transactions require XDR transaction envelope in tx.data",
        };
      }

      const signedXdr = await window.freighter!.signTransaction(tx.data, {
        network: "TESTNET",
      });

      // Caller is responsible for submitting signedXdr to Horizon
      return { success: true, txHash: signedXdr };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Transaction signing failed";
      return { success: false, error: message };
    }
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async _getNetwork(): Promise<string> {
    try {
      return await window.freighter!.getNetwork();
    } catch {
      return "TESTNET";
    }
  }

  /**
   * Freighter doesn't emit native JS events, so we poll to detect disconnection
   * or account changes.
   */
  private _startPolling(): void {
    this._pollInterval = setInterval(async () => {
      try {
        const account = await this.getAccount();
        if (!account && this.isConnected) {
          this.setDisconnected();
          this._stopPolling();
        } else if (
          account &&
          this.currentAccount &&
          account.address !== this.currentAccount.address
        ) {
          this.setAccountChanged(account);
        }
      } catch {
        // Ignore polling errors
      }
    }, 2000);
  }

  private _stopPolling(): void {
    if (this._pollInterval) {
      clearInterval(this._pollInterval);
      this._pollInterval = null;
    }
  }
}
