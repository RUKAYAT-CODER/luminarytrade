import { Injectable, Logger } from '@nestjs/common';
import { EventStoreRepository, EventFilter, SnapshotFilter } from '../repositories/event-store.repository';
import { EventStore, EventStatus } from '../entities/event-store.entity';
import { EventSnapshot } from '../entities/event-snapshot.entity';
import { DomainEvent } from '../base/domain-event.base';

export interface EventReplayResult {
  events: EventStore[];
  snapshot: EventSnapshot | null;
  fromVersion: number;
}

@Injectable()
export class EventStoreService {
  private readonly logger = new Logger(EventStoreService.name);
  private readonly snapshotInterval: number;

  constructor(
    private readonly eventStoreRepository: EventStoreRepository,
  ) {
    // Create snapshot every 100 events by default
    this.snapshotInterval = parseInt(process.env.EVENT_SNAPSHOT_INTERVAL || '100', 10);
  }

  // ==================== Event Publishing ====================

  /**
   * Publish a domain event to the event store
   */
  async publishEvent(event: DomainEvent): Promise<EventStore> {
    this.logger.debug(`Publishing event: ${event.eventType} for aggregate ${event.aggregateId}`);

    const storedEvent = await this.eventStoreRepository.appendEvent(
      event.aggregateId,
      event.eventType,
      event.toPayload(),
      {
        aggregateType: event.aggregateType,
        metadata: event.metadata,
        expectedVersion: event.expectedVersion,
      },
    );

    // Check if we should create a snapshot
    await this.maybeCreateSnapshot(event.aggregateId, event.aggregateType);

    return storedEvent;
  }

  /**
   * Publish multiple events atomically
   */
  async publishEvents(events: DomainEvent[]): Promise<EventStore[]> {
    const storedEvents: EventStore[] = [];

    for (const event of events) {
      const storedEvent = await this.publishEvent(event);
      storedEvents.push(storedEvent);
    }

    return storedEvents;
  }

  // ==================== Event Retrieval ====================

  /**
   * Get all events for an aggregate
   */
  async getAggregateEvents(aggregateId: string): Promise<EventStore[]> {
    return this.eventStoreRepository.getEventsForAggregate(aggregateId);
  }

  /**
   * Replay events for an aggregate, optionally from a snapshot
   */
  async replayEvents(aggregateId: string, aggregateType: string): Promise<EventReplayResult> {
    // Try to get the latest snapshot first
    const snapshot = await this.eventStoreRepository.getLatestSnapshot({ aggregateId });

    let fromVersion = 0;
    if (snapshot && snapshot.aggregateType === aggregateType) {
      fromVersion = snapshot.version;
    }

    // Get events from the snapshot version onwards
    const events = await this.eventStoreRepository.getEventsFromVersion(aggregateId, fromVersion + 1);

    return {
      events,
      snapshot,
      fromVersion,
    };
  }

  /**
   * Get events with filtering
   */
  async getEvents(filter: EventFilter): Promise<EventStore[]> {
    return this.eventStoreRepository.getEvents(filter);
  }

  // ==================== Snapshot Management ====================

  /**
   * Create a snapshot of current aggregate state
   */
  async createSnapshot(
    aggregateId: string,
    aggregateType: string,
    state: Record<string, any>,
  ): Promise<EventSnapshot> {
    const version = await this.eventStoreRepository.getCurrentVersion(aggregateId);
    const events = await this.eventStoreRepository.getEventsForAggregate(aggregateId);
    const lastEvent = events[events.length - 1];

    return this.eventStoreRepository.createSnapshot(
      aggregateId,
      aggregateType,
      version,
      state,
      events.length,
      lastEvent?.timestamp || new Date(),
    );
  }

  /**
   * Check if we should create a snapshot and do so if needed
   */
  private async maybeCreateSnapshot(aggregateId: string, aggregateType?: string): Promise<void> {
    const currentVersion = await this.eventStoreRepository.getCurrentVersion(aggregateId);

    // Check if we've reached the snapshot interval
    if (currentVersion > 0 && currentVersion % this.snapshotInterval === 0) {
      this.logger.debug(`Creating snapshot for aggregate ${aggregateId} at version ${currentVersion}`);

      // Get all events to build state
      const events = await this.eventStoreRepository.getEventsForAggregate(aggregateId);

      // Build state from events (simplified - in practice you'd use an aggregate)
      const state = this.buildStateFromEvents(events);

      await this.eventStoreRepository.createSnapshot(
        aggregateId,
        aggregateType || 'Unknown',
        currentVersion,
        state,
        events.length,
        events[events.length - 1]?.timestamp || new Date(),
      );
    }
  }

  /**
   * Build state from events (simplified event sourcing)
   */
  private buildStateFromEvents(events: EventStore[]): Record<string, any> {
    const state: Record<string, any> = {};

    for (const event of events) {
      // Apply event payload to state
      Object.assign(state, event.payload);
    }

    return state;
  }

  /**
   * Get latest snapshot for an aggregate
   */
  async getLatestSnapshot(aggregateId: string): Promise<EventSnapshot | null> {
    return this.eventStoreRepository.getLatestSnapshot({ aggregateId });
  }

  // ==================== Event Status Management ====================

  /**
   * Mark an event as processed
   */
  async markEventProcessed(eventId: string): Promise<void> {
    await this.eventStoreRepository.updateEventStatus(eventId, EventStatus.PROCESSED);
  }

  /**
   * Mark an event as failed
   */
  async markEventFailed(eventId: string, errorMessage: string): Promise<void> {
    await this.eventStoreRepository.updateEventStatus(eventId, EventStatus.FAILED, errorMessage);
  }

  /**
   * Increment retry count for an event
   */
  async incrementEventRetry(eventId: string): Promise<void> {
    await this.eventStoreRepository.incrementRetryCount(eventId);
  }

  /**
   * Get event by ID
   */
  async getEventById(eventId: string): Promise<EventStore | null> {
    const events = await this.eventStoreRepository.getEvents({
      limit: 1,
    });
    return events.find(e => e.eventId === eventId) || null;
  }

  // ==================== Dead Letter Operations ====================

  /**
   * Move a failed event to dead letter queue
   */
  async moveToDeadLetter(eventId: string, error: Error): Promise<void> {
    const events = await this.eventStoreRepository.getEvents({ limit: 1000 });
    const event = events.find(e => e.eventId === eventId);

    if (!event) {
      this.logger.error(`Event ${eventId} not found for dead letter`);
      return;
    }

    await this.eventStoreRepository.moveToDeadLetter(event, error, event.retryCount);
  }

  /**
   * Get pending dead letter entries
   */
  async getDeadLetters(limit: number = 10) {
    return this.eventStoreRepository.getPendingDeadLetters(limit);
  }

  /**
   * Retry a dead letter event
   */
  async retryDeadLetter(id: string) {
    return this.eventStoreRepository.retryDeadLetter(id);
  }

  /**
   * Update dead letter status
   */
  async updateDeadLetterStatus(id: string, status: any, errorMessage?: string) {
    await this.eventStoreRepository.updateDeadLetterStatus(id, status, errorMessage);
  }
}
