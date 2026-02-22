import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DomainEvent } from '../base/domain-event.base';
import { IEventBus, IEventHandler, EventBusOptions } from './interfaces/event-bus.interface';
import { EventStoreService } from '../services/event-store.service';

interface HandlerRegistration {
  id: string;
  handler: IEventHandler;
}

@Injectable()
export class NestEventBus implements IEventBus, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NestEventBus.name);
  private readonly handlers: Map<string, HandlerRegistration[]> = new Map();
  private readonly options: Required<EventBusOptions>;
  private eventStoreEventId: string | null = null;

  constructor(
    private readonly eventStoreService: EventStoreService,
    options: EventBusOptions = {},
  ) {
    this.options = {
      concurrency: options.concurrency || 10,
      retryEnabled: options.retryEnabled ?? true,
      maxRetries: options.maxRetries || 3,
      baseRetryDelay: options.baseRetryDelay || 100,
      maxRetryDelay: options.maxRetryDelay || 5000,
      deadLetterEnabled: options.deadLetterEnabled ?? true,
    };
  }

  async onModuleInit() {
    this.logger.log('NestEventBus initialized');
  }

  async onModuleDestroy() {
    this.logger.log('NestEventBus destroyed');
  }

  /**
   * Subscribe a handler to an event type
   */
  subscribe<T extends DomainEvent>(
    eventType: string,
    handler: IEventHandler<T>,
  ): void {
    const registration: HandlerRegistration = {
      id: uuidv4(),
      handler,
    };

    const existing = this.handlers.get(eventType) || [];
    existing.push(registration);
    this.handlers.set(eventType, existing);

    this.logger.debug(`Handler subscribed to event: ${eventType}`);
  }

  /**
   * Unsubscribe a handler from an event type
   */
  unsubscribe<T extends DomainEvent>(
    eventType: string,
    handler: IEventHandler<T>,
  ): void {
    const existing = this.handlers.get(eventType);
    if (!existing) return;

    const filtered = existing.filter(
      (r) => r.handler !== handler,
    );
    this.handlers.set(eventType, filtered);

    this.logger.debug(`Handler unsubscribed from event: ${eventType}`);
  }

  /**
   * Publish an event to all registered handlers
   */
  async publish<T extends DomainEvent>(event: T): Promise<void> {
    this.logger.debug(`Publishing event: ${event.eventType} for aggregate ${event.aggregateId}`);

    try {
      // Store event in event store first
      const storedEvent = await this.eventStoreService.publishEvent(event);
      this.eventStoreEventId = storedEvent.eventId;

      // Get all handlers for this event type
      const handlers = this.handlers.get(event.eventType) || [];
      const wildcardHandlers = this.handlers.get('*') || [];

      const allHandlers = [...handlers, ...wildcardHandlers];

      if (allHandlers.length === 0) {
        this.logger.debug(`No handlers registered for event: ${event.eventType}`);
        return;
      }

      // Execute all handlers concurrently with controlled concurrency
      const promises = allHandlers.map(async (registration) => {
        await this.executeWithRetry(registration.handler, event, storedEvent.eventId);
      });

      await Promise.all(promises);

      // Mark event as processed
      await this.eventStoreService.markEventProcessed(storedEvent.eventId);
    } catch (error) {
      this.logger.error(`Error publishing event ${event.eventType}: ${(error as Error).message}`);
      
      // Handle error - move to dead letter if enabled
      if (this.options.deadLetterEnabled && this.eventStoreEventId) {
        await this.handleEventFailure(this.eventStoreEventId, error as Error);
      }
      
      throw error;
    }
  }

  /**
   * Publish multiple events
   */
  async publishAll<T extends DomainEvent>(events: T[]): Promise<void> {
    for (const event of events) {
      await this.publish(event);
    }
  }

  /**
   * Execute handler with retry mechanism
   */
  private async executeWithRetry(
    handler: IEventHandler,
    event: DomainEvent,
    eventId: string,
    attempt: number = 0,
  ): Promise<void> {
    try {
      await handler.handle(event);
    } catch (error) {
      if (this.options.retryEnabled && attempt < this.options.maxRetries) {
        // Calculate exponential backoff delay
        const delay = Math.min(
          this.options.baseRetryDelay * Math.pow(2, attempt),
          this.options.maxRetryDelay,
        );

        this.logger.warn(
          `Handler failed for event ${event.eventType}, retry ${attempt + 1}/${this.options.maxRetries} after ${delay}ms`,
        );

        await this.sleep(delay);
        await this.executeWithRetry(handler, event, eventId, attempt + 1);
      } else {
        // All retries exhausted
        this.logger.error(
          `Handler failed for event ${event.eventType} after ${attempt} attempts: ${(error as Error).message}`,
        );

        // Increment retry count in event store
        await this.eventStoreService.incrementEventRetry(eventId);

        // Move to dead letter if enabled
        if (this.options.deadLetterEnabled) {
          await this.handleEventFailure(eventId, error as Error);
        }

        throw error;
      }
    }
  }

  /**
   * Handle event failure
   */
  private async handleEventFailure(eventId: string, error: Error): Promise<void> {
    try {
      await this.eventStoreService.moveToDeadLetter(eventId, error);
      this.logger.warn(`Event ${eventId} moved to dead letter queue`);
    } catch (deadLetterError) {
      this.logger.error(
        `Failed to move event ${eventId} to dead letter: ${(deadLetterError as Error).message}`,
      );
    }
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get the number of handlers for an event type
   */
  getHandlerCount(eventType: string): number {
    const handlers = this.handlers.get(eventType) || [];
    const wildcardHandlers = this.handlers.get('*') || [];
    return handlers.length + wildcardHandlers.length;
  }

  /**
   * Get all registered event types
   */
  getRegisteredEventTypes(): string[] {
    return Array.from(this.handlers.keys());
  }
}
