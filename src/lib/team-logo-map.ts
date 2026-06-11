export const TEAM_LOGOS = {
  "australia": "/federations/australia.png",
  "belgium": "/federations/belgium.png",
  "bosnia-herzegovina": "/federations/bosnia-herzegovina.png",
  "brazil": "/federations/brazil.png",
  "cabo-verde": "/federations/cabo-verde.png",
  "canada": "/federations/canada.png",
  "colombia": "/federations/colombia.png",
  "congo-dr": "/federations/congo-dr.png",
  "croatia": "/federations/croatia.png",
  "curacao": "/federations/curacao.png",
  "czechia": "/federations/czechia.png",
  "ecuador": "/federations/ecuador.png",
  "egypt": "/federations/egypt.png",
  "england": "/federations/england.png",
  "france": "/federations/france.png",
  "germany": "/federations/germany.png",
  "ghana": "/federations/ghana.png",
  "haiti": "/federations/haiti.png",
  "iraq": "/federations/iraq.svg",
  "japan": "/federations/japan.png",
  "jordan": "/federations/jordan.png",
  "korea-republic": "/federations/korea-republic.png",
  "mexico": "/federations/mexico.png",
  "morocco": "/federations/morocco.png",
  "new-zealand": "/federations/new-zealand.svg",
  "norway": "/federations/norway.png",
  "panama": "/federations/panama.png",
  "paraguay": "/federations/paraguay.png",
  "portugal": "/federations/portugal.png",
  "qatar": "/federations/qatar.png",
  "scotland": "/federations/scotland.png",
  "senegal": "/federations/senegal.png",
  "south-africa": "/federations/south-africa.png",
  "spain": "/federations/spain.png",
  "sweden": "/federations/sweden.jpg",
  "switzerland": "/federations/switzerland.png",
  "turkiye": "/federations/turkiye.png",
  "usa": "/federations/usa.png"
} as const;

export type TeamLogoId = keyof typeof TEAM_LOGOS;

export function getTeamLogo(teamId: string) {
  return TEAM_LOGOS[teamId as TeamLogoId];
}
