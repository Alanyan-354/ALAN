import type { GalleryImage } from '../../lib/entity-gallery';

const photo = (file: string, alt: string): GalleryImage => ({ src: `/dining-gallery/${file}`, alt, kind: 'photo' });
const graphic = (file: string, alt: string): GalleryImage => ({ src: `/dining-gallery/${file}`, alt, kind: 'graphic' });

// Optional catalog content. Pages render the same metadata shape for any entity.
export const diningGalleryBySlug: Record<string, GalleryImage[]> = {
  'brodhead-center': [
    photo('brodhead-exterior.jpg', 'Brodhead Center exterior at dusk'),
  ],
  'bryan-center': [photo('bryan-center.jpg', 'Dining area inside Bryan Center')],
  'marketplace': [photo('marketplace-dining.jpg', 'Marketplace dining counters')],
  'gardens-cafe': [photo('gardens-cafe.jpg', 'Gardens Cafe counter')],
  'farmstead': [
    graphic('farmstead-logo.jpg', 'Farmstead Garden Market logo'),
    graphic('farmstead-feature.jpg', 'Farmstead featured dining graphic; offerings may have changed'),
  ],
  'ginger-soy': [
    photo('ginger-soy-team.jpg', 'Ginger + Soy kitchen team'),
    graphic('ginger-soy-logo.jpg', 'Ginger + Soy logo'),
  ],
  'gyotaku': [graphic('gyotaku-feature.jpg', 'Gyotaku featured dining graphic; offerings may have changed')],
  'il-forno': [
    photo('il-forno-dining.jpg', 'Il Forno dining area in Brodhead Center'),
    graphic('il-forno-logo.jpg', 'Il Forno Italian Kitchen logo'),
  ],
  'jbs-roasts-and-chops': [graphic('jbs-logo.jpg', "JB's Roasts & Chops logo")],
  'sazon': [
    graphic('sazon-logo.jpg', 'Sazón Latin American Table logo'),
    graphic('sazon-feature.jpg', 'Sazón featured dining graphic; offerings may have changed'),
  ],
  'sprout': [graphic('sprout-logo.jpg', 'Sprout logo')],
  'tandoor': [
    graphic('tandoor-logo.jpg', 'Tandoor logo'),
    graphic('tandoor-feature.jpg', 'Tandoor featured dining graphic; offerings may have changed'),
  ],
  'the-chefs-kitchen': [photo('chefs-kitchen.jpg', "Chef preparing food at The Chef's Kitchen")],
  'the-commons': [
    photo('commons-interior.png', 'Dining room at The Commons'),
    photo('commons-dish.jpg', 'Plate served at The Commons'),
  ],
  'the-devils-krafthouse': [
    graphic('devils-krafthouse-logo.jpg', "The Devil's Krafthouse logo"),
    graphic('devils-krafthouse-feature.jpg', "The Devil's Krafthouse featured dining graphic; offerings may have changed"),
  ],
  'the-skillet': [
    photo('skillet-kitchen.jpg', 'Food preparation at The Skillet'),
    graphic('skillet-logo.jpg', 'The Skillet Southern Cookery logo'),
  ],
  'beyu-blue-coffee': [photo('beyu-blue-coffee.jpg', 'Beyu Blue Coffee drinks')],
  'gothic-grill': [
    photo('gothic-grill-opening.jpg', 'Gothic Grill opening inside Bryan Center'),
    graphic('gothic-grill-feature.jpg', 'Gothic Grill featured dining graphic; offerings may have changed'),
  ],
  'red-mango': [graphic('red-mango-feature.jpg', 'Red Mango featured dining graphic; offerings may have changed')],
  'saladelia-at-sanford': [graphic('saladelia-logo.jpg', 'Saladelia logo')],
  'saladelia-at-perkins-library': [graphic('saladelia-logo.jpg', 'Saladelia logo')],
  'bella-union': [photo('bella-union.jpg', 'Coffee counter and seating at Bella Union')],
  'bseisu-coffee-bar': [photo('bseisu-coffee-bar.jpg', 'Espresso being prepared at Bseisu Coffee Bar')],
  'cafe-300': [photo('cafe-300.jpg', '300 Swift Avenue building, home of Café 300')],
  'freeman-center-cafe': [photo('freeman-center-cafe.jpg', 'Service counter at Freeman Center Café')],
  'nasher-cafe': [photo('nasher-cafe.jpg', 'Dining at the Nasher Museum Café')],
  'pitchforks': [photo('pitchforks.jpg', "Interior of Duke's Pitchfork Café")],
  'the-daily-docket': [photo('daily-docket.png', 'The Daily Docket café promotional food photograph')],
  'trinity-cafe': [photo('trinity-cafe.jpg', 'Counter and seating at Trinity Café')],
  'twinnies': [photo('twinnies.jpg', "Twinnie's Café entrance and counter")],
  'zwelis': [photo('zwelis-terrace.jpg', "Outdoor seating beside Zweli's Café at Duke Divinity")],
  'brodhead-center-cafe': [photo('duke-cafe.jpg', 'Gelato featured by Duke Café in the Brodhead Center')],
  'panera-bread': [photo('brodhead-exterior.jpg', 'Brodhead Center, home of the Panera Bread location')],
  'the-sub-central': [photo('brodhead-exterior.jpg', 'Brodhead Center, home of The Sub Central')],
  'its-thyme': [photo('its-thyme-interior.jpg', "Interior of It's Thyme in the Bryan Center")],
  'mcdonalds': [photo('bryan-center.jpg', "Bryan Center dining area, home of the McDonald's location")],
  'alchemy': [graphic('alchemy.png', 'Gothic Grill branding; Alchemy is its bar in the Bryan Center')],
  '1892-grille': [photo('marketplace-dining.jpg', 'Marketplace servery, home of 1892 Grille')],
  'bakers-table': [photo('marketplace-dining.jpg', "Marketplace servery, home of Baker's Table")],
  'marketplace-cucina': [photo('marketplace-dining.jpg', 'Marketplace servery, home of Cucina')],
  'durham-market': [photo('marketplace-dining.jpg', 'Marketplace servery, home of Durham Market')],
  'marketplace-fusion': [photo('marketplace-dining.jpg', 'Marketplace servery, home of Fusion')],
  'marketplace-harvest': [photo('marketplace-dining.jpg', 'Marketplace servery, home of Harvest')],
  'leaf-and-ladle': [photo('marketplace-dining.jpg', 'Marketplace servery, home of Leaf & Ladle')],
  'marketplace-wood-fired': [photo('wood-fired.jpg', 'Pizza served from a wood-fired oven at Marketplace')],
};
