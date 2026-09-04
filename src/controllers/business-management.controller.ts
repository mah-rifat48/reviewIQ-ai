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
import { BusinessManagementService } from '../services/business-management.service';
import { businessMatches } from '../utils/business-matching';
import { BusinessAccountStatusRequestDto } from '../dto/business-management.dto';

@ApiTags('Business Management')
@Controller('businesses')
export class BusinessManagementController {
  constructor(
    private readonly businessStore: BusinessStoreService,
    private readonly businessManagementService: BusinessManagementService,
  ) {}

  @Get('management')
  async businessManagement(@Query('user_id') userId?: string) {
    return this.businessManagementService.buildBusinessManagement(
      userId,
      (ref) => `/insights/place-photo?photo_reference=${encodeURIComponent(ref)}`,
    );
  }

  @Patch('management')
  @HttpCode(HttpStatus.OK)
  @ApiBody({ type: BusinessAccountStatusRequestDto })
  @ApiResponse({ status: 200, description: 'Successful Response' })
  @ApiResponse({ status: 404, description: 'Business not found for this user.' })
  async updateBusinessAccountStatus(@Body() payload: BusinessAccountStatusRequestDto) {
    const result = await this.businessStore.updateAccountStatus(
      payload.user_id,
      payload.business_name,
      payload.action,
    );

    if (!result) {
      throw new HttpException('Business not found for this user.', HttpStatus.NOT_FOUND);
    }
    return result;
  }

  @Get('management/rating-drop')
  async businessRatingDrop(
    @Query('user_id') userId: string,
    @Query('business_name') businessName: string,
    @Query('location') location: string,
    @Query('report_frequency') reportFrequency: string,
  ) {
    const businesses = await this.businessStore.getUserBusinesses(userId);
    let matched = businesses.find((b) => businessMatches(b, businessName, location));
    if (!matched) {
      matched = businesses.find((b) => businessMatches(b, businessName));
    }
    if (!matched && businesses.length > 0) {
      matched = businesses[0];
    }

    return {
      user_id: userId,
      business_name: matched?.business_name || businessName || 'Business',
      location: matched?.business_address || location || 'Location',
      place_id: matched?.place_id || 'default_place',
      report_frequency: reportFrequency || 'monthly',
      rating_drop_detected: false,
      current_rating: matched?.place_payload?.rating || 4.5,
      previous_rating: matched?.place_payload?.rating || 4.5,
    };
  }

  @Get('management/details')
  async businessManagementDetails(
    @Query('overlook') overlook: string,
    @Query('business_name') businessName?: string,
    @Query('user_id') userId?: string,
  ) {
    return this.businessManagementService.buildBusinessManagementDetail(
      businessName,
      userId,
      overlook,
      (ref) => `/insights/place-photo?photo_reference=${encodeURIComponent(ref)}`,
    );
  }

  @Get('management/detail')
  async businessManagementDetail(
    @Query('overlook') overlook: string,
    @Query('business_name') businessName?: string,
    @Query('user_id') userId?: string,
  ) {
    return this.businessManagementService.buildBusinessManagementDetail(
      businessName,
      userId,
      overlook,
      (ref) => `/insights/place-photo?photo_reference=${encodeURIComponent(ref)}`,
    );
  }

  @Get('management/categories')
  async businessCategories() {
    return this.businessManagementService.buildBusinessCategories();
  }
}
