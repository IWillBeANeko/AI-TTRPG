import portraitPlayer from "@/assets/rpg/portrait-player.png";
import portraitAlice from "@/assets/rpg/portrait-alice.png";
import portraitGareth from "@/assets/rpg/portrait-gareth.png";
import portraitMara from "@/assets/rpg/portrait-mara.png";
import portraitBaker from "@/assets/rpg/bread-baker.png";
import portraitYongyin from "@/assets/rpg/nun.png";
import diceD20 from "@/assets/rpg/dice-d20.png";

export const FACES = {
  player: portraitPlayer,
  yongyin: portraitYongyin,
  ewen: portraitAlice,
  saltspeaker: portraitGareth,
  baker: portraitBaker,
  envoy: portraitGareth,
};

export const PLAYER_PORTRAITS = {
  male: portraitPlayer,
  female: portraitMara,
};

export const COMPANION_PORTRAITS = {
  male: portraitGareth,
  female: portraitAlice,
};

export { diceD20 };

export const HEX_LOCS = {
  lighthouse: { q: 0, r: 0, mark: "hub" },
  harbor: { q: 2, r: 1, mark: "poi" },
  council: { q: 0, r: 1, mark: "poi" },
  archive: { q: 0, r: 3, mark: "alert" },
  canal: { q: 4, r: 0, mark: "alert" },
  sunken_clock: { q: 4, r: 3, mark: "alert" },
};
