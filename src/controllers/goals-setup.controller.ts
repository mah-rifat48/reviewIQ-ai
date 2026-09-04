import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GoalsSetupService } from '../services/goals-setup.service';

@ApiTags('Goals Setup')
@Controller('goals_set_up_py')
export class GoalsSetupController {
  constructor(private readonly goalsSetupService: GoalsSetupService) {}

  @Post()
  async goalsSetUpPy(@Body() payload: any) {
    return this.goalsSetupService.fetchAndSaveGoalsSetup(payload);
  }
}
