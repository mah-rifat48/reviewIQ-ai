import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { decode } from 'html-entities';
import { PlaceStoreService } from '../db/place-store.service';
import { BusinessContextStoreService } from '../db/business-context-store.service';
import { BusinessStoreService } from '../db/business-store.service';

const TEXT_SEARCH_NEW_URL = 'https://places.googleapis.com/v1/places:searchText';
const NEARBY_SEARCH_NEW_URL = 'https://places.googleapis.com/v1/places:searchNearby';
const DETAILS_NEW_URL = 'https://places.googleapis.com/v1/places/{place_id}';

const PLACE_DETAILS_FIELD_MASK = [
  'id',
  'name',
  'displayName',
  'businessStatus',
  'types',
  'formattedAddress',
  'rating',
  'userRatingCount',
  'priceLevel',
  'regularOpeningHours',
  'nationalPhoneNumber',
  'internationalPhoneNumber',
  'websiteUri',
  'location',
  'viewport',
  'accessibilityOptions',
  'servesVegetarianFood',
  'takeout',
  'dineIn',
  'delivery',
  'photos',
  'reviews',
].join(',');

const PRICE_LEVELS: Record<string, number> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

@Injectable()
export class GooglePlacesService {
  private apiKey: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly placeStore: PlaceStoreService,
    private readonly businessContextStore: BusinessContextStoreService,
    private readonly businessStore: BusinessStoreService,
  ) {
    this.apiKey =
      this.configService.get<string>('GOOGLE_PLACE_API') ||
      this.configService.get<string>('GOOGLE_PLACES_API_KEY');
  }

  private get headers(): Record<string, string> {
    if (!this.apiKey) {
      throw new HttpException(
        'Set GOOGLE_PLACE_API or GOOGLE_PLACES_API_KEY in .env',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    return {
      'X-Goog-Api-Key': this.apiKey,
    };
  }

  private cleanReviewText(text?: string): string {
    if (!text) return '';
    const unescaped = decode(text);
    return unescaped.replace(/<[^>]+>/g, '').trim();
  }

  private placeIdFromResource(value?: string): string | null {
    if (!value) return null;
    const parts = value.split('/');
    return parts[parts.length - 1];
  }

  private priceLevelToInt(value: any): number | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return value;
    return PRICE_LEVELS[value] ?? null;
  }

  async expandAndExtractPlaceId(googleMapsUrl: string): Promise<string> {
    let currentUrl = googleMapsUrl.trim();
    if (currentUrl.includes('google.com/maps/place/')) {
      const match = currentUrl.match(/place_id:([a-zA-Z0-9_-]+)/);
      if (match) return match[1];
    }

    try {
      const res = await axios.get(currentUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        },
        maxRedirects: 10,
        timeout: 10000,
      });
      const finalUrl = res.request?.res?.responseUrl || currentUrl;

      let match = finalUrl.match(/place_id:([a-zA-Z0-9_-]+)/);
      if (match) return match[1];

      match = res.data.match(/1s(ChIJ[a-zA-Z0-9_-]+)/);
      if (match) return match[1];

      match = res.data.match(/!1s(0x[0-9a-fA-F]+:0x[0-9a-fA-F]+)/);
      if (match) return match[1];
    } catch {
      // Fallback
    }

    throw new HttpException('Could not extract place_id from Google Maps URL', HttpStatus.BAD_REQUEST);
  }

  async searchPlaceId(textQuery: string, locationBias?: any): Promise<string> {
    const payload: any = { textQuery };
    if (locationBias) {
      payload.locationBias = locationBias;
    }

    try {
      const res = await axios.post(TEXT_SEARCH_NEW_URL, payload, {
        headers: {
          ...this.headers,
          'X-Goog-FieldMask': 'places.id',
          'Content-Type': 'application/json',
        },
      });

      const places = res.data?.places || [];
      if (places.length === 0) {
        throw new HttpException(`Place not found for query '${textQuery}'`, HttpStatus.NOT_FOUND);
      }
      return this.placeIdFromResource(places[0].id) || places[0].id;
    } catch (err: any) {
      if (err instanceof HttpException) throw err;
      throw new HttpException(
        err.response?.data?.error?.message || `Google Place search failed: ${err.message}`,
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  async fetchPlaceDetails(placeId: string): Promise<any> {
    const cleanId = this.placeIdFromResource(placeId) || placeId;
    const url = DETAILS_NEW_URL.replace('{place_id}', cleanId);

    try {
      const res = await axios.get(url, {
        headers: {
          ...this.headers,
          'X-Goog-FieldMask': PLACE_DETAILS_FIELD_MASK,
        },
      });

      const data = res.data;
      const normalizedReviews = (data.reviews || []).map((r: any) => ({
        author_name: r.authorAttribution?.displayName || r.author_name || 'Anonymous',
        rating: r.rating,
        text: this.cleanReviewText(r.originalText?.text || r.text),
        time: r.publishTime ? Math.floor(new Date(r.publishTime).getTime() / 1000) : r.time || 0,
        relative_time_description: r.relativePublishTimeDescription || r.relative_time_description || '',
        language: r.originalText?.languageCode || r.language || 'en',
      }));

      const photos = (data.photos || []).map((p: any) => ({
        height: p.heightPx || p.height,
        width: p.widthPx || p.width,
        photo_reference: p.name || p.photo_reference,
        html_attributions: p.authorAttributions
          ? p.authorAttributions.map((a: any) => a.displayName)
          : p.html_attributions || [],
      }));

      return {
        place_id: cleanId,
        name: data.displayName?.text || data.name,
        business_status: data.businessStatus,
        types: data.types || [],
        formatted_address: data.formattedAddress,
        rating: data.rating,
        user_ratings_total: data.userRatingCount,
        price_level: this.priceLevelToInt(data.priceLevel),
        opening_hours_open_now: data.regularOpeningHours?.openNow ? 1 : 0,
        opening_hours_weekday_text: data.regularOpeningHours?.weekdayDescriptions || [],
        formatted_phone_number: data.nationalPhoneNumber || data.formattedPhoneNumber,
        international_phone_number: data.internationalPhoneNumber,
        website: data.websiteUri || data.website,
        location: data.location,
        photos,
        reviews: normalizedReviews,
      };
    } catch (err: any) {
      throw new HttpException(
        err.response?.data?.error?.message || `Failed to fetch place details for ${placeId}`,
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  async searchCompetitorPlaces(location: any, primaryTypes: string[]): Promise<any[]> {
    if (!location?.latitude || !location?.longitude) return [];

    const payload = {
      includedTypes: primaryTypes.length > 0 ? primaryTypes : ['restaurant'],
      maxResultCount: 10,
      locationRestriction: {
        circle: {
          center: {
            latitude: location.latitude,
            longitude: location.longitude,
          },
          radius: 5000.0,
        },
      },
    };

    try {
      const res = await axios.post(NEARBY_SEARCH_NEW_URL, payload, {
        headers: {
          ...this.headers,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.rating,places.userRatingCount,places.priceLevel',
          'Content-Type': 'application/json',
        },
      });

      return (res.data?.places || []).map((p: any) => {
        const id = this.placeIdFromResource(p.id) || p.id;
        return {
          place_id: id,
          name: p.displayName?.text || p.name,
          rating: p.rating || 0,
          reviews: p.userRatingCount || 0,
          price_level: this.priceLevelToInt(p.priceLevel) || 2,
          map_url: `https://www.google.com/maps/place/?q=place_id:${id}`,
        };
      });
    } catch {
      return [];
    }
  }

  async fetchAndSaveSetup(payload: any): Promise<any> {
    const userId = payload.user_id;
    const reportFrequency = payload.report_frequency;
    const rawGoals = payload.goals || [];
    const goals = Array.isArray(rawGoals) ? rawGoals : [rawGoals];
    const businessesInput = payload.businesses || [];

    const savedBusinesses: any[] = [];
    const placeIds: string[] = [];

    for (const bInput of businessesInput) {
      let placeId = bInput.place_id;
      const rawLoc = bInput.location || {};

      if (!placeId) {
        if (rawLoc.google_maps_url) {
          placeId = await this.expandAndExtractPlaceId(rawLoc.google_maps_url);
        } else if (rawLoc.address_or_city) {
          const query = `${bInput.business_name} ${rawLoc.address_or_city}`;
          placeId = await this.searchPlaceId(query);
        }
      }

      if (!placeId) {
        throw new HttpException(
          `Could not determine place_id for business ${bInput.business_name}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      const placeDetails = await this.fetchPlaceDetails(placeId);
      await this.placeStore.upsertPlaceData(placeDetails);
      placeIds.push(placeId);

      const savedB = {
        user_id: userId,
        business_name: bInput.business_name,
        business_category: bInput.business_category || placeDetails.types?.[0],
        business_address: placeDetails.formatted_address,
        input_address: rawLoc.address_or_city,
        place_id: placeId,
        place_payload: placeDetails,
        raw_input: bInput,
      };
      savedBusinesses.push(savedB);
    }

    const primaryPlaceId = placeIds[0];
    const primaryPlace = savedBusinesses[0]?.place_payload || {};
    const competitorPlaces = await this.searchCompetitorPlaces(
      primaryPlace.location,
      primaryPlace.types || [],
    );
    const competitorPlaceIds = competitorPlaces.map((c) => c.place_id);

    const contextId = await this.businessContextStore.saveBusinessContext({
      user_id: userId,
      primary_place_id: primaryPlaceId,
      place_ids: placeIds,
      competitor_place_ids: competitorPlaceIds,
      business_name: savedBusinesses[0]?.business_name,
      business_address: savedBusinesses[0]?.business_address,
      business_category: savedBusinesses[0]?.business_category,
      report_frequency: reportFrequency,
      goals,
      raw_input: payload,
    });

    await this.businessStore.saveUserBusinesses(contextId, userId, savedBusinesses);

    return {
      user_id: userId,
      context_id: contextId,
      report_frequency: reportFrequency,
      goals,
      businesses: savedBusinesses,
      competitor_places: competitorPlaces,
    };
  }

  async addBusinessLocation(payload: any): Promise<any> {
    const userId = payload.user_id;
    const businessName = payload.business_name;
    const locInput = payload.location || {};

    let placeId = locInput.place_id;
    if (!placeId) {
      if (locInput.google_maps_url) {
        placeId = await this.expandAndExtractPlaceId(locInput.google_maps_url);
      } else if (locInput.address_or_city) {
        const query = `${businessName} ${locInput.address_or_city}`;
        placeId = await this.searchPlaceId(query);
      }
    }

    if (!placeId) {
      throw new HttpException('Could not resolve place_id for location', HttpStatus.BAD_REQUEST);
    }

    const placeDetails = await this.fetchPlaceDetails(placeId);
    await this.placeStore.upsertPlaceData(placeDetails);

    const existingBusinesses = await this.businessStore.getUserBusinesses(userId);
    const match = existingBusinesses.find(
      (b) => b.business_name.toLowerCase() === businessName.toLowerCase(),
    );

    const contextId = match ? match.context_id : 1;

    const newBusiness = {
      user_id: userId,
      business_name: businessName,
      business_category: locInput.business_category || match?.business_category || placeDetails.types?.[0],
      business_address: placeDetails.formatted_address,
      input_address: locInput.address_or_city,
      place_id: placeId,
      place_payload: placeDetails,
      raw_input: payload,
    };

    await this.businessStore.saveUserBusinesses(contextId, userId, [newBusiness]);
    return newBusiness;
  }
}
