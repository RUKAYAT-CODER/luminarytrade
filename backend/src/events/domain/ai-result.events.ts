import { DomainEvent } from '../base/domain-event.base';

/**
 * Event emitted when an AI scoring request is initiated
 */
export class AIResultCreatedEvent extends DomainEvent {
  public readonly userId: string;
  public readonly provider: string;
  public readonly userData: Record<string, any>;

  static readonly EVENT_TYPE = 'AIResultCreated';

  constructor(params: {
    aggregateId: string;
    userId: string;
    provider: string;
    userData: Record<string, any>;
    metadata?: Record<string, any>;
    expectedVersion?: number;
  }) {
    super({
      aggregateId: params.aggregateId,
      aggregateType: 'AIResult',
      eventType: AIResultCreatedEvent.EVENT_TYPE,
      metadata: params.metadata,
      expectedVersion: params.expectedVersion,
    });

    this.userId = params.userId;
    this.provider = params.provider;
    this.userData = params.userData;
  }

  toPayload(): Record<string, any> {
    return {
      userId: this.userId,
      provider: this.provider,
      userData: this.userData,
    };
  }
}

/**
 * Event emitted when AI scoring completes successfully
 */
export class AIResultCompletedEvent extends DomainEvent {
  public readonly userId: string;
  public readonly provider: string;
  public readonly creditScore: number;
  public readonly riskScore: number;
  public readonly riskLevel: string;
  public readonly signature: string;

  static readonly EVENT_TYPE = 'AIResultCompleted';

  constructor(params: {
    aggregateId: string;
    userId: string;
    provider: string;
    creditScore: number;
    riskScore: number;
    riskLevel: string;
    signature: string;
    metadata?: Record<string, any>;
    expectedVersion?: number;
  }) {
    super({
      aggregateId: params.aggregateId,
      aggregateType: 'AIResult',
      eventType: AIResultCompletedEvent.EVENT_TYPE,
      metadata: params.metadata,
      expectedVersion: params.expectedVersion,
    });

    this.userId = params.userId;
    this.provider = params.provider;
    this.creditScore = params.creditScore;
    this.riskScore = params.riskScore;
    this.riskLevel = params.riskLevel;
    this.signature = params.signature;
  }

  toPayload(): Record<string, any> {
    return {
      userId: this.userId,
      provider: this.provider,
      creditScore: this.creditScore,
      riskScore: this.riskScore,
      riskLevel: this.riskLevel,
      signature: this.signature,
    };
  }
}

/**
 * Event emitted when AI scoring fails
 */
export class AIResultFailedEvent extends DomainEvent {
  public readonly userId: string;
  public readonly provider: string;
  public readonly errorMessage: string;

  static readonly EVENT_TYPE = 'AIResultFailed';

  constructor(params: {
    aggregateId: string;
    userId: string;
    provider: string;
    errorMessage: string;
    metadata?: Record<string, any>;
    expectedVersion?: number;
  }) {
    super({
      aggregateId: params.aggregateId,
      aggregateType: 'AIResult',
      eventType: AIResultFailedEvent.EVENT_TYPE,
      metadata: params.metadata,
      expectedVersion: params.expectedVersion,
    });

    this.userId = params.userId;
    this.provider = params.provider;
    this.errorMessage = params.errorMessage;
  }

  toPayload(): Record<string, any> {
    return {
      userId: this.userId,
      provider: this.provider,
      errorMessage: this.errorMessage,
    };
  }
}
