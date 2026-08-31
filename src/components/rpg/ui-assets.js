import mapCity from "@/assets/rpg/map-city.png";

import uiA1 from "@/assets/UI-21张/image_1787895239844.jpg";
import uiA2 from "@/assets/UI-21张/image_1787895257005.jpg";
import uiA3 from "@/assets/UI-21张/image_1787895247159.jpg";
import uiB1 from "@/assets/UI-21张/image_1787895253954.jpg";
import uiB2 from "@/assets/UI-21张/image_1787895244086.jpg";
import uiB3 from "@/assets/UI-21张/image_1787895250378.jpg";
import uiB4 from "@/assets/UI-21张/image_1787895260327.jpg";
import uiB5 from "@/assets/UI-21张/image_1787895264858.jpg";
import uiB6 from "@/assets/UI-21张/image_1787895267888.jpg";
import uiB7 from "@/assets/UI-21张/image_1787895276975.jpg";
import uiB8 from "@/assets/UI-21张/image_1787895273724.jpg";
import uiC1 from "@/assets/UI-21张/image_1787895184603.jpg";
import uiC2 from "@/assets/UI-21张/image_1787895198186.jpg";
import uiC3 from "@/assets/UI-21张/image_1787895201858.jpg";
import uiC4 from "@/assets/UI-21张/image_1787895212697.jpg";
import uiD1 from "@/assets/UI-21张/image_1787895208455.jpg";
import uiD2 from "@/assets/UI-21张/image_1787895205075.jpg";
import uiD3 from "@/assets/UI-21张/image_1787895216470.jpg";
import uiE1 from "@/assets/UI-21张/image_1787895219867.jpg";
import uiE2 from "@/assets/UI-21张/image_1787895223271.jpg";
import uiE3 from "@/assets/UI-21张/image_1787895227157.jpg";

export const TIDE_BACKGROUNDS = {
  "A-1": uiA1,
  "A-2": uiA2,
  "A-3": uiA3,
  "B-1": uiB1,
  "B-2": uiB2,
  "B-3": uiB3,
  "B-4": uiB4,
  "B-5": uiB5,
  "B-6": uiB6,
  "B-7": uiB7,
  "B-8": uiB8,
  "C-1": uiC1,
  "C-2": uiC2,
  "C-3": uiC3,
  "C-4": uiC4,
  "D-1": uiD1,
  "D-2": uiD2,
  "D-3": uiD3,
  "E-1": uiE1,
  "E-2": uiE2,
  "E-3": uiE3,
};

export const UI_BACKGROUNDS = {
  dawn_city: uiA1,
  splendor: uiB2,
  end_era: uiA3,
  tide_port: uiA2,
  archive: uiB1,
  stealth: uiB3,
  church: uiB4,
  lighthouse: uiB5,
  void_ritual: uiB6,
  tri_crisis: uiB7,
  twist: uiC1,
  ending: uiB8,
  map: mapCity,
};

export function bgForAct(uiBg) {
  return UI_BACKGROUNDS[uiBg] || UI_BACKGROUNDS.dawn_city;
}

export function bgForScreen(id) {
  return TIDE_BACKGROUNDS[id] || UI_BACKGROUNDS.dawn_city;
}
