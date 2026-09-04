import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { GooglePlacesService } from './google-places.service';
import { BusinessStoreService } from '../db/business-store.service';
import { BusinessContextStoreService } from '../db/business-context-store.service';
import { PlaceStoreService } from '../db/place-store.service';
import { businessMatches } from '../utils/business-matching';

function summarizePlace(place: any): any {
  if (!place) return null;
  return {
    place_id: place.place_id,
    name: place.name,
    formatted_address: place.formatted_address,
    rating: place.rating || 0,
    user_ratings_total: place.user_ratings_total || 0,
    price_level: place.price_level,
    types: place.types || [],
    location: place.location || place.geometry?.location,
    website: place.website,
    formatted_phone_number: place.formatted_phone_number,
    photos: (place.photos || []).slice(0, 5),
    reviews: (place.reviews || []).slice(0, 5),
  };
}

@Injectable()
export class GoalsSetupService {
  constructor(
    private readonly googlePlacesService: GooglePlacesService,
    private readonly businessStore: BusinessStoreService,
    private readonly businessContextStore: BusinessContextStoreService,
    private readonly placeStore: PlaceStoreService,
  ) {}

  private isLocationScopedContext(context: any, placeId: string): boolean {
    if (!context) return false;
    return (
      context.primary_place_id === placeId &&
      Array.isArray(context.place_ids) &&
      context.place_ids.length === 1 &&
      context.place_ids[0] === placeId
    );
  }

  private mergedCompetitorPlaceIds(
    existingPlaceIds: string[],
    newPlaceIds: string[],
    ownPlaceIds: Set<string>,
  ): string[] {
    const merged: string[] = [];
    for (const placeId of [...existingPlaceIds, ...newPlaceIds]) {
      if (!placeId || ownPlaceIds.has(placeId) || merged.includes(placeId)) {
        continue;
      }
      merged.push(placeId);
    }
    return merged;
  }

  async fetchAndSaveGoalsSetup(payload: any): Promise<any> {
    const userId = payload.user_id;
    if (!userId) {
      throw new HttpException('user_id is required to set goals.', HttpStatus.BAD_REQUEST);
    }

    let rawBusinesses = payload.businesses;
    if (!rawBusinesses || !Array.isArray(rawBusinesses) || rawBusinesses.length === 0) {
      if (payload.business_name) {
        rawBusinesses = [
          {
            business_name: payload.business_name,
            location: payload.location || payload.address || '',
            competitors_urls: payload.competitors_urls || payload.competitor_urls || [],
            goals: payload.goals || [],
          },
        ];
      } else {
        throw new HttpException(
          'businesses list or business_name is required in goals setup payload.',
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const userBusinesses = await this.businessStore.getUserBusinesses(userId);
    const ownPlaceIds = new Set<string>(
      userBusinesses.map((b) => b.place_id).filter(Boolean),
    );

    const results: any[] = [];

    for (const bGoal of rawBusinesses) {
      const bName = bGoal.business_name || bGoal.name || '';
      const bLoc = bGoal.location || bGoal.address || '';
      const competitorUrls: string[] = bGoal.competitors_urls || bGoal.competitor_urls || [];
      const goals: string[] = bGoal.goals || payload.goals || [];

      // Find saved business matching name and location
      const ownBusinesses = userBusinesses.filter((sb) => businessMatches(sb, bName));
      const matchedLocations = ownBusinesses.filter((sb) =>
        businessMatches(sb, bName, bLoc),
      );

      if (matchedLocations.length === 0) {
        throw new HttpException(
          'Business not found for this user, business_name, and location. Submit POST /businesses/fetch first, then use one of the saved location addresses.',
          HttpStatus.NOT_FOUND,
        );
      }

      const matchedBusiness = matchedLocations[0];

      const selectedPlaceId = matchedBusiness.place_id;
      const context = await this.businessContextStore.getLatestBusinessContext(
        selectedPlaceId,
        userId,
      );

      const existingCompetitorPlaceIds: string[] = context?.competitor_place_ids || [];
      const newCompetitorPlaceIds: string[] = [];
      const newCompetitorPlaces: any[] = [];
      const competitorErrors: any[] = [];

      for (const competitorUrl of competitorUrls) {
        try {
          const compPlace = await this.googlePlacesService.resolvePlaceFromUrlOrText(
            competitorUrl,
          );
          const cPlaceId = compPlace.place_id;

          if (cPlaceId && !ownPlaceIds.has(cPlaceId) && !newCompetitorPlaceIds.includes(cPlaceId)) {
            newCompetitorPlaceIds.push(cPlaceId);
            newCompetitorPlaces.push(compPlace);
            await this.placeStore.upsertPlaceData(compPlace);
          }
        } catch (err: any) {
          competitorErrors.push({
            competitor_url: competitorUrl,
            status_code: err.status || 400,
            error: err.message || 'Failed to resolve competitor URL',
          });
        }
      }

      const competitorPlaceIds = this.mergedCompetitorPlaceIds(
        existingCompetitorPlaceIds,
        newCompetitorPlaceIds,
        ownPlaceIds,
      );

      // Save/update context
      let updatedContext: any = null;

      const goalsInput = {
        business_name: bName,
        location: bLoc,
        competitors_urls: competitorUrls,
        goals,
      };

      if (this.isLocationScopedContext(context, selectedPlaceId)) {
        updatedContext = await this.businessContextStore.updateBusinessContextGoals(
          context.id,
          competitorPlaceIds,
          goals,
          goalsInput,
        );
      } else {
        const savedContextId = await this.businessContextStore.saveBusinessContext({
          user_id: userId,
          primary_place_id: selectedPlaceId,
          place_ids: [selectedPlaceId],
          competitor_place_ids: competitorPlaceIds,
          business_name: matchedBusiness.business_name,
          business_address: matchedBusiness.business_address || bLoc,
          business_category: matchedBusiness.business_category,
          report_frequency: context?.report_frequency || payload.report_frequency || 'monthly',
          goals,
          raw_input: {
            business_setup: context?.raw_input?.business_setup || context?.raw_input || {},
            goals_setup: goalsInput,
          },
        });

        updatedContext = await this.businessContextStore.getLatestBusinessContext(
          selectedPlaceId,
          userId,
        );
      }

      // Fetch summarized competitors
      const summarizedCompetitors: any[] = [];
      for (const cId of competitorPlaceIds) {
        const cPlace = await this.placeStore.getPlaceData(cId);
        if (cPlace) {
          summarizedCompetitors.push(summarizePlace(cPlace));
        }
      }

      results.push({
        status: 'saved',
        context_id: updatedContext?.id || context?.id || 1,
        business_name: matchedBusiness.business_name,
        location: bLoc,
        place_id: selectedPlaceId,
        goals: updatedContext?.goals || goals,
        competitors: summarizedCompetitors,
        new_competitors: newCompetitorPlaces.map(summarizePlace),
        competitor_errors: competitorErrors,
      });
    }

    return {
      status: 'saved',
      user_id: userId,
      businesses: results,
    };
  }
}
