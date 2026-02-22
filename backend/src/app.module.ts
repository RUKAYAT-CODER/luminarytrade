import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { AppController } from './app.controller';
import { SimulatorModule } from './simulator/simulator.module';
import { SubmitterModule } from './submitter/submitter.module';
import { ComputeBridgeModule } from './compute-bridge/compute-bridge.module';
import { IndexerModule } from './agent/agent.module';
import { AuditLogModule } from './audit/audit-log.module';
import { WorkerModule } from './worker/worker.module';
import { OracleModule } from './oracle/oracle.module';
import { TransactionModule } from './transaction/transaction.module';
import { EventsModule } from './events/events.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'submitter',
      autoLoadEntities: true,
      synchronize: process.env.NODE_ENV !== 'production',
    }),
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
      },
    }),
    TransactionModule,
    EventsModule,
    SimulatorModule,
    SubmitterModule,
    ComputeBridgeModule,
    IndexerModule,
    AuditLogModule,
    WorkerModule,
    OracleModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
