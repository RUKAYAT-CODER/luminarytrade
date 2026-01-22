import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

export interface SimulationRequest {
  scenario: 'credit-score' | 'fraud-detect';
  data: any;
  seed?: number;
}

export interface SimulationResult {
  id: string;
  result: any;
  events: any[];
  timestamp: string;
}

@Injectable()
export class SimulatorService {
  private simulations: Map<string, SimulationResult> = new Map();

  runSimulation(request: SimulationRequest): SimulationResult {
    const id = randomUUID();
    const timestamp = new Date().toISOString();
    const events: any[] = [];

    let result: any;

    if (request.scenario === 'credit-score') {
      // Mock deterministic credit scoring
      const score = Math.floor((request.data.balance || 0) * 0.1 + (request.data.history || 0) * 10 + (request.seed || 0) % 100);
      result = { creditScore: Math.min(850, Math.max(300, score)) };
      events.push({ type: 'credit-calculation', data: request.data, score });
    } else if (request.scenario === 'fraud-detect') {
      // Mock deterministic fraud detection
      const isFraud = (request.data.amount || 0) > 10000 || (request.seed || 0) % 10 === 0;
      result = { isFraud };
      events.push({ type: 'fraud-check', data: request.data, detected: isFraud });
    } else {
      throw new Error('Unknown scenario');
    }

    const simulationResult = { id, result, events, timestamp };
    this.simulations.set(id, simulationResult);
    return simulationResult;
  }

  getSimulation(id: string): SimulationResult | undefined {
    return this.simulations.get(id);
  }
}