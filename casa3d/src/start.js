// Restore the established world with asteroid, garden and the other authored assets.
// The large elevator mansion remains available explicitly for comparison.
if (new URLSearchParams(location.search).get('scene') === 'greybox') {
  import('./greybox/main.js');
} else {
  import('./main.js');
}
