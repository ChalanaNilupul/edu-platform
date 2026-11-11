import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Check API availability' })
  @ApiResponse({
    status: 200,
    description: 'API is running.',
  })
  check() {
    return {
      status: 'ok',
      service: 'EduPlatform API',
      timestamp: new Date().toISOString(),
    };
  }
}
