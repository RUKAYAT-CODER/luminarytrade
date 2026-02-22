import { DomainEvent } from '../base/domain-event.base';

export interface PriceFeed {
  pair: string;
  price: string;
  decimals: number;
}

/**
 * Event emitted when an oracle snapshot is recorded
 */
export class OracleSnapshotRecordedEvent extends DomainEvent {
  public readonly signer: string;
  public readonly signature: string;
  public readonly feeds: PriceFeed[];
  public readonly feedsUpdated: number;

  static readonly EVENT_TYPE = 'OracleSnapshotRecorded';

  constructor(params: {
    aggregateId: string;
    signer: string;
    signature: string;
    feeds: PriceFeed[];
    metadata?: Record<string, any>;
    expectedVersion?: number;
  }) {
    super({
      aggregateId: params.aggregateId,
      aggregateType: 'OracleSnapshot',
      eventType: OracleSnapshotRecordedEvent.EVENT_TYPE,
      metadata: params.metadata,
      expectedVersion: params.expectedVersion,
    });

    this.signer = params.signer;
    this.signature = params.signature;
    this.feeds = params.feeds;
    this.feedsUpdated = params.feeds.length;
  }

  toPayload(): Record<string, any> {
    return {
      signer: this.signer,
      signature: this.signature,
      feeds: this.feeds,
      feedsUpdated: this.feedsUpdated,
    };
  }
}

/**
 * Event emitted when a price feed is updated
 */
export class PriceFeedUpdatedEvent extends DomainEvent {
  public readonly pair: string;
  public readonly price: string;
  public readonly decimals: number;
  public readonly snapshotId: string;

  static readonly EVENT_TYPE = 'PriceFeedUpdated';

  constructor(params: {
    aggregateId: string;
    pair: string;
    price: string;
    decimals: number;
    snapshotId: string;
    metadata?: Record<string, any>;
    expectedVersion?: number;
  }) {
    super({
      aggregateId: params.aggregateId,
      aggregateType: 'OracleSnapshot',
      eventType: PriceFeedUpdatedEvent.EVENT_TYPE,
      metadata: params.metadata,
      expectedVersion: params.expectedVersion,
    });

    this.pair = params.pair;
    this.price = params.price;
    this.decimals = params.decimals;
    this.snapshotId = params.snapshotId;
  }

  toPayload(): Record<string, any> {
    return {
      pair: this.pair,
      price: this.price,
      decimals: this.decimals,
      snapshotId: this.snapshotId,
    };
  }
}
