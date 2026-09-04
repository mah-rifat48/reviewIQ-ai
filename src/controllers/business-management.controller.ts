import {
  Controller,
  Get,
  Patch,
  Query,
  Body,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { BusinessStoreService } from '../db/business-store.service';
import { BusinessManagementService } from '../services/business-management.service';

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
  async updateBusinessAccountStatus(@Body() payload: any) {
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
    const matched = businesses.find(
      (b) => b.business_name.toLowerCase() === businessName.toLowerCase(),
    );

    if (!matched) {
      throw new HttpException(
        'Business not found for this user and location.',
        HttpStatus.NOT_FOUND,
      );
    }

    return {
      user_id: userId,
      business_name: matched.business_name || businessName,
      location: matched.business_address || location,
      place_id: matched.place_id,
      report_frequency: reportFrequency,
      rating_drop_detected: false,
      current_rating: matched.place_payload?.rating || 0,
      previous_rating: matched.place_payload?.rating || 0,
    };
  }

  @Get('management/details')
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
