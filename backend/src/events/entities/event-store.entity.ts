import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  VersionColumn,
} from 'typeorm';

/**
 * Event Store entity for persisting domain events
 * Implements event sourcing pattern for complete audit trail
 */
@Entity('event_store')
@Index(['aggregateId', 'timestamp'])
@Index(['eventType', 'timestamp'])
@Index(['aggregateId', 'version'], { unique: true })
export class EventStore {
  @PrimaryGeneratedColumn('uuid')
  eventId: string;

  @Column({ type: 'uuid', nullable: false })
  @Index()
  aggregateId: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  @Index()
  eventType: string;

  @Column({ type: 'jsonb', nullable: false })
  payload: Record<string, any>;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  @Index()
  timestamp: Date;

  @VersionColumn()
  version: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  aggregateType: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ type: 'int', default: 0 })
  retryCount: number;

  @Column({ type: 'varchar', length: 50, default: 'PENDING' })
  status: EventStatus;

  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  @Column({ type: 'boolean', default: false })
  isSnapshotted: boolean;
}

export enum EventStatus {
  PENDING = 'PENDING',
  PROCESSED = 'PROCESSED',
  FAILED = 'FAILED',
  DEAD_LETTER = 'DEAD_LETTER',
}
