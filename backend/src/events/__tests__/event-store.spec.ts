import { Test, TestingModule } from '@nestjs/testing';
import { EventStoreService } from '../services/event-store.service';
import { EventStoreRepository } from '../repositories/event-store.repository';
import { EventStore, EventStatus } from '../entities/event-store.entity';
import { EventSnapshot } from '../entities/event-snapshot.entity';
import { DomainEvent } from '../base/domain-event.base';

describe('EventStoreService', () => {
  let service: EventStoreService;
  let repository: EventStoreRepository;

  // Mock domain event for testing
  class TestEvent extends DomainEvent {
    public readonly name: string;

    constructor(params: { aggregateId: string; name: string }) {
      super({
        aggregateId: params.aggregateId,
        aggregateType: 'TestAggregate',
        eventType: 'TestEvent',
      });
      this.name = params.name;
    }

    toPayload(): Record<string, any> {
      return { name: this.name };
    }
  }

  const mockRepository = {
    appendEvent: jest.fn(),
    getEventsForAggregate: jest.fn(),
    getEventsFromVersion: jest.fn(),
    getEvents: jest.fn(),
    getCurrentVersion: jest.fn(),
    getLatestSnapshot: jest.fn(),
    createSnapshot: jest.fn(),
    updateEventStatus: jest.fn(),
    incrementRetryCount: jest.fn(),
    moveToDeadLetter: jest.fn(),
    getPendingDeadLetters: jest.fn(),
    retryDeadLetter: jest.fn(),
    updateDeadLetterStatus: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventStoreService,
        {
          provide: EventStoreRepository,
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<EventStoreService>(EventStoreService);
    repository = module.get<EventStoreRepository>(EventStoreRepository);

    jest.clearAllMocks();
  });

  describe('publishEvent', () => {
    it('should publish an event and store it', async () => {
      const event = new TestEvent({ aggregateId: 'test-123', name: 'test-event' });
      const storedEvent: Partial<EventStore> = {
        eventId: 'event-123',
        aggregateId: 'test-123',
        eventType: 'TestEvent',
        payload: { name: 'test-event' },
        version: 1,
        status: EventStatus.PENDING,
      };

      mockRepository.appendEvent.mockResolvedValue(storedEvent);
      mockRepository.getCurrentVersion.mockResolvedValue(0);
      mockRepository.getEventsForAggregate.mockResolvedValue([]);
      mockRepository.createSnapshot.mockResolvedValue({});

      const result = await service.publishEvent(event);

      expect(mockRepository.appendEvent).toHaveBeenCalledWith(
        event.aggregateId,
        event.eventType,
        event.toPayload(),
        expect.objectContaining({
          aggregateType: 'TestAggregate',
        }),
      );
      expect(result).toEqual(storedEvent);
    });
  });

  describe('getAggregateEvents', () => {
    it('should return all events for an aggregate', async () => {
      const events: Partial<EventStore>[] = [
        { eventId: '1', aggregateId: 'test-123', version: 1 },
        { eventId: '2', aggregateId: 'test-123', version: 2 },
      ];
      mockRepository.getEventsForAggregate.mockResolvedValue(events);

      const result = await service.getAggregateEvents('test-123');

      expect(mockRepository.getEventsForAggregate).toHaveBeenCalledWith('test-123');
      expect(result).toEqual(events);
    });
  });

  describe('replayEvents', () => {
    it('should replay events from snapshot', async () => {
      const snapshot: Partial<EventSnapshot> = {
        snapshotId: 'snap-1',
        aggregateId: 'test-123',
        version: 5,
        state: { name: 'test' },
        aggregateType: 'TestAggregate',
      };
      const events: Partial<EventStore>[] = [
        { eventId: '6', aggregateId: 'test-123', version: 6 },
        { eventId: '7', aggregateId: 'test-123', version: 7 },
      ];

      mockRepository.getLatestSnapshot.mockResolvedValue(snapshot);
      mockRepository.getEventsFromVersion.mockResolvedValue(events);

      const result = await service.replayEvents('test-123', 'TestAggregate');

      expect(result.snapshot).toEqual(snapshot);
      expect(result.fromVersion).toBe(5);
      expect(result.events).toEqual(events);
    });

    it('should replay from beginning if no snapshot', async () => {
      mockRepository.getLatestSnapshot.mockResolvedValue(null);
      mockRepository.getEventsFromVersion.mockResolvedValue([
        { eventId: '1', aggregateId: 'test-123', version: 1 },
      ]);

      const result = await service.replayEvents('test-123', 'TestAggregate');

      expect(result.snapshot).toBeNull();
      expect(result.fromVersion).toBe(0);
    });
  });

  describe('dead letter operations', () => {
    it('should move failed event to dead letter', async () => {
      const event: Partial<EventStore> = {
        eventId: 'event-123',
        aggregateId: 'test-123',
        eventType: 'TestEvent',
        payload: { name: 'test' },
        retryCount: 3,
      };
      const error = new Error('Test error');

      mockRepository.getEvents.mockResolvedValue([event]);
      mockRepository.moveToDeadLetter.mockResolvedValue({});

      await service.moveToDeadLetter('event-123', error);

      expect(mockRepository.moveToDeadLetter).toHaveBeenCalledWith(
        event,
        error,
        3,
      );
    });
  });
});
