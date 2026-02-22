import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Dead Letter Queue entity for failed events
 * Stores events that failed processing after all retry attempts
 */
@Entity('dead_letter_queue')
@Index(['originalEventId'])
@Index(['createdAt'])
export class DeadLetterEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  originalEventId: string;

  @Column({ type: 'uuid', nullable: false })
  aggregateId: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  eventType: string;

  @Column({ type: 'jsonb', nullable: false })
  payload: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ type: 'text', nullable: false })
  errorMessage: string;

  @Column({ type: 'int', default: 0 })
  retryCount: number;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  lastAttemptAt: Date;

  @Column({ type: 'varchar', length: 50, default: 'PENDING' })
  status: DeadLetterStatus;

  @Column({ type: 'text', nullable: true })
  stackTrace: string;
}

export enum DeadLetterStatus {
  PENDING = 'PENDING',
  RETRYING = 'RETRYING',
  RESOLVED = 'RESOLVED',
  MANUAL_REVIEW = 'MANUAL_REVIEW',
}
