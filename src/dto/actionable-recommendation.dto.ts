import { ApiProperty } from '@nestjs/swagger';

export class ActionableRecommendationStatusDto {
  @ApiProperty({ example: 'user_123' })
  user_id: string;

  @ApiProperty({ example: 'Staff_training' })
  title: string;

  @ApiProperty({ example: 'read', enum: ['read', 'unread'] })
  status: string;
}
