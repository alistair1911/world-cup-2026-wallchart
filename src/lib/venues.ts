export type VenueInfo = {
  key: string;
  city: string;
  country: string;
  stadium: string;
  image: string;
};

export const VENUES: VenueInfo[] = [
  { key: "mexico-city", city: "Mexico City", country: "Mexico", stadium: "Estadio Azteca", image: "/stadiums/mexico-city.jpg" },
  { key: "guadalajara", city: "Guadalajara", country: "Mexico", stadium: "Estadio Akron", image: "/stadiums/guadalajara.jpg" },
  { key: "monterrey", city: "Monterrey", country: "Mexico", stadium: "Estadio BBVA", image: "/stadiums/monterrey.jpg" },
  { key: "toronto", city: "Toronto", country: "Canada", stadium: "BMO Field", image: "/stadiums/toronto.jpg" },
  { key: "vancouver", city: "Vancouver", country: "Canada", stadium: "BC Place", image: "/stadiums/vancouver.jpg" },
  { key: "seattle", city: "Seattle", country: "USA", stadium: "Lumen Field", image: "/stadiums/seattle.jpg" },
  {
    key: "san-francisco-bay-area",
    city: "San Francisco Bay Area",
    country: "USA",
    stadium: "Levi's Stadium",
    image: "/stadiums/san-francisco-bay-area.jpg"
  },
  { key: "los-angeles", city: "Los Angeles", country: "USA", stadium: "SoFi Stadium", image: "/stadiums/los-angeles.jpg" },
  { key: "houston", city: "Houston", country: "USA", stadium: "NRG Stadium", image: "/stadiums/houston.jpg" },
  { key: "dallas", city: "Dallas", country: "USA", stadium: "AT&T Stadium", image: "/stadiums/dallas.jpg" },
  { key: "kansas-city", city: "Kansas City", country: "USA", stadium: "Arrowhead Stadium", image: "/stadiums/kansas-city.jpg" },
  { key: "atlanta", city: "Atlanta", country: "USA", stadium: "Mercedes-Benz Stadium", image: "/stadiums/atlanta.jpg" },
  { key: "miami", city: "Miami", country: "USA", stadium: "Hard Rock Stadium", image: "/stadiums/miami.jpg" },
  { key: "boston", city: "Boston", country: "USA", stadium: "Gillette Stadium", image: "/stadiums/boston.jpg" },
  { key: "philadelphia", city: "Philadelphia", country: "USA", stadium: "Lincoln Financial Field", image: "/stadiums/philadelphia.jpg" },
  {
    key: "new-york-new-jersey",
    city: "New York/New Jersey",
    country: "USA",
    stadium: "MetLife Stadium",
    image: "/stadiums/new-york-new-jersey.jpg"
  }
];

export function getVenueInfo(venue: string) {
  const normalized = venue.toLowerCase();
  return VENUES.find((item) => normalized.startsWith(item.city.toLowerCase()));
}
