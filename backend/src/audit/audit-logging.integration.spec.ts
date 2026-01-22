import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogModule } from './audit-log.module';
import { AuditLogService } from './audit-log.service';
import { AuditLogEntity, AuditEventType } from './entities/audit-log.entity';
import { DataSource } from 'typeorm';

describe('Audit Logging Integration Tests', () => {
  let app: INestApplication;
  let auditLogService: AuditLogService;
  let dataSource: DataSource;

  // Using sqlite for testing
  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [AuditLogEntity],
          synchronize: true,
          logging: false,
        }),
        AuditLogModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    auditLogService = moduleFixture.get<AuditLogService>(AuditLogService);
    dataSource = moduleFixture.get<DataSource>(DataSource);
  });

  afterEach(async () => {
    await app.close();
  });

  describe('Audit Log Persistence and Retrieval', () => {
    it('should persist audit log entry', async () => {
      const wallet = 'test-wallet-123';
      const eventType = AuditEventType.AI_SCORING_STARTED;
      const metadata = { userId: 'user-123', provider: 'openai' };
      const description = 'AI scoring initiated';

      const result = await auditLogService.logEvent(
        wallet,
        eventType,
        metadata,
        description,
        'result-id-123',
        'AIResult',
      );

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.wallet).toBe(wallet);
      expect(result.eventType).toBe(eventType);
      expect(result.metadata).toEqual(metadata);
      expect(result.description).toBe(description);
    });

    it('should retrieve logs by wallet', async () => {
      const wallet = 'test-wallet-123';

      await auditLogService.logEvent(
        wallet,
        AuditEventType.AI_SCORING_STARTED,
        {},
        'Event 1',
      );

      await auditLogService.logEvent(
        wallet,
        AuditEventType.AI_SCORING_COMPLETED,
        {},
        'Event 2',
      );

      const logs = await auditLogService.getLogsByWallet(wallet);

      expect(logs).toHaveLength(2);
      expect(logs[0].wallet).toBe(wallet);
      expect(logs[1].wallet).toBe(wallet);
    });

    it('should retrieve logs by event type', async () => {
      const wallet1 = 'wallet-1';
      const wallet2 = 'wallet-2';
      const eventType = AuditEventType.CONTRACT_CALL_INITIATED;

      await auditLogService.logEvent(
        wallet1,
        eventType,
        {},
        'Event 1',
      );

      await auditLogService.logEvent(
        wallet2,
        eventType,
        {},
        'Event 2',
      );

      const logs = await auditLogService.getLogsByEventType(eventType);

      expect(logs).toHaveLength(2);
      expect(logs.every(log => log.eventType === eventType)).toBe(true);
    });

    it('should retrieve logs by related entity', async () => {
      const relatedEntityId = 'entity-id-123';

      await auditLogService.logEvent(
        'wallet-1',
        AuditEventType.AI_SCORING_STARTED,
        {},
        'Event 1',
        relatedEntityId,
        'AIResult',
      );

      await auditLogService.logEvent(
        'wallet-1',
        AuditEventType.AI_SCORING_COMPLETED,
        {},
        'Event 2',
        relatedEntityId,
        'AIResult',
      );

      const logs = await auditLogService.getLogsByRelatedEntity(relatedEntityId);

      expect(logs).toHaveLength(2);
      expect(logs.every(log => log.relatedEntityId === relatedEntityId)).toBe(true);
    });

    it('should fetch logs with filtering', async () => {
      const wallet = 'test-wallet';
      const eventType = AuditEventType.AI_SCORING_STARTED;

      await auditLogService.logEvent(
        wallet,
        eventType,
        {},
        'Event 1',
      );

      await auditLogService.logEvent(
        'different-wallet',
        AuditEventType.CONTRACT_CALL_INITIATED,
        {},
        'Event 2',
      );

      const result = await auditLogService.fetchAuditLogs({
        wallet,
        eventType,
      });

      expect(result.total).toBe(1);
      expect(result.logs).toHaveLength(1);
      expect(result.logs[0].wallet).toBe(wallet);
      expect(result.logs[0].eventType).toBe(eventType);
    });

    it('should fetch logs with pagination', async () => {
      const wallet = 'test-wallet';

      // Create 5 logs
      for (let i = 0; i < 5; i++) {
        await auditLogService.logEvent(
          wallet,
          AuditEventType.AI_SCORING_STARTED,
          { index: i },
          `Event ${i}`,
        );
      }

      const result1 = await auditLogService.fetchAuditLogs({
        wallet,
        limit: 2,
        offset: 0,
      });

      expect(result1.logs).toHaveLength(2);
      expect(result1.total).toBe(5);

      const result2 = await auditLogService.fetchAuditLogs({
        wallet,
        limit: 2,
        offset: 2,
      });

      expect(result2.logs).toHaveLength(2);
    });

    it('should persist multiple event types', async () => {
      const wallet = 'test-wallet';

      const eventTypes = [
        AuditEventType.AI_SCORING_STARTED,
        AuditEventType.AI_SCORING_COMPLETED,
        AuditEventType.AI_SCORING_FAILED,
        AuditEventType.CONTRACT_CALL_INITIATED,
        AuditEventType.CONTRACT_CALL_COMPLETED,
        AuditEventType.ORACLE_UPDATE_INITIATED,
      ];

      for (const eventType of eventTypes) {
        await auditLogService.logEvent(wallet, eventType, {}, eventType);
      }

      const logs = await auditLogService.getLogsByWallet(wallet);

      expect(logs).toHaveLength(eventTypes.length);
      expect(
        logs.every(log =>
          eventTypes.includes(log.eventType),
        ),
      ).toBe(true);
    });

    it('should maintain timestamp ordering', async () => {
      const wallet = 'test-wallet';

      const log1 = await auditLogService.logEvent(
        wallet,
        AuditEventType.AI_SCORING_STARTED,
        {},
        'Event 1',
      );

      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));

      const log2 = await auditLogService.logEvent(
        wallet,
        AuditEventType.AI_SCORING_COMPLETED,
        {},
        'Event 2',
      );

      const logs = await auditLogService.getLogsByWallet(wallet);

      expect(logs).toHaveLength(2);
      expect(logs[0].timestamp.getTime()).toBeGreaterThanOrEqual(
        logs[1].timestamp.getTime(),
      );
    });

    it('should store complex metadata', async () => {
      const wallet = 'test-wallet';
      const metadata = {
        userId: 'user-123',
        provider: 'openai',
        scores: {
          creditScore: 750,
          riskScore: 25,
        },
        nested: {
          level1: {
            level2: 'value',
          },
        },
        array: [1, 2, 3],
      };

      const result = await auditLogService.logEvent(
        wallet,
        AuditEventType.AI_SCORING_COMPLETED,
        metadata,
        'Scoring completed',
      );

      const retrieved = await auditLogService.getLogsByWallet(wallet);

      expect(retrieved[0].metadata).toEqual(metadata);
    });
  });
});
