export function createGameMenu(root,player,toggle){
  const dialog=document.createElement('dialog');dialog.className='game-menu';
  dialog.innerHTML=`<p class="menu-eyebrow">ANIMAL HOUSE · ESPLORAZIONE</p><h2>Prenditi il tuo tempo.</h2><p>Una magione sospesa tra le stelle.</p><div class="control-guide"><p><kbd>W A S D</kbd> oppure frecce per muoverti</p><p><kbd>Shift</kbd> per correre · tasto destro per guardare</p><p><kbd>E</kbd> o clic sulle scale per cambiare piano</p><p>Su touch: leva a sinistra per muoverti, trascina a destra per guardare.</p></div><button class="resume-button" autofocus>Riprendi l’esplorazione</button>`;
  root.append(dialog);
  function close(){dialog.close();window.__APP.inputBlocked=false;window.dispatchEvent(new Event('clearinput'));}
  function open(){if(window.__APP.inputBlocked)return;window.dispatchEvent(new Event('clearinput'));player.velocity.set(0,0,0);window.__APP.inputBlocked=true;dialog.showModal();}
  toggle.addEventListener('click',open);dialog.querySelector('button').addEventListener('click',close);
  dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
  document.addEventListener('keydown',e=>{if(e.code==='Escape'&&!dialog.open&&!window.__APP.inputBlocked){e.preventDefault();open();}});
  return {open,close};
}
