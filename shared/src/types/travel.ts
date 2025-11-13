export enum TravelMode {
  DRIVING = 'driving',
  WALKING = 'walking',
  CYCLING = 'cycling',
  FLYING = 'flying',
  SAILING = 'sailing',
  CRUISE = 'cruise'
}

export interface TravelConfig {
  mode: TravelMode;
  customDuration?: number;
  customSpeed?: number;
  preferences: {
    weatherUpdateInterval: number;
    routeOptimization: boolean;
  };
}