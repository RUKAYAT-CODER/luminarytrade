import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogController } from './audit-log.controller';
import { AuditLogService } from './audit-log.service';
import { AuditLogEntity, AuditEventType } from './entities/audit-log.entity';

describe('AuditLogController', () => {
  let controller: AuditLogController;
  let service: AuditLogService;

  const mockAuditLog: AuditLogEntity = {
    id: 'test-id',
    wallet: 'test-wallet',
    eventType: AuditEventType.AI_SCORING_STARTED,
    metadata: { test: 'data' },
    description: 'Test event',
    relatedEntityId: 'entity-id',
    relatedEntityType: 'AIResult',
    timestamp: new Date(),
  };

  const mockAuditLogService = {
    fetchAuditLogs: jest.fn().mockResolvedValue({ logs: [mockAuditLog], total: 1 }),
    getLogsByWallet: jest.fn().mockResolvedValue([mockAuditLog]),
    getLogsByEventType: jest.fn().mockResolvedValue([mockAuditLog]),
    getLogsByRelatedEntity: jest.fn().mockResolvedValue([mockAuditLog]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditLogController],
      providers: [
        {
          provide: AuditLogService,
          useValue: mockAuditLogService,
        },
      ],
    }).compile();

    controller = module.get<AuditLogController>(AuditLogController);
    service = module.get<AuditLogService>(AuditLogService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /audit-logs', () => {
    it('should return audit logs', async () => {
      const query = { wallet: 'test-wallet', limit: 50, offset: 0 };

      const result = await controller.getAuditLogs(query);

      expect(service.fetchAuditLogs).toHaveBeenCalledWith(query);
      expect(result).toEqual({ logs: [mockAuditLog], total: 1 });
    });

    it('should call fetchAuditLogs with default query', async () => {
      const defaultQuery = { limit: 50, offset: 0 };

      await controller.getAuditLogs(defaultQuery);

      expect(service.fetchAuditLogs).toHaveBeenCalledWith(defaultQuery);
    });
  });

  describe('GET /audit-logs/wallet/:wallet', () => {
    it('should return logs by wallet', async () => {
      const wallet = 'test-wallet';

      const result = await controller.getLogsByWallet(wallet, 50);

      expect(service.getLogsByWallet).toHaveBeenCalledWith(wallet, 50);
      expect(result).toEqual([mockAuditLog]);
    });

    it('should apply custom limit', async () => {
      const wallet = 'test-wallet';

      await controller.getLogsByWallet(wallet, 100);

      expect(service.getLogsByWallet).toHaveBeenCalledWith(wallet, 100);
    });

    it('should apply default limit', async () => {
      const wallet = 'test-wallet';

      await controller.getLogsByWallet(wallet);

      expect(service.getLogsByWallet).toHaveBeenCalledWith(wallet, 50);
    });
  });

  describe('GET /audit-logs/event-type/:eventType', () => {
    it('should return logs by event type', async () => {
      const eventType = AuditEventType.AI_SCORING_COMPLETED;

      const result = await controller.getLogsByEventType(eventType, 50);

      expect(service.getLogsByEventType).toHaveBeenCalledWith(eventType, 50);
      expect(result).toEqual([mockAuditLog]);
    });

    it('should apply custom limit', async () => {
      const eventType = AuditEventType.AI_SCORING_COMPLETED;

      await controller.getLogsByEventType(eventType, 100);

      expect(service.getLogsByEventType).toHaveBeenCalledWith(eventType, 100);
    });

    it('should apply default limit', async () => {
      const eventType = AuditEventType.AI_SCORING_COMPLETED;

      await controller.getLogsByEventType(eventType);

      expect(service.getLogsByEventType).toHaveBeenCalledWith(eventType, 50);
    });
  });

  describe('GET /audit-logs/entity/:relatedEntityId', () => {
    it('should return logs by related entity', async () => {
      const relatedEntityId = 'entity-id';

      const result = await controller.getLogsByEntity(relatedEntityId, 50);

      expect(service.getLogsByRelatedEntity).toHaveBeenCalledWith(
        relatedEntityId,
        50,
      );
      expect(result).toEqual([mockAuditLog]);
    });

    it('should apply custom limit', async () => {
      const relatedEntityId = 'entity-id';

      await controller.getLogsByEntity(relatedEntityId, 100);

      expect(service.getLogsByRelatedEntity).toHaveBeenCalledWith(
        relatedEntityId,
        100,
      );
    });

    it('should apply default limit', async () => {
      const relatedEntityId = 'entity-id';

      await controller.getLogsByEntity(relatedEntityId);

      expect(service.getLogsByRelatedEntity).toHaveBeenCalledWith(
        relatedEntityId,
        50,
      );
    });
  });
});
