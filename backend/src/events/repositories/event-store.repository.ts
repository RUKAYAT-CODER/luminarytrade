import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  FindOptionsWhere,
  Between,
  LessThanOrEqual,
  MoreThanOrEqual,
} from 'typeorm';
import { EventStore, EventStatus } from '../entities/event-store.entity';
import { EventSnapshot } from '../entities/event-snapshot.entity';
import { DeadLetterEntry, DeadLetterStatus } from '../entities/dead-letter.entity';

export interface EventFilter {
  aggregateId?: string;
  aggregateType?: string;
  eventType?: string;
  startDate?: Date;
  endDate?: Date;
  status?: EventStatus;
  limit?: number;
  offset?: number;
}

export interface SnapshotFilter {
  aggregateId: string;
  version?: number;
}

@Injectable()
export class EventStoreRepository {
  private readonly logger = new Logger(EventStoreRepository.name);

  constructor(
    @InjectRepository(EventStore)
    private eventStoreRepo: Repository<EventStore>,
    @InjectRepository(EventSnapshot)
    private snapshotRepo: Repository<EventSnapshot>,
    @InjectRepository(DeadLetterEntry)
    private deadLetterRepo: Repository<DeadLetterEntry>,
  ) {}

  // ==================== Event Store Operations ====================

  /**
   * Append a new event to the store with optimistic locking
   * @throws Error if version conflict detected
   */
  async appendEvent(
    aggregateId: string,
    eventType: string,
    payload: Record<string, any>,
    options: {
      aggregateType?: string;
      metadata?: Record<string, any>;
      expectedVersion?: number;
    } = {},
  ): Promise<EventStore> {
    const { aggregateType, metadata, expectedVersion } = options;

    // Check for version conflict if expectedVersion is provided
    if (expectedVersion !== undefined) {
      const existingEvent = await this.eventStoreRepo.findOne({
        where: { aggregateId },
        order: { version: 'DESC' },
      });

      if (existingEvent && existingEvent.version !== expectedVersion) {
        throw new Error(
          `Version conflict: expected ${expectedVersion}, but current version is ${existingEvent.version}`,
        );
      }
    }

    // Get the next version
    const currentVersion = await this.getCurrentVersion(aggregateId);
    const nextVersion = currentVersion + 1;

    const event = this.eventStoreRepo.create({
      aggregateId,
      eventType,
      payload,
      aggregateType,
      metadata,
      version: nextVersion,
      status: EventStatus.PENDING,
      retryCount: 0,
    });

    const saved = await this.eventStoreRepo.save(event);
    this.logger.debug(`Event ${saved.eventId} appended to aggregate ${aggregateId} at version ${nextVersion}`);
    return saved;
  }

  /**
   * Get current version of an aggregate
   */
  async getCurrentVersion(aggregateId: string): Promise<number> {
    const latestEvent = await this.eventStoreRepo.findOne({
      where: { aggregateId },
      order: { version: 'DESC' },
    });
    return latestEvent?.version || 0;
  }

  /**
   * Get all events for an aggregate in order
   */
  async getEventsForAggregate(aggregateId: string): Promise<EventStore[]> {
    return this.eventStoreRepo.find({
      where: { aggregateId },
      order: { version: 'ASC' },
    });
  }

  /**
   * Get events for aggregate from a specific version
   */
  async getEventsFromVersion(aggregateId: string, version: number): Promise<EventStore[]> {
    return this.eventStoreRepo.find({
      where: { aggregateId, version: MoreThanOrEqual(version) },
      order: { version: 'ASC' },
    });
  }

  /**
   * Get events with filtering
   */
  async getEvents(filter: EventFilter): Promise<EventStore[]> {
    const where: FindOptionsWhere<EventStore> = {};

    if (filter.aggregateId) {
      where.aggregateId = filter.aggregateId;
    }

    if (filter.aggregateType) {
      where.aggregateType = filter.aggregateType;
    }

    if (filter.eventType) {
      where.eventType = filter.eventType;
    }

    if (filter.status) {
      where.status = filter.status;
    }

    if (filter.startDate || filter.endDate) {
      where.timestamp = Between(
        filter.startDate || new Date(0),
        filter.endDate || new Date(),
      );
    }

    return this.eventStoreRepo.find({
      where,
      order: { timestamp: 'DESC' },
      take: filter.limit || 50,
      skip: filter.offset || 0,
    });
  }

  /**
   * Update event status
   */
  async updateEventStatus(
    eventId: string,
    status: EventStatus,
    errorMessage?: string,
  ): Promise<void> {
    await this.eventStoreRepo.update(eventId, {
      status,
      errorMessage,
    });
  }

  /**
   * Increment retry count for an event
   */
  async incrementRetryCount(eventId: string): Promise<void> {
    await this.eventStoreRepo.increment({ eventId }, 'retryCount', 1);
  }

  // ==================== Snapshot Operations ====================

  /**
   * Create a snapshot of aggregate state
   */
  async createSnapshot(
    aggregateId: string,
    aggregateType: string,
    version: number,
    state: Record<string, any>,
    eventCount: number,
    lastEventTimestamp: Date,
  ): Promise<EventSnapshot> {
    const snapshot = this.snapshotRepo.create({
      aggregateId,
      aggregateType,
      version,
      state,
      eventCount,
      lastEventTimestamp,
    });

    const saved = await this.snapshotRepo.save(snapshot);

    // Mark events as snapshotted
    await this.eventStoreRepo.update(
      { aggregateId, version: LessThanOrEqual(version) },
      { isSnapshotted: true },
    );

    this.logger.debug(`Snapshot created for aggregate ${aggregateId} at version ${version}`);
    return saved;
  }

  /**
   * Get latest snapshot for an aggregate
   */
  async getLatestSnapshot(filter: SnapshotFilter): Promise<EventSnapshot | null> {
    return this.snapshotRepo.findOne({
      where: { aggregateId: filter.aggregateId },
      order: { version: 'DESC' },
    });
  }

  /**
   * Get snapshot at or before a specific version
   */
  async getSnapshotAtVersion(aggregateId: string, version: number): Promise<EventSnapshot | null> {
    return this.snapshotRepo.findOne({
      where: { aggregateId, version: LessThanOrEqual(version) },
      order: { version: 'DESC' },
    });
  }

  /**
   * Delete old snapshots for an aggregate (retention policy)
   */
  async deleteOldSnapshots(aggregateId: string, keepCount: number): Promise<number> {
    const snapshots = await this.snapshotRepo.find({
      where: { aggregateId },
      order: { version: 'DESC' },
      skip: keepCount,
    });

    if (snapshots.length > 0) {
      const ids = snapshots.map(s => s.snapshotId);
      await this.snapshotRepo.delete(ids);
      this.logger.debug(`Deleted ${ids.length} old snapshots for aggregate ${aggregateId}`);
    }

    return snapshots.length;
  }

  // ==================== Dead Letter Operations ====================

  /**
   * Move failed event to dead letter queue
   */
  async moveToDeadLetter(
    event: EventStore,
    error: Error,
    retryCount: number,
  ): Promise<DeadLetterEntry> {
    const deadLetter = this.deadLetterRepo.create({
      originalEventId: event.eventId,
      aggregateId: event.aggregateId,
      eventType: event.eventType,
      payload: event.payload,
      metadata: event.metadata,
      errorMessage: error.message,
      stackTrace: error.stack,
      retryCount,
      status: DeadLetterStatus.PENDING,
      lastAttemptAt: new Date(),
    });

    const saved = await this.deadLetterRepo.save(deadLetter);

    // Update original event status
    await this.updateEventStatus(event.eventId, EventStatus.DEAD_LETTER, error.message);

    this.logger.warn(`Event ${event.eventId} moved to dead letter: ${error.message}`);
    return saved;
  }

  /**
   * Get pending dead letter entries
   */
  async getPendingDeadLetters(limit: number = 10): Promise<DeadLetterEntry[]> {
    return this.deadLetterRepo.find({
      where: { status: DeadLetterStatus.PENDING },
      order: { createdAt: 'ASC' },
      take: limit,
    });
  }

  /**
   * Update dead letter status
   */
  async updateDeadLetterStatus(
    id: string,
    status: DeadLetterStatus,
    errorMessage?: string,
  ): Promise<void> {
    await this.deadLetterRepo.update(id, {
      status,
      errorMessage,
    });
  }

  /**
   * Retry a dead letter event
   */
  async retryDeadLetter(id: string): Promise<DeadLetterEntry | null> {
    const deadLetter = await this.deadLetterRepo.findOne({ where: { id } });
    if (!deadLetter) return null;

    await this.deadLetterRepo.update(id, {
      retryCount: deadLetter.retryCount + 1,
      lastAttemptAt: new Date(),
      status: DeadLetterStatus.RETRYING,
    });

    // Get the original event
    const originalEvent = await this.eventStoreRepo.findOne({
      where: { eventId: deadLetter.originalEventId },
    });

    if (originalEvent) {
      await this.updateEventStatus(originalEvent.eventId, EventStatus.PENDING);
    }

    return deadLetter;
  }
}
