import { ApiProperty } from '@nestjs/swagger';

export class UpdateBusinessProfileDto {
  @ApiProperty({ example: 'Bata Store', required: false })
  new_business_name?: string;

  @ApiProperty({ example: 'Footwear', required: false })
  category?: string;

  @ApiProperty({ example: 'Gulshan, Dhaka', required: false })
  new_location?: string;

  @ApiProperty({ example: 'https://maps.google.com/?q=Bata+Gulshan', required: false })
  map_url?: string;

  @ApiProperty({ example: '01712-200432', required: false })
  phone_no?: string;

  @ApiProperty({ example: 'http://www.batabd.com/', required: false })
  website?: string;
}
