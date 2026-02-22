import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventStore } from './entities/event-store.entity';
import { EventSnapshot } from './entities/event-snapshot.entity';
import { DeadLetterEntry } from './entities/dead-letter.entity';
import { EventStoreRepository } from './repositories/event-store.repository';
import { EventStoreService } from './services/event-store.service';
import { EventMetricsService } from './services/event-metrics.service';
import { NestEventBus } from './bus/nest-event-bus.service';
import { AIScoringSaga } from './saga/ai-scoring.saga';
import {
  AIResultCreatedHandler,
  AIResultCompletedHandler,
  AIResultFailedHandler,
  OracleSnapshotRecordedHandler,
  PriceFeedUpdatedHandler,
  AuditLogCreatedHandler,
  UserAuthenticatedHandler,
} from './handlers/event-handlers';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EventStore,
      EventSnapshot,
      DeadLetterEntry,
    ]),
  ],
  providers: [
    EventStoreRepository,
    EventStoreService,
    EventMetricsService,
    NestEventBus,
    AIScoringSaga,
    // Event handlers
    AIResultCreatedHandler,
    AIResultCompletedHandler,
    AIResultFailedHandler,
    OracleSnapshotRecordedHandler,
    PriceFeedUpdatedHandler,
    AuditLogCreatedHandler,
    UserAuthenticatedHandler,
  ],
  exports: [
    EventStoreRepository,
    EventStoreService,
    EventMetricsService,
    NestEventBus,
    AIScoringSaga,
  ],
})
export class EventsModule {}
