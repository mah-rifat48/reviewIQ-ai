import {
  Controller,
  Get,
  Patch,
  Query,
  Body,
  HttpCode,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBody, ApiResponse } from '@nestjs/swagger';
import { BusinessStoreService } from '../db/business-store.service';
import { GooglePlacesService } from '../services/google-places.service';
import { UpdateBusinessProfileDto } from '../dto/business-profile.dto';

@ApiTags('Business Profile')
@Controller('business-profile')
export class BusinessProfileController {
  constructor(
    private readonly businessStore: BusinessStoreService,
    private readonly googlePlacesService: GooglePlacesService,
  ) {}

  @Get()
  @ApiResponse({ status: 200, description: 'Successful Response' })
  @ApiResponse({ status: 404, description: 'Business not found.' })
  async getBusinessProfileRoute(
    @Query('user_id') userId: string,
    @Query('business_name') businessName: string,
    @Query('location') location: string,
  ) {
    const result = await this.businessStore.getBusinessProfile(
      userId,
      businessName,
      location,
    );

    if (!result) {
      throw new HttpException('Business not found.', HttpStatus.NOT_FOUND);
    }
    return result;
  }

  @Patch()
  @HttpCode(HttpStatus.OK)
  @ApiBody({ type: UpdateBusinessProfileDto, required: false })
  @ApiResponse({ status: 200, description: 'Successful Response' })
  @ApiResponse({ status: 404, description: 'Business not found.' })
  async updateBusinessProfileRoute(
    @Query('user_id') userId: string,
    @Query('existing_business_name') existingBusinessName: string,
    @Query('existing_location') existingLocation: string,
    @Body() body: UpdateBusinessProfileDto = {},
    @Query('new_business_name') qNewBusinessName?: string,
    @Query('category') qCategory?: string,
    @Query('new_location') qNewLocation?: string,
    @Query('map_url') qMapUrl?: string,
    @Query('phone_no') qPhoneNo?: string,
    @Query('website') qWebsite?: string,
  ) {
    const newBusinessName = body.new_business_name || qNewBusinessName;
    const category = body.category || qCategory;
    const newLocation = body.new_location || qNewLocation;
    const mapUrl = body.map_url || qMapUrl;
    const phoneNo = body.phone_no || qPhoneNo;
    const website = body.website || qWebsite;

    let placeId: string | undefined = undefined;
    if (mapUrl) {
      try {
        placeId = await this.googlePlacesService.expandAndExtractPlaceId(mapUrl);
      } catch {
        // keep undefined
      }
    }

    const result = await this.businessStore.updateBusinessProfile(
      userId,
      existingBusinessName,
      existingLocation,
      {
        new_business_name: newBusinessName,
        category,
        new_location: newLocation,
        place_id: placeId,
        phone_no: phoneNo,
        website,
      },
    );

    if (!result) {
      throw new HttpException('Business not found.', HttpStatus.NOT_FOUND);
    }
    return result;
  }
}
