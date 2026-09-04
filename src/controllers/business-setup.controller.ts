import {
  Controller,
  Post,
  Patch,
  Get,
  Delete,
  Body,
  Query,
  Param,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GooglePlacesService } from '../services/google-places.service';
import { BusinessStoreService } from '../db/business-store.service';
import { UserDataStoreService } from '../db/user-data-store.service';
import { businessMatches } from '../utils/business-matching';

@ApiTags('Business Setup')
@Controller('businesses')
export class BusinessSetupController {
  constructor(
    private readonly googlePlacesService: GooglePlacesService,
    private readonly businessStore: BusinessStoreService,
    private readonly userDataStore: UserDataStoreService,
  ) {}

  @Post('fetch')
  async fetchBusinessData(@Body() payload: any) {
    return this.googlePlacesService.fetchAndSaveSetup(payload);
  }

  @Patch('locations')
  async addBusinessLocation(@Body() payload: any) {
    return this.googlePlacesService.addBusinessLocation(payload);
  }

  @Get()
  async listBusinesses(@Query('user_id') userId: string) {
    const businesses = await this.businessStore.getUserBusinesses(userId);
    return { user_id: userId, businesses };
  }

  @Delete()
  async deleteBusinessForUser(
    @Query('user_id') userId: string,
    @Query('business_name') businessName: string,
    @Query('location') location?: string,
  ) {
    const result = await this.businessStore.deleteUserBusiness(
      userId,
      businessName,
      location,
    );

    if (!result) {
      throw new HttpException('Business not found for this user.', HttpStatus.NOT_FOUND);
    }
    return result;
  }

  @Get('user/:user_id')
  async listBusinessesForUser(@Param('user_id') userId: string) {
    const businesses = await this.businessStore.getUserBusinesses(userId);
    return { user_id: userId, businesses };
  }

  @Delete('user/:user_id')
  async deleteBusinessesForUser(@Param('user_id') userId: string) {
    const result = await this.userDataStore.deleteUserData(userId);
    if (result.deleted_count === 0) {
      throw new HttpException('No data found for this user.', HttpStatus.NOT_FOUND);
    }
    return result;
  }

  @Get('names')
  async listBusinessNames(@Query('user_id') userId: string) {
    const businesses = await this.businessStore.getUserBusinesses(userId);
    const names = businesses
      .map((b) => b.business_name)
      .filter(Boolean);
    return { user_id: userId, business_names: names };
  }

  @Get('location-names')
  async listLocationNames(@Query('user_id') userId: string) {
    const businesses = await this.businessStore.getUserBusinesses(userId);
    const locationNames: string[] = [];
    const seen = new Set<string>();

    for (const b of businesses) {
      const loc =
        b.input_address ||
        b.raw_input?.location?.address_or_city ||
        b.business_address ||
        b.place_payload?.formatted_address;
      const key = b.place_id || (loc || '').toLowerCase().trim();

      if (key && seen.has(key)) continue;
      if (key) seen.add(key);
      if (loc) locationNames.push(loc);
    }

    return {
      total_location: locationNames.length,
      location_name: locationNames,
    };
  }

  @Get('locations')
  async getBusinessLocations(
    @Query('user_id') userId: string,
    @Query('business_name') businessName: string,
  ) {
    const businesses = await this.businessStore.getUserBusinesses(userId);
    const matched = businesses.filter((b) =>
      businessMatches(b, businessName),
    );

    if (matched.length === 0) {
      throw new HttpException('Business not found', HttpStatus.NOT_FOUND);
    }

    const locations: any[] = [];
    const seenPlaceIds = new Set<string>();

    for (const b of matched) {
      const placeId = b.place_id;
      if (placeId && seenPlaceIds.has(placeId)) continue;
      if (placeId) seenPlaceIds.add(placeId);

      const rawLoc = b.raw_input?.location || {};
      locations.push({
        google_maps_url:
          rawLoc.google_maps_url ||
          (placeId
            ? `https://www.google.com/maps/place/?q=place_id:${placeId}`
            : null),
        address_or_city: b.input_address || rawLoc.address_or_city,
        formatted_address: b.business_address,
        place_id: placeId,
      });
    }

    return {
      user_id: userId,
      business_name: matched[0].business_name,
      locations,
    };
  }
}
