import { ApiProperty } from '@nestjs/swagger';

export class BusinessLocationInputDto {
  @ApiProperty({
    example: 'https://maps.google.com/?q=Bata+Gulshan',
    required: false,
  })
  google_maps_url?: string;

  @ApiProperty({
    example: 'Gulshan',
    required: false,
  })
  address_or_city?: string;
}

export class BusinessInputDto {
  @ApiProperty({ example: 'Bata' })
  name: string;

  @ApiProperty({ example: 'Footwear' })
  category: string;

  @ApiProperty({ example: '01712-200432', required: false })
  phone_no?: string;

  @ApiProperty({ example: 'http://www.batabd.com/', required: false })
  website?: string;

  @ApiProperty({ type: [BusinessLocationInputDto] })
  locations: BusinessLocationInputDto[];
}

export class BusinessSetupRequestDto {
  @ApiProperty({ example: 'user_123' })
  user_id: string;

  @ApiProperty({ example: 'monthly', required: false })
  report_frequency?: string;

  @ApiProperty({ example: ['increase_sales'], required: false })
  goals?: string[];

  @ApiProperty({ type: [BusinessInputDto] })
  businesses: BusinessInputDto[];
}
