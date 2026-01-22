import { Injectable, Logger } from '@nestjs/common';
import * as StellarSdk from 'stellar-sdk';

@Injectable()
export class StellarService {
  private readonly logger = new Logger(StellarService.name);
  private server: StellarSdk.Server;
  private sourceKeypair: StellarSdk.Keypair;

  constructor() {
    const network = process.env.STELLAR_NETWORK || 'testnet';
    const horizonUrl = network === 'testnet' 
      ? 'https://horizon-testnet.stellar.org'
      : 'https://horizon.stellar.org';

    this.server = new StellarSdk.Server(horizonUrl);
    
    if (network === 'testnet') {
      StellarSdk.Networks.TESTNET;
    } else {
      StellarSdk.Networks.PUBLIC;
    }

    // Load source account from env
    const secretKey = process.env.STELLAR_SECRET_KEY;
    if (secretKey) {
      this.sourceKeypair = StellarSdk.Keypair.fromSecret(secretKey);
    }
  }

  async submitTransaction(payload: Record<string, any>): Promise<string> {
    try {
      this.logger.log(`Submitting transaction to Stellar`);

      // Load source account
      const sourceAccount = await this.server.loadAccount(
        this.sourceKeypair.publicKey()
      );

      // Build transaction with memo containing document hash
      const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: StellarSdk.Networks.TESTNET,
      })
        .addMemo(StellarSdk.Memo.text(payload.documentHash || 'document'))
        .addOperation(
          StellarSdk.Operation.manageData({
            name: 'doc_hash',
            value: payload.documentHash,
          })
        )
        .setTimeout(30)
        .build();

      // Sign transaction
      transaction.sign(this.sourceKeypair);

      // Submit to network
      const result = await this.server.submitTransaction(transaction);
      
      this.logger.log(`Transaction submitted: ${result.hash}`);
      return result.hash;
    } catch (error) {
      this.logger.error(`Stellar submission failed: ${error.message}`);
      throw error;
    }
  }

  async submitBatch(payloads: Record<string, any>[]): Promise<string[]> {
    const hashes: string[] = [];
    
    for (const payload of payloads) {
      try {
        const hash = await this.submitTransaction(payload);
        hashes.push(hash);
      } catch (error) {
        this.logger.error(`Batch item failed: ${error.message}`);
        hashes.push(null);
      }
    }

    return hashes;
  }
}
