import { Injectable, Logger } from '@nestjs/common';
import { IEventHandler } from '../bus/interfaces/event-bus.interface';
import { DomainEvent } from '../base/domain-event.base';
import {
  AIResultCreatedEvent,
  AIResultCompletedEvent,
  AIResultFailedEvent,
} from '../domain/ai-result.events';
import {
  OracleSnapshotRecordedEvent,
  PriceFeedUpdatedEvent,
} from '../domain/oracle.events';
import { AuditLogCreatedEvent, UserAuthenticatedEvent } from '../domain/audit.events';

/**
 * Handler for AI Result Created events
 * Updates read models when AI scoring is initiated
 */
@Injectable()
export class AIResultCreatedHandler implements IEventHandler<AIResultCreatedEvent> {
  private readonly logger = new Logger(AIResultCreatedHandler.name);

  async handle(event: AIResultCreatedEvent): Promise<void> {
    this.logger.log(
      `Handling AIResultCreatedEvent for aggregate ${event.aggregateId}`,
    );

    // Update read model - e.g., cache pending results
    // In a real implementation, this would update a projection table
    const readModelUpdate = {
      aggregateId: event.aggregateId,
      userId: event.userId,
      provider: event.provider,
      status: 'PENDING',
      createdAt: event.timestamp,
    };

    this.logger.debug(`Updated read model: ${JSON.stringify(readModelUpdate)}`);
  }
}

/**
 * Handler for AI Result Completed events
 * Updates read models when AI scoring completes successfully
 */
@Injectable()
export class AIResultCompletedHandler implements IEventHandler<AIResultCompletedEvent> {
  private readonly logger = new Logger(AIResultCompletedHandler.name);

  async handle(event: AIResultCompletedEvent): Promise<void> {
    this.logger.log(
      `Handling AIResultCompletedEvent for aggregate ${event.aggregateId}`,
    );

    // Update read model with completed result
    const readModelUpdate = {
      aggregateId: event.aggregateId,
      userId: event.userId,
      provider: event.provider,
      creditScore: event.creditScore,
      riskScore: event.riskScore,
      riskLevel: event.riskLevel,
      signature: event.signature,
      status: 'COMPLETED',
      completedAt: event.timestamp,
    };

    this.logger.debug(`Updated read model: ${JSON.stringify(readModelUpdate)}`);
  }
}

/**
 * Handler for AI Result Failed events
 * Updates read models when AI scoring fails
 */
@Injectable()
export class AIResultFailedHandler implements IEventHandler<AIResultFailedEvent> {
  private readonly logger = new Logger(AIResultFailedHandler.name);

  async handle(event: AIResultFailedEvent): Promise<void> {
    this.logger.log(
      `Handling AIResultFailedEvent for aggregate ${event.aggregateId}`,
    );

    // Update read model with failure
    const readModelUpdate = {
      aggregateId: event.aggregateId,
      userId: event.userId,
      provider: event.provider,
      errorMessage: event.errorMessage,
      status: 'FAILED',
      failedAt: event.timestamp,
    };

    this.logger.debug(`Updated read model: ${JSON.stringify(readModelUpdate)}`);
  }
}

/**
 * Handler for Oracle Snapshot Recorded events
 */
@Injectable()
export class OracleSnapshotRecordedHandler
  implements IEventHandler<OracleSnapshotRecordedEvent>
{
  private readonly logger = new Logger(OracleSnapshotRecordedHandler.name);

  async handle(event: OracleSnapshotRecordedEvent): Promise<void> {
    this.logger.log(
      `Handling OracleSnapshotRecordedEvent for aggregate ${event.aggregateId}`,
    );

    // Update oracle read model
    const readModelUpdate = {
      snapshotId: event.aggregateId,
      signer: event.signer,
      feedsCount: event.feedsUpdated,
      recordedAt: event.timestamp,
    };

    this.logger.debug(`Updated oracle read model: ${JSON.stringify(readModelUpdate)}`);
  }
}

/**
 * Handler for Price Feed Updated events
 */
@Injectable()
export class PriceFeedUpdatedHandler implements IEventHandler<PriceFeedUpdatedEvent> {
  private readonly logger = new Logger(PriceFeedUpdatedHandler.name);

  async handle(event: PriceFeedUpdatedEvent): Promise<void> {
    this.logger.log(
      `Handling PriceFeedUpdatedEvent for pair ${event.pair}`,
    );

    // Update price feed read model
    const readModelUpdate = {
      pair: event.pair,
      price: event.price,
      decimals: event.decimals,
      snapshotId: event.snapshotId,
      updatedAt: event.timestamp,
    };

    this.logger.debug(`Updated price feed read model: ${JSON.stringify(readModelUpdate)}`);
  }
}

/**
 * Handler for Audit Log Created events
 */
@Injectable()
export class AuditLogCreatedHandler implements IEventHandler<AuditLogCreatedEvent> {
  private readonly logger = new Logger(AuditLogCreatedHandler.name);

  async handle(event: AuditLogCreatedEvent): Promise<void> {
    this.logger.log(
      `Handling AuditLogCreatedEvent for aggregate ${event.aggregateId}`,
    );

    // Update audit log read model
    const readModelUpdate = {
      auditLogId: event.aggregateId,
      wallet: event.wallet,
      eventType: event.eventType,
      description: event.description,
      relatedEntityId: event.relatedEntityId,
      createdAt: event.timestamp,
    };

    this.logger.debug(`Updated audit log read model: ${JSON.stringify(readModelUpdate)}`);
  }
}

/**
 * Handler for User Authenticated events
 */
@Injectable()
export class UserAuthenticatedHandler implements IEventHandler<UserAuthenticatedEvent> {
  private readonly logger = new Logger(UserAuthenticatedHandler.name);

  async handle(event: UserAuthenticatedEvent): Promise<void> {
    this.logger.log(
      `Handling UserAuthenticatedEvent for wallet ${event.wallet}`,
    );

    // Update user session read model
    const readModelUpdate = {
      wallet: event.wallet,
      method: event.method,
      success: event.success,
      ipAddress: event.ipAddress,
      authenticatedAt: event.timestamp,
    };

    this.logger.debug(`Updated user session read model: ${JSON.stringify(readModelUpdate)}`);
  }
}
