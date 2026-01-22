import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { SimulatorModule } from './simulator/simulator.module';

@Module({
  imports: [SimulatorModule],
  controllers: [AppController],
})
export class AppModule {}