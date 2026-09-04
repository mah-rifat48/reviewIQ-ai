import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiResponse, ApiBody } from '@nestjs/swagger';
import { GoalsSetupService } from '../services/goals-setup.service';
import { GoalsSetupRequestDto } from '../dto/goals-setup.dto';

@ApiTags('Goals Setup')
@Controller('goals_set_up_py')
export class GoalsSetupController {
  constructor(private readonly goalsSetupService: GoalsSetupService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiBody({
    type: GoalsSetupRequestDto,
    description: 'Goals setup request body',
    examples: {
      default: {
        summary: 'Sample Goals Setup Payload',
        value: {
          user_id: 'user_123',
          businesses: [
            {
              business_name: 'Abc Coffee House',
              location: 'Uttara, Dhaka',
              competitors_urls: [
                'map.google.com/CoffeeBean',
                'maps.google.com/Starbucks',
              ],
              goals: [
                'improve_customer_satisfaction',
                'improve_service_speed',
                'increase_ratings',
              ],
            },
            {
              business_name: 'XYZ Burger',
              location: 'Banani, Dhaka',
              competitors_urls: [
                'maps.google.com/BurgerKing',
                'maps.google.com/McDonalds',
              ],
              goals: [
                'increase_sales',
                'improve_delivery_time',
              ],
            },
          ],
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Successful Response' })
  @ApiResponse({ status: 404, description: 'Business not found' })
  async goalsSetUpPy(@Body() payload: GoalsSetupRequestDto) {
    return this.goalsSetupService.fetchAndSaveGoalsSetup(payload);
  }
}
