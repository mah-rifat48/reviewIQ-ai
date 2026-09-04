import { ApiProperty } from '@nestjs/swagger';

export class BusinessGoalDto {
  @ApiProperty({
    example: 'Abc Coffee House',
    description: 'Name of the business',
  })
  business_name: string;

  @ApiProperty({
    example: 'Uttara, Dhaka',
    description: 'Address or city location of the business',
  })
  location: string;

  @ApiProperty({
    example: [
      'map.google.com/CoffeeBean',
      'maps.google.com/Starbucks',
    ],
    description: 'Google Maps URLs or names of competitors',
  })
  competitors_urls: string[];

  @ApiProperty({
    example: [
      'improve_customer_satisfaction',
      'improve_service_speed',
      'increase_ratings',
    ],
    description: 'Goals selected for this business location',
  })
  goals: string[];
}

export class GoalsSetupRequestDto {
  @ApiProperty({
    example: 'user_123',
    description: 'User ID',
  })
  user_id: string;

  @ApiProperty({
    type: [BusinessGoalDto],
    description: 'List of business goals to setup',
  })
  businesses: BusinessGoalDto[];
}
