import type { GalleryImage } from '../../lib/entity-gallery';

const photo = (file: string, alt: string): GalleryImage => ({ src: `/housing-gallery/${file}`, alt, kind: 'photo' });

// User-supplied housing photographs matched one-to-one by filename. The generic
// entity page renders this metadata for any category without housing-specific UI.
export const housingGalleryBySlug: Record<string, GalleryImage[]> = {
  'alspaugh': [photo('01_Alspaugh.jpg', 'Alspaugh residence hall painted bench sign')],
  'bassett': [photo('02_Bassett.jpg', 'Bassett residence hall painted bench sign')],
  'bell-tower': [photo('03_BellTower.jpg', 'Bell Tower residence hall exterior')],
  'blackwell': [photo('04_Blackwell.jpg', 'Blackwell residence hall exterior')],
  'brown': [photo('05_Brown.jpg', 'Brown residence hall exterior')],
  'east-house': [photo('06_EastHouse.jpg', 'East House painted bench sign')],
  'gilbert-addoms': [photo('07_GilbertAddoms.jpg', 'Gilbert-Addoms residence hall exterior')],
  'giles': [photo('08_Giles.jpg', 'Giles residence hall exterior')],
  'pegram': [photo('09_Pegram.jpg', 'Pegram residence hall exterior')],
  'randolph': [photo('10_Randolph.jpg', 'Randolph residence hall exterior')],
  'southgate': [photo('11_Southgate.jpg', 'Southgate residence hall exterior')],
  'west-house': [photo('12_WestHouse.jpg', 'West House residence hall exterior')],
  'trinity': [photo('13_Trinity.jpg', 'Trinity residence hall exterior')],
  'wilson': [photo('14_Wilson.jpg', 'Wilson residence hall exterior')],
  'craven-quad': [photo('15_Craven.jpg', 'Craven Quad stone residence exterior')],
  'crowell-quad': [photo('16_Crowell.jpg', 'Crowell Quad tower and entrance')],
  'edens-quad': [photo('17_Edens.jpg', 'Edens Quad renovated courtyard entrance')],
  'few-quad': [photo('18_Few.jpg', 'Few Quad Gothic stone arcade')],
  'hollows-quad': [photo('19_Hollows.jpg', 'Hollows Quad residence buildings and courtyard')],
  'keohane-quad': [photo('20_Keohane.jpg', 'Keohane Quad residence exterior and footbridge')],
  'kilgo-quad': [photo('21_Kilgo.jpg', 'Kilgo Quad inner courtyard')],
  'wannamaker-quad': [photo('22_Wannamaker.jpg', 'Wannamaker Quad renovated entrance at dusk')],
  '300-swift': [photo('23_300Swift.jpg', '300 Swift Avenue apartment building exterior')],
  'edens-1a': [photo('17_Edens.jpg', 'Edens Quad courtyard, home of Edens 1A')],
  'edens-1b': [photo('17_Edens.jpg', 'Edens Quad courtyard, home of Edens 1B')],
  'edens-1c': [photo('17_Edens.jpg', 'Edens Quad courtyard, home of Edens 1C')],
  'edens-2a': [photo('17_Edens.jpg', 'Edens Quad courtyard, home of Edens 2A')],
  'edens-2c': [photo('17_Edens.jpg', 'Edens Quad courtyard, home of Edens 2C')],
  'edens-3a': [photo('17_Edens.jpg', 'Edens Quad courtyard, home of Edens 3A')],
  'edens-3b': [photo('17_Edens.jpg', 'Edens Quad courtyard, home of Edens 3B')],
  'hollows-a': [photo('19_Hollows.jpg', 'Hollows Quad residence buildings, home of Hollows A')],
  'hollows-b': [photo('19_Hollows.jpg', 'Hollows Quad residence buildings, home of Hollows B')],
  'keohane-abd': [photo('20_Keohane.jpg', 'Keohane Quad residence exterior, home of Keohane ABD')],
  'keohane-e': [photo('20_Keohane.jpg', 'Keohane Quad residence exterior, home of Keohane E')],
};
