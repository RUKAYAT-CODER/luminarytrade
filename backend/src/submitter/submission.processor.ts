import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Submission, SubmissionStatus } from './entities/submission.entity';
import { StellarService } from './stellar.service';
import { AuditLogService } from '../audit/audit-log.service';
import { AuditEventType } from '../audit/entities/audit-log.entity';

@Processor('submissions')
export class SubmissionProcessor {
  private readonly logger = new Logger(SubmissionProcessor.name);

  constructor(
    @InjectRepository(Submission)
    private submissionRepository: Repository<Submission>,
    private stellarService: StellarService,
    private auditLogService: AuditLogService,
  ) {}

  @Process('submit-single')
  async handleSingleSubmission(job: Job) {
    const { submissionId } = job.data;
    this.logger.log(`Processing submission: ${submissionId}`);

    const submission = await this.submissionRepository.findOne({
      where: { id: submissionId },
    });

    if (!submission) {
      this.logger.error(`Submission not found: ${submissionId}`);
      return;
    }

    try {
      submission.status = SubmissionStatus.PROCESSING;
      await this.submissionRepository.save(submission);

      // Log audit event for contract call initiated
      const wallet = submission.payload.wallet || 'unknown';
      await this.auditLogService.logEvent(
        wallet,
        AuditEventType.CONTRACT_CALL_INITIATED,
        {
          submissionId: submission.id,
          payload: submission.payload,
          idempotencyKey: submission.idempotencyKey,
        },
        `Contract call initiated for submission ${submissionId}`,
        submission.id,
        'Submission',
      );

      // Submit to Stellar
      const txHash = await this.stellarService.submitTransaction(
        submission.payload,
      );

      // Mark as completed
      submission.status = SubmissionStatus.COMPLETED;
      submission.transactionHash = txHash;
      submission.completedAt = new Date();
      await this.submissionRepository.save(submission);

      // Log audit event for contract call completed
      await this.auditLogService.logEvent(
        wallet,
        AuditEventType.CONTRACT_CALL_COMPLETED,
        {
          submissionId: submission.id,
          transactionHash: txHash,
          idempotencyKey: submission.idempotencyKey,
        },
        `Contract call completed for submission ${submissionId}`,
        submission.id,
        'Submission',
      );

      this.logger.log(`Submission completed: ${submissionId} -> ${txHash}`);
    } catch (error) {
      this.logger.error(`Submission failed: ${error.message}`);

      const wallet = submission.payload.wallet || 'unknown';
      submission.retryCount++;
      submission.errorMessage = error.message;

      if (submission.retryCount >= submission.maxRetries) {
        submission.status = SubmissionStatus.FAILED;
        this.logger.error(`Submission permanently failed: ${submissionId}`);

        // Log audit event for contract call failed
        await this.auditLogService.logEvent(
          wallet,
          AuditEventType.CONTRACT_CALL_FAILED,
          {
            submissionId: submission.id,
            errorMessage: error.message,
            retryCount: submission.retryCount,
            idempotencyKey: submission.idempotencyKey,
          },
          `Contract call permanently failed for submission ${submissionId}: ${error.message}`,
          submission.id,
          'Submission',
        );
      } else {
        submission.status = SubmissionStatus.RETRYING;
        // Re-queue with exponential backoff
        const delay = Math.pow(2, submission.retryCount) * 1000;
        throw new Error(`Retry needed with delay ${delay}ms`);
      }

      await this.submissionRepository.save(submission);
    }
  }

  @Process('submit-batch')
  async handleBatchSubmission(job: Job) {
    const { submissionIds } = job.data;
    this.logger.log(`Processing batch of ${submissionIds.length} submissions`);

    const submissions = await this.submissionRepository.findByIds(submissionIds);
    const payloads = submissions.map(s => s.payload);

    try {
      const txHashes = await this.stellarService.submitBatch(payloads);

      // Update submissions
      for (let i = 0; i < submissions.length; i++) {
        const submission = submissions[i];
        const txHash = txHashes[i];
        const wallet = submission.payload.wallet || 'unknown';

        if (txHash) {
          submission.status = SubmissionStatus.COMPLETED;
          submission.transactionHash = txHash;
          submission.completedAt = new Date();

          // Log audit event for each completed batch submission
          await this.auditLogService.logEvent(
            wallet,
            AuditEventType.CONTRACT_CALL_COMPLETED,
            {
              submissionId: submission.id,
              transactionHash: txHash,
              idempotencyKey: submission.idempotencyKey,
              batchSize: submissionIds.length,
            },
            `Batch contract call completed for submission ${submission.id}`,
            submission.id,
            'Submission',
          );
        } else {
          submission.status = SubmissionStatus.FAILED;
          submission.errorMessage = 'Batch submission failed';

          // Log audit event for each failed batch submission
          await this.auditLogService.logEvent(
            wallet,
            AuditEventType.CONTRACT_CALL_FAILED,
            {
              submissionId: submission.id,
              errorMessage: 'Batch submission failed',
              idempotencyKey: submission.idempotencyKey,
              batchSize: submissionIds.length,
            },
            `Batch contract call failed for submission ${submission.id}`,
            submission.id,
            'Submission',
          );
        }

        await this.submissionRepository.save(submission);
      }

      this.logger.log(`Batch completed`);
    } catch (error) {
      this.logger.error(`Batch submission failed: ${error.message}`);
      throw error;
    }
  }
}
