import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GooglePlacesService } from '../services/google-places.service';

@ApiTags('Goals Setup')
@Controller('goals_set_up_py')
export class GoalsSetupController {
  constructor(private readonly googlePlacesService: GooglePlacesService) {}

  @Post()
  async goalsSetUpPy(@Body() payload: any) {
    return this.googlePlacesService.fetchAndSaveSetup(payload);
  }
}
