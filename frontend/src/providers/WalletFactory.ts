/**
 * WalletFactory
 *
 * Central registry and factory for wallet providers.
 * - Registers known providers
 * - Returns providers by WalletType
 * - Lists all available providers (those whose extension is installed)
 * - Easy to extend: call WalletFactory.register() to add new providers
 */

import { StellarWalletProvider } from "../providers/StellarWalletProvider";
import { IWalletProvider, WalletType } from "./IWalletProvider";
import { MetaMaskProvider } from "./MetaMaskProvider";

type ProviderConstructor = new () => IWalletProvider;

class WalletFactoryClass {
  private _registry: Map<WalletType, ProviderConstructor> = new Map();

  constructor() {
    // Register built-in providers
    this.register("metamask", MetaMaskProvider);
    this.register("stellar", StellarWalletProvider);
  }

  /**
   * Register a new wallet provider constructor.
   * Call this to add new wallets without modifying existing code.
   */
  register(type: WalletType, ctor: ProviderConstructor): void {
    this._registry.set(type, ctor);
  }

  /**
   * Create a fresh instance of a specific wallet provider.
   */
  create(type: WalletType): IWalletProvider {
    const Ctor = this._registry.get(type);
    if (!Ctor) {
      throw new Error(`No wallet provider registered for type: "${type}"`);
    }
    return new Ctor();
  }

  /**
   * Get all registered wallet types.
   */
  getRegisteredTypes(): WalletType[] {
    return Array.from(this._registry.keys());
  }

  /**
   * Get provider instances for all registered types.
   * Useful to display a "choose wallet" list.
   */
  getAllProviders(): IWalletProvider[] {
    return this.getRegisteredTypes().map((type) => this.create(type));
  }

  /**
   * Get only providers that are currently available (extension installed).
   */
  getAvailableProviders(): IWalletProvider[] {
    return this.getAllProviders().filter((p) => p.isAvailable());
  }
}

// Singleton instance
export const WalletFactory = new WalletFactoryClass();
