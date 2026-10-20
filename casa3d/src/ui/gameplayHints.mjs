export function createGameplayHints(){
  const element=document.createElement('div');element.className='desktop-hints';
  element.innerHTML='<span><kbd>W A S D</kbd> Muoviti · <kbd>Shift</kbd> Corri</span><span>Tasto destro per guardarti attorno · <kbd>E</kbd> Interagisci</span>';
  return element;
}
