import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('agents')
@Index(['evolution_level'])
@Index(['created_at'])
export class Agent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, any>;

  @Column({ type: 'jsonb', default: [] })
  capabilities: string[];

  @Column({ type: 'int', default: 1 })
  evolution_level: number;

  @Column({ type: 'jsonb', default: {} })
  performance_metrics: {
    total_tasks?: number;
    success_rate?: number;
    avg_response_time?: number;
    uptime_percentage?: number;
  };

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
