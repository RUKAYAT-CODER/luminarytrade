import { DomainEvent } from '../base/domain-event.base';

/**
 * Event emitted when an audit log is created
 */
export class AuditLogCreatedEvent extends DomainEvent {
  public readonly wallet: string;
  public readonly eventType: string;
  public readonly description?: string;
  public readonly relatedEntityId?: string;
  public readonly relatedEntityType?: string;

  static readonly EVENT_TYPE = 'AuditLogCreated';

  constructor(params: {
    aggregateId: string;
    wallet: string;
    eventType: string;
    description?: string;
    relatedEntityId?: string;
    relatedEntityType?: string;
    metadata?: Record<string, any>;
    expectedVersion?: number;
  }) {
    super({
      aggregateId: params.aggregateId,
      aggregateType: 'AuditLog',
      eventType: AuditLogCreatedEvent.EVENT_TYPE,
      metadata: params.metadata,
      expectedVersion: params.expectedVersion,
    });

    this.wallet = params.wallet;
    this.eventType = params.eventType;
    this.description = params.description;
    this.relatedEntityId = params.relatedEntityId;
    this.relatedEntityType = params.relatedEntityType;
  }

  toPayload(): Record<string, any> {
    return {
      wallet: this.wallet,
      eventType: this.eventType,
      description: this.description,
      relatedEntityId: this.relatedEntityId,
      relatedEntityType: this.relatedEntityType,
    };
  }
}

/**
 * Event emitted when a user authenticates
 */
export class UserAuthenticatedEvent extends DomainEvent {
  public readonly wallet: string;
  public readonly method: string;
  public readonly success: boolean;
  public readonly ipAddress?: string;

  static readonly EVENT_TYPE = 'UserAuthenticated';

  constructor(params: {
    aggregateId: string;
    wallet: string;
    method: string;
    success: boolean;
    ipAddress?: string;
    metadata?: Record<string, any>;
    expectedVersion?: number;
  }) {
    super({
      aggregateId: params.aggregateId,
      aggregateType: 'AuditLog',
      eventType: UserAuthenticatedEvent.EVENT_TYPE,
      metadata: params.metadata,
      expectedVersion: params.expectedVersion,
    });

    this.wallet = params.wallet;
    this.method = params.method;
    this.success = params.success;
    this.ipAddress = params.ipAddress;
  }

  toPayload(): Record<string, any> {
    return {
      wallet: this.wallet,
      method: this.method,
      success: this.success,
      ipAddress: this.ipAddress,
    };
  }
}
