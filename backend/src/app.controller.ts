import { Controller, Get } from '@nestjs/common';

@Controller('api')
export class AppController {
  @Get('health')
  getHealth() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'chenaikit-backend',
      message: 'Backend implementation pending - see backend issue templates'
    };
  }
}