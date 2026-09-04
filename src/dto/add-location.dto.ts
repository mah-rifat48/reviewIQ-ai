import { ApiProperty } from '@nestjs/swagger';

export class AddBusinessLocationRequestDto {
  @ApiProperty({ example: 'user_123' })
  user_id: string;

  @ApiProperty({ example: 'Bata' })
  business_name: string;

  @ApiProperty({ example: 'https://maps.google.com/?q=Bata+Gulshan' })
  maps_url: string;

  @ApiProperty({ example: 'Gulshan', required: false })
  location?: string;

  @ApiProperty({ example: '01712-200432', required: false })
  phone_no?: string;

  @ApiProperty({ example: 'http://www.batabd.com/', required: false })
  website?: string;
}
