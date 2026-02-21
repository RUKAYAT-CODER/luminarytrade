import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OracleController } from './oracle.controller';
import { OracleService } from './oracle.service';
import { OracleSnapshot } from './entities/oracle-snapshot.entity';
import { OracleLatestPrice } from './entities/oracle-latest.entity';
import { TransactionModule } from '../transaction/transaction.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([OracleSnapshot, OracleLatestPrice]),
    TransactionModule,
  ],
  controllers: [OracleController],
  providers: [OracleService],
  exports: [OracleService],
})
export class OracleModule {}