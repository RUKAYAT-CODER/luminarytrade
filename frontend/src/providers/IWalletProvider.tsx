/**
 * IWalletProvider - Core wallet abstraction interface
 *
 * All wallet implementations must conform to this interface.
 * This enables polymorphic usage across MetaMask, Stellar, and future providers.
 */

export type WalletType = "metamask" | "stellar" | "walletconnect" | "coinbase";

export type WalletNetwork = "ethereum" | "stellar" | "polygon" | "unknown";

export interface WalletAccount {
  address: string;
  publicKey?: string;
  network: WalletNetwork;
  balance?: string;
}

export interface WalletConnectionResult {
  success: boolean;
  account?: WalletAccount;
  error?: string;
}

export interface WalletTransaction {
  to: string;
  amount: string;
  data?: string;
}

export interface WalletTransactionResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

// Event types for wallet lifecycle
export type WalletEventType =
  | "connected"
  | "disconnected"
  | "accountChanged"
  | "networkChanged"
  | "error";

export interface WalletEvent {
  type: WalletEventType;
  payload?: unknown;
}

export type WalletEventHandler = (event: WalletEvent) => void;

/**
 * IWalletProvider
 * Standard operations every wallet provider must implement.
 */
export interface IWalletProvider {
  /** Unique identifier for this wallet type */
  readonly walletType: WalletType;

  /** Human-readable name shown in UI */
  readonly displayName: string;

  /** Icon path or URL */
  readonly iconUrl: string;

  /** Current connection state */
  isConnected: boolean;

  /** Currently connected account, if any */
  currentAccount: WalletAccount | null;

  /**
   * Check if the wallet extension/app is available in the current environment.
   */
  isAvailable(): boolean;

  /**
   * Initiate wallet connection. Prompts user for permission.
   */
  connect(): Promise<WalletConnectionResult>;

  /**
   * Disconnect wallet and clear state.
   */
  disconnect(): Promise<void>;

  /**
   * Get the current account details.
   */
  getAccount(): Promise<WalletAccount | null>;

  /**
   * Sign a message (for authentication purposes).
   */
  signMessage(message: string): Promise<string>;

  /**
   * Send a transaction.
   */
  sendTransaction(tx: WalletTransaction): Promise<WalletTransactionResult>;

  /**
   * Register an event handler for wallet lifecycle events.
   */
  on(event: WalletEventType, handler: WalletEventHandler): void;

  /**
   * Remove a previously registered event handler.
   */
  off(event: WalletEventType, handler: WalletEventHandler): void;
}
