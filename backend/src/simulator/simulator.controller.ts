import { Controller, Post, Get, Body, Param, NotFoundException } from '@nestjs/common';
import { SimulatorService, SimulationRequest } from './simulator.service';

@Controller('simulate')
export class SimulatorController {
  constructor(private readonly simulatorService: SimulatorService) {}

  @Post('run')
  runSimulation(@Body() request: SimulationRequest) {
    return this.simulatorService.runSimulation(request);
  }

  @Get(':id')
  getSimulation(@Param('id') id: string) {
    const simulation = this.simulatorService.getSimulation(id);
    if (!simulation) {
      throw new NotFoundException('Simulation not found');
    }
    return simulation;
  }
}