export const ALBUM_ARTIST = 'ANIMALE ARTIFICIALE';
export const ALBUM_TITLE = '𓅭𓃸𓅝𓃰𓆝';
export const ALBUM_TRACKS = Object.freeze([
  [ALBUM_TITLE, 'AHBOUNCE_06-03.wav'], ['𓃰𓆝𓅭𓃸𓅝', 'AHBOUNCE_12-55.wav'],
  ['𓅝𓃰𓃸𓆝𓅭', 'AHBOUNCE_14-04.wav'], ['𓆝𓅭𓅝𓃰𓃸', 'AHBOUNCE_17-31.wav'],
  ['𓃸𓅝𓆝𓅭𓃰', 'AHBOUNCE_19-51.wav'], ['𓆝𓃸𓅭𓅝𓃰', 'AHBOUNCE_21-25.wav'],
  ['𓅭𓆝𓃰𓅝𓃸', 'AHBOUNCE_22-18.wav'], ['𓃰𓅭𓃸𓅝𓆝', 'AHBOUNCE_31-57wav.wav'],
  ['𓅝𓅭𓆝𓃸𓃰', 'AHBOUNCE_33-56.wav'], ['𓃸𓃰𓅭𓆝𓅝', 'AHBOUNCE_38-33.wav'],
  ['𓆝𓅝𓃰𓅭𓃸', 'AHBOUNCE_41-40.wav'], ['𓅭𓅝𓃸𓆝𓃰', 'AHBOUNCE_45-22.wav'],
  ['𓃰𓃸𓆝𓅝𓅭', 'AHBOUNCE_50-00.wav'],
].map(([title, source], index) => Object.freeze({ code: '03.' + (101 + index), title, source })));

export const ALBUMS = Object.freeze([
  Object.freeze({ id: 'animale-artificiale', title: ALBUM_TITLE, tracks: ALBUM_TRACKS }),
  Object.freeze({
    id: 'animaleartificale01',
    title: '𓅭𓆝𓃰𓃸𓅝',
    tracks: Object.freeze([
      '𓅭𓃸𓃰𓅝𓆝',
      '𓅭𓅝𓃰𓆝𓃸',
      '𓃰𓆝𓅝𓃸𓅭',
      '𓃸𓆝𓅝𓅭𓃰',
      '𓅝𓅭𓆝𓃰𓃸',
      '𓆝𓃸𓅭𓃰𓅝',
      '𓅝𓆝𓃸𓅭𓃰',
      '𓃸𓅭𓆝𓃰𓅝',
      '𓃰𓅭𓆝𓅝𓃸',
    ].map((title, index) => Object.freeze({
      title, code: '01.' + (101 + index), file: 'ANIMALOUD ' + (index + 1) + '.mp3',
    }))),
  }),
]);

