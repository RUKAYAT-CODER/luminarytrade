import { Injectable, Logger } from '@nestjs/common';
import { EventStoreService } from './event-store.service';
import { EventStatus } from '../entities/event-store.entity';
import { DeadLetterStatus } from '../entities/dead-letter.entity';

export interface EventMetrics {
  totalEvents: number;
  pendingEvents: number;
  processedEvents: number;
  failedEvents: number;
  deadLetterEvents: number;
  eventsByType: Record<string, number>;
  eventsByAggregate: Record<string, number>;
  averageProcessingTimeMs: number;
  eventsPerMinute: number;
}

@Injectable()
export class EventMetricsService {
  private readonly logger = new Logger(EventMetricsService.name);

  constructor(private readonly eventStoreService: EventStoreService) {}

  /**
   * Get current event metrics
   */
  async getMetrics(): Promise<EventMetrics> {
    const allEvents = await this.eventStoreService.getEvents({ limit: 10000 });

    const metrics: EventMetrics = {
      totalEvents: allEvents.length,
      pendingEvents: 0,
      processedEvents: 0,
      failedEvents: 0,
      deadLetterEvents: 0,
      eventsByType: {},
      eventsByAggregate: {},
      averageProcessingTimeMs: 0,
      eventsPerMinute: 0,
    };

    // Count by status
    for (const event of allEvents) {
      switch (event.status) {
        case EventStatus.PENDING:
          metrics.pendingEvents++;
          break;
        case EventStatus.PROCESSED:
          metrics.processedEvents++;
          break;
        case EventStatus.FAILED:
          metrics.failedEvents++;
          break;
        case EventStatus.DEAD_LETTER:
          metrics.deadLetterEvents++;
          break;
      }

      // Count by type
      metrics.eventsByType[event.eventType] = (metrics.eventsByType[event.eventType] || 0) + 1;

      // Count by aggregate
      metrics.eventsByAggregate[event.aggregateType] = 
        (metrics.eventsByAggregate[event.aggregateType] || 0) + 1;
    }

    // Calculate events per minute (based on recent events)
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60000);
    const recentEvents = allEvents.filter(e => new Date(e.timestamp) > oneMinuteAgo);
    metrics.eventsPerMinute = recentEvents.length;

    return metrics;
  }

  /**
   * Get health status based on metrics
   */
  async getHealthStatus(): Promise<{
    healthy: boolean;
    issues: string[];
  }> {
    const metrics = await this.getMetrics();
    const issues: string[] = [];

    // Check for high failure rate
    if (metrics.totalEvents > 0) {
      const failureRate = metrics.failedEvents / metrics.totalEvents;
      if (failureRate > 0.1) {
        issues.push(`High failure rate: ${(failureRate * 100).toFixed(2)}%`);
      }
    }

    // Check for pending events
    if (metrics.pendingEvents > 100) {
      issues.push(`High number of pending events: ${metrics.pendingEvents}`);
    }

    // Check for dead letter entries
    if (metrics.deadLetterEvents > 10) {
      issues.push(`High number of dead letter events: ${metrics.deadLetterEvents}`);
    }

    return {
      healthy: issues.length === 0,
      issues,
    };
  }

  /**
   * Get event trace for debugging
   */
  async traceEvent(eventId: string): Promise<{
    event: any;
    relatedEvents: any[];
    snapshot: any | null;
  }> {
    const event = await this.eventStoreService.getEventById(eventId);
    
    if (!event) {
      return {
        event: null,
        relatedEvents: [],
        snapshot: null,
      };
    }

    // Get related events for the same aggregate
    const relatedEvents = await this.eventStoreService.getAggregateEvents(event.aggregateId);

    // Get snapshot if available
    const snapshot = await this.eventStoreService.getLatestSnapshot(event.aggregateId);

    return {
      event,
      relatedEvents,
      snapshot,
    };
  }

  /**
   * Log metrics periodically
   */
  async logMetrics(): Promise<void> {
    const metrics = await this.getMetrics();
    
    this.logger.log(
      `Event Metrics: Total=${metrics.totalEvents}, ` +
      `Processed=${metrics.processedEvents}, ` +
      `Failed=${metrics.failedEvents}, ` +
      `DeadLetter=${metrics.deadLetterEvents}, ` +
      `EventsPerMin=${metrics.eventsPerMinute}`,
    );

    const health = await this.getHealthStatus();
    if (!health.healthy) {
      this.logger.warn(`Event System Health Issues: ${health.issues.join(', ')}`);
    }
  }
}
