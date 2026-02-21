/**
 * BaseWalletProvider
 *
 * Abstract base class providing shared event-emitter infrastructure
 * for all wallet provider implementations.
 */

import {
  IWalletProvider,
  WalletAccount,
  WalletConnectionResult,
  WalletEvent,
  WalletEventHandler,
  WalletEventType,
  WalletNetwork,
  WalletTransaction,
  WalletTransactionResult,
  WalletType,
} from "./IWalletProvider";

export abstract class BaseWalletProvider implements IWalletProvider {
  abstract readonly walletType: WalletType;
  abstract readonly displayName: string;
  abstract readonly iconUrl: string;

  isConnected: boolean = false;
  currentAccount: WalletAccount | null = null;

  private _listeners: Map<WalletEventType, Set<WalletEventHandler>> = new Map();

  // ─── Event Emitter ────────────────────────────────────────────────────────

  on(event: WalletEventType, handler: WalletEventHandler): void {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event)!.add(handler);
  }

  off(event: WalletEventType, handler: WalletEventHandler): void {
    this._listeners.get(event)?.delete(handler);
  }

  protected emit(event: WalletEvent): void {
    this._listeners.get(event.type)?.forEach((handler) => {
      try {
        handler(event);
      } catch (err) {
        console.error(`[${this.walletType}] Event handler error:`, err);
      }
    });
  }

  protected setConnected(account: WalletAccount): void {
    this.isConnected = true;
    this.currentAccount = account;
    this.emit({ type: "connected", payload: account });
  }

  protected setDisconnected(): void {
    this.isConnected = false;
    this.currentAccount = null;
    this.emit({ type: "disconnected" });
  }

  protected setAccountChanged(account: WalletAccount): void {
    this.currentAccount = account;
    this.emit({ type: "accountChanged", payload: account });
  }

  protected setNetworkChanged(network: WalletNetwork): void {
    this.emit({ type: "networkChanged", payload: network });
  }

  // ─── Abstract Methods ─────────────────────────────────────────────────────

  abstract isAvailable(): boolean;
  abstract connect(): Promise<WalletConnectionResult>;
  abstract disconnect(): Promise<void>;
  abstract getAccount(): Promise<WalletAccount | null>;
  abstract signMessage(message: string): Promise<string>;
  abstract sendTransaction(
    tx: WalletTransaction,
  ): Promise<WalletTransactionResult>;
}
