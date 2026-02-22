import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdapterRegistry } from './registry/adapter.registry';
import { AdapterFactory } from './factory/adapter.factory';
import { StellarWalletAdapter } from './wallet/stellar-wallet.adapter';
import { OpenAIAdapter } from './ai/openai.adapter';
import { LlamaAdapter } from './ai/llama.adapter';
import { GrokAdapter } from './ai/grok.adapter';

/**
 * Adapters Module
 * Centralizes all adapter registrations and configuration.
 */
@Module({
  providers: [AdapterRegistry, AdapterFactory],
  exports: [AdapterRegistry, AdapterFactory],
})
export class AdaptersModule {
  constructor(
    private readonly registry: AdapterRegistry,
    private readonly factory: AdapterFactory,
    private readonly configService: ConfigService,
  ) {
    this.initializeAdapters();
  }

  /**
   * Initialize and register default adapters
   */
  private initializeAdapters(): void {
    // Register Stellar wallet adapter
    const stellarAdapter = this.factory.createStellarWalletAdapter('testnet');
    this.registry.registerWalletAdapter(stellarAdapter, true);

    // Register AI adapters
    const openaiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (openaiKey) {
      const openaiAdapter = new OpenAIAdapter(this.configService);
      this.registry.registerAIAdapter(openaiAdapter, true); // Set as default
    }

    const llamaKey = this.configService.get<string>('LLAMA_API_KEY');
    if (llamaKey) {
      const llamaAdapter = new LlamaAdapter(llamaKey);
      this.registry.registerAIAdapter(llamaAdapter);
    }

    const grokKey = this.configService.get<string>('GROK_API_KEY');
    if (grokKey) {
      const grokAdapter = new GrokAdapter(grokKey);
      this.registry.registerAIAdapter(grokAdapter);
    }
  }
}
