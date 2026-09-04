import { ApiProperty } from '@nestjs/swagger';

export class BusinessAccountStatusRequestDto {
  @ApiProperty({ example: 'user_123' })
  user_id: string;

  @ApiProperty({ example: 'Bata' })
  business_name: string;

  @ApiProperty({ example: 'suspend', enum: ['suspend', 'unsuspend', 'pause', 'resume', 'activate'] })
  action: string;
}
