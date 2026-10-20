// Restore the established world with asteroid, garden and the other authored assets.
// The large elevator mansion remains available explicitly for comparison.
const experience = new URLSearchParams(location.search).get('experience');
if (experience === 'contact' && new URLSearchParams(location.search).get('travel') !== 'down') {
  // Old cabin links now open the real cabin in the world.
  const url=new URL(location.href);url.search='';url.searchParams.set('boothEnter','1');location.replace(url);
} else if (experience === 'contact') {
  import('./contact/booth.mjs');
} else if (experience === 'chamber') {
  import('./contact/chamber.mjs');
} else if (new URLSearchParams(location.search).get('scene') === 'greybox') {
  import('./greybox/main.js');
} else {
  import('./main.js');
}
