import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Event Snapshot entity for performance optimization
 * Stores aggregate state at specific versions to reduce replay cost
 */
@Entity('event_snapshots')
@Index(['aggregateId', 'version'], { unique: true })
export class EventSnapshot {
  @PrimaryGeneratedColumn('uuid')
  snapshotId: string;

  @Column({ type: 'uuid', nullable: false })
  @Index()
  aggregateId: string;

  @Column({ type: 'varchar', length: 100, nullable: false })
  aggregateType: string;

  @Column({ type: 'int', nullable: false })
  version: number;

  @Column({ type: 'jsonb', nullable: false })
  state: Record<string, any>;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @Column({ type: 'int', nullable: false })
  eventCount: number;

  @Column({ type: 'timestamp with time zone', nullable: true })
  lastEventTimestamp: Date;
}
