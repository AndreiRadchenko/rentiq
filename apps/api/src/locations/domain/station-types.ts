export const stationWorkingStatus = ['WORKING', 'MAINTENANCE'] as const;
export type StationWorkingStatus = (typeof stationWorkingStatus)[number];

export const stationHealthStatus = ['ONLINE', 'OFFLINE', 'UNKNOWN'] as const;
export type StationHealthStatus = (typeof stationHealthStatus)[number];
